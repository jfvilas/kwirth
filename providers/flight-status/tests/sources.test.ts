import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EFlightCapability, EFlightSourceId, EQuotaExhaustedKind } from '../src/common/FlightStatus'
import { AeroApiSource } from '../src/back/lib/sources/aeroapi'
import { AviationStackSource } from '../src/back/lib/sources/aviationstack'
import { OpenSkySource } from '../src/back/lib/sources/opensky'
import { QuotaExhaustedError, SourceHttpError } from '../src/back/lib/types'
import { json, mockFetch } from './helpers'

const BBOX = { lamin: 40, lomin: -9.5, lamax: 44, lomax: -6.5 }

// One OpenSky state vector, positional as the API sends it.
const STATE = ['34718e', 'IBE3171 ', 'Spain', 1_700_000_000, 1_700_000_001, -8.1, 42.2, 10_000, false, 230, 180, -2, null, 10_200, '1000']

test('opensky: parses state vectors, drops those without position and reports remaining credits', async () => {
    const f = mockFetch(() => json({ states: [STATE, ['nopos', '', 'X', 0, 0, null, null]] }, 200, { 'X-Rate-Limit-Remaining': '390' }))
    try {
        const src = new OpenSkySource()
        let remaining = -1
        src.onRemaining = r => { remaining = r }
        const list = await src.getPositions(BBOX)
        assert.equal(f.calls[0], 'https://opensky-network.org/api/states/all?lamin=40&lomin=-9.5&lamax=44&lomax=-6.5')
        assert.equal(remaining, 390)
        assert.deepEqual(list, [{
            icao24: '34718e', callsign: 'IBE3171', originCountry: 'Spain', lastContact: 1_700_000_001, lon: -8.1, lat: 42.2,
            baroAltitudeM: 10_000, onGround: false, velocityMs: 230, trackDeg: 180, verticalRateMs: -2, geoAltitudeM: 10_200,
            squawk: '1000', source: EFlightSourceId.OPENSKY,
        }])
    }
    finally {
        f.restore()
    }
})

test('opensky: anonymous vs authenticated quota, and the cost grows with the bbox area', () => {
    assert.equal(new OpenSkySource().quota.limit, 400)
    assert.equal(new OpenSkySource({ clientId: 'id', clientSecret: 's' }).quota.limit, 4000)
    assert.equal(new OpenSkySource({ dailyCredits: 50 }).quota.limit, 50)
    const src = new OpenSkySource()
    assert.equal(src.costOf(EFlightCapability.POSITIONS, { lamin: 0, lomin: 0, lamax: 5, lomax: 5 }), 1)
    assert.equal(src.costOf(EFlightCapability.POSITIONS, { lamin: 0, lomin: 0, lamax: 10, lomax: 10 }), 2)
    assert.equal(src.costOf(EFlightCapability.POSITIONS, { lamin: 0, lomin: 0, lamax: 20, lomax: 20 }), 3)
    assert.equal(src.costOf(EFlightCapability.POSITIONS, { lamin: 0, lomin: 0, lamax: 30, lomax: 30 }), 4)
})

test('opensky: with credentials it gets a token once and sends it as Bearer', async () => {
    const auths: string[] = []
    const f = mockFetch((url, init) => {
        if (url.includes('/token')) return json({ access_token: 'tok', expires_in: 1800 })
        auths.push(new Headers(init?.headers).get('Authorization') ?? '')
        return json({ states: [] })
    })
    try {
        const src = new OpenSkySource({ clientId: 'id', clientSecret: 's' })
        await src.getPositions(BBOX)
        await src.getPositions(BBOX)
        assert.equal(f.calls.filter(u => u.includes('/token')).length, 1)
        assert.deepEqual(auths, ['Bearer tok', 'Bearer tok'])
    }
    finally {
        f.restore()
    }
})

test('opensky: 429 is a period exhaustion with the retry header; other failures are HTTP errors', async () => {
    const f = mockFetch(url => url.includes('lamin=40') ? json({}, 429, { 'X-Rate-Limit-Retry-After-Seconds': '120' }) : json({}, 503))
    try {
        await assert.rejects(new OpenSkySource().getPositions(BBOX), (e: Error) =>
            e instanceof QuotaExhaustedError && e.kind === EQuotaExhaustedKind.PERIOD && e.retryAfterSec === 120)
        await assert.rejects(new OpenSkySource().getPositions({ ...BBOX, lamin: 41 }), (e: Error) =>
            e instanceof SourceHttpError && e.message === 'opensky: HTTP 503')
    }
    finally {
        f.restore()
    }
})

test('aviationstack: maps the active flight', async () => {
    const f = mockFetch(() => json({
        data: [
            { flight_status: 'landed', departure: {}, arrival: {} },
            {
                flight_status: 'active',
                departure: { airport: 'Madrid', iata: 'MAD', icao: 'LEMD', scheduled: 's1', actual: 'a1', delay: 12 },
                arrival: { airport: 'Vigo', iata: 'VGO', icao: 'LEVX', scheduled: 's2', estimated: 'e2', delay: null },
                airline: { name: 'Iberia' },
                flight: { iata: 'IB3171', icao: 'IBE3171' },
                aircraft: { registration: 'EC-ABC', icao: 'A320' },
            },
        ],
    }))
    try {
        const d = await new AviationStackSource({ accessKey: 'k' }).getDetails('IBE3171')
        assert.equal(f.calls[0], 'http://api.aviationstack.com/v1/flights?access_key=k&flight_icao=IBE3171')
        assert.ok(d)
        const { fetchedAt, ...rest } = d
        assert.ok(fetchedAt)
        assert.deepEqual(rest, {
            callsign: 'IBE3171', flightIata: 'IB3171', flightIcao: 'IBE3171', airline: 'Iberia',
            origin: { icao: 'LEMD', iata: 'MAD', name: 'Madrid' }, destination: { icao: 'LEVX', iata: 'VGO', name: 'Vigo' },
            status: 'active', scheduledDeparture: 's1', actualDeparture: 'a1', scheduledArrival: 's2', estimatedArrival: 'e2',
            departureDelayMin: 12, arrivalDelayMin: undefined, aircraftType: 'A320', registration: 'EC-ABC',
            source: EFlightSourceId.AVIATIONSTACK,
        })
    }
    finally {
        f.restore()
    }
})

test('aviationstack: error codes map to quota errors; no data is null', async () => {
    let body: unknown = { error: { code: 'usage_limit_reached' } }
    const f = mockFetch(() => json(body))
    try {
        const src = new AviationStackSource({ accessKey: 'k' })
        await assert.rejects(src.getDetails('X'), (e: Error) => e instanceof QuotaExhaustedError && e.kind === EQuotaExhaustedKind.PERIOD)
        body = { error: { code: 'rate_limit_reached' } }
        await assert.rejects(src.getDetails('X'), (e: Error) => e instanceof QuotaExhaustedError && e.kind === EQuotaExhaustedKind.RATE && e.retryAfterSec === 60)
        body = { error: { code: 'invalid_access_key' } }
        await assert.rejects(src.getDetails('X'), (e: Error) => e.message === 'aviationstack: HTTP 200 - invalid_access_key')
        body = { data: [] }
        assert.equal(await src.getDetails('X'), null)
    }
    finally {
        f.restore()
    }
})

test('aeroapi: prefers the airborne flight, converts delays to minutes, sends the key header', async () => {
    let key = ''
    const f = mockFetch((_url, init) => {
        key = new Headers(init?.headers).get('x-apikey') ?? ''
        return json({
            flights: [
                { ident_icao: 'IBE3171', scheduled_out: new Date().toISOString(), status: 'Scheduled' },
                { ident_icao: 'IBE3171', ident_iata: 'IB3171', operator: 'IBE', actual_off: 'x', actual_on: null, status: 'En Route',
                    departure_delay: 600, arrival_delay: 90, origin: { code_icao: 'LEMD' }, destination: null },
            ],
        })
    })
    try {
        const d = await new AeroApiSource({ apiKey: 'fa-key' }).getDetails('IBE3171')
        assert.equal(key, 'fa-key')
        assert.equal(f.calls[0], 'https://aeroapi.flightaware.com/aeroapi/flights/IBE3171?max_pages=1')
        assert.equal(d?.status, 'En Route')
        assert.equal(d?.departureDelayMin, 10)
        assert.equal(d?.arrivalDelayMin, 2)
        assert.deepEqual(d?.origin, { icao: 'LEMD', iata: undefined, name: undefined })
        assert.equal(d?.source, EFlightSourceId.AEROAPI)
    }
    finally {
        f.restore()
    }
})

test('aeroapi: 404 is null, 429 a rate limit, and the cost is the configured price', async () => {
    let status = 404
    const f = mockFetch(() => json({}, status, { 'Retry-After': '30' }))
    try {
        const src = new AeroApiSource({ apiKey: 'k', costPerCallUsd: 0.01, monthlyBudgetUsd: 20 })
        assert.equal(await src.getDetails('X'), null)
        status = 429
        await assert.rejects(src.getDetails('X'), (e: Error) => e instanceof QuotaExhaustedError && e.kind === EQuotaExhaustedKind.RATE && e.retryAfterSec === 30)
        assert.equal(src.costOf(), 0.01)
        assert.equal(src.quota.limit, 20)
    }
    finally {
        f.restore()
    }
})
