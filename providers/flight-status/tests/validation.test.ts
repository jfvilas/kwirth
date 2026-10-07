import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defaultFlightStatusConfig, DEFAULT_INTERVAL_SEC, MIN_INTERVAL_SEC } from '../src/common/FlightStatus'
import { normalizeConfig, parseSubscription, validateBBox, validateConfig } from '../src/common/Validation'

const BBOX = { lamin: 40, lomin: -9.5, lamax: 44, lomax: -6.5 }

test('validateBBox: a missing or non-object bbox is one clear error', () => {
    assert.deepEqual(validateBBox(undefined), ['bbox is required: { lamin, lomin, lamax, lomax }'])
    assert.deepEqual(validateBBox([1, 2, 3, 4]), ['bbox is required: { lamin, lomin, lamax, lomax }'])
})

test('validateBBox: reports every non-numeric coordinate by name', () => {
    assert.deepEqual(validateBBox({ lamin: '40', lomin: -9.5, lamax: NaN, lomax: -6.5 }), ['bbox.lamin must be a number', 'bbox.lamax must be a number'])
})

test('validateBBox: ranges and ordering', () => {
    assert.deepEqual(validateBBox(BBOX), [])
    assert.deepEqual(validateBBox({ lamin: -91, lomin: 0, lamax: 10, lomax: 10 }), ['bbox latitudes must be within [-90, 90]'])
    assert.deepEqual(validateBBox({ lamin: 0, lomin: -181, lamax: 10, lomax: 10 }), ['bbox longitudes must be within [-180, 180]'])
    assert.deepEqual(validateBBox({ lamin: 10, lomin: 10, lamax: 10, lomax: 5 }), ['bbox.lamin must be lower than bbox.lamax', 'bbox.lomin must be lower than bbox.lomax'])
})

test('parseSubscription: defaults the interval and the watch list', () => {
    const { sub, errors } = parseSubscription({ bbox: BBOX })
    assert.deepEqual(errors, [])
    assert.deepEqual(sub, { bbox: BBOX, intervalSec: DEFAULT_INTERVAL_SEC, watch: [] })
})

test('parseSubscription: raises a too-short interval to the minimum and normalizes callsigns', () => {
    const { sub } = parseSubscription({ bbox: BBOX, intervalSec: 2, watch: [' ibe3171 ', '', 'vly1234'] })
    assert.equal(sub?.intervalSec, MIN_INTERVAL_SEC)
    assert.deepEqual(sub?.watch, ['IBE3171', 'VLY1234'])
})

test('parseSubscription: copies the bbox, dropping unknown keys', () => {
    const input = { bbox: { ...BBOX, extra: 1 } }
    const { sub } = parseSubscription(input)
    assert.deepEqual(sub?.bbox, BBOX)
    assert.notEqual(sub?.bbox, input.bbox)
})

test('parseSubscription: invalid payloads give no subscription and every error', () => {
    const { sub, errors } = parseSubscription({ bbox: BBOX, intervalSec: 'fast', watch: 'IBE3171' })
    assert.equal(sub, undefined)
    assert.deepEqual(errors, ['intervalSec must be a number', 'watch must be an array of callsigns'])
    assert.deepEqual(parseSubscription(null).errors, ['bbox is required: { lamin, lomin, lamax, lomax }'])
})

test('normalizeConfig: fills missing sections and fields from the defaults', () => {
    const d = defaultFlightStatusConfig()
    assert.deepEqual(normalizeConfig(undefined), d)
    const c = normalizeConfig({ aviationstack: { enabled: true }, positionTtlSec: 30 })
    assert.deepEqual(c.aviationstack, { enabled: true, accessKey: '', monthlyRequests: 100 })
    assert.equal(c.positionTtlSec, 30)
    assert.deepEqual(c.opensky, d.opensky)
})

test('normalizeConfig: never changes a value that came in, secrets included', () => {
    const c = normalizeConfig({ opensky: { clientId: 'id', clientSecret: 's3cret', dailyCredits: 10 } })
    assert.deepEqual(c.opensky, { clientId: 'id', clientSecret: 's3cret', dailyCredits: 10 })
})

test('validateConfig: defaults are valid', () => {
    assert.deepEqual(validateConfig(defaultFlightStatusConfig()), [])
})

test('validateConfig: OpenSky needs both clientId and secret, or neither', () => {
    const c = defaultFlightStatusConfig()
    c.opensky.clientId = 'id'
    assert.deepEqual(validateConfig(c), ['opensky needs both clientId and clientSecret, or neither (anonymous)'])
    c.opensky.clientSecret = 'secret'
    assert.deepEqual(validateConfig(c), [])
})

test('validateConfig: an enabled source needs its key', () => {
    const c = defaultFlightStatusConfig()
    c.aviationstack.enabled = true
    c.aeroapi.enabled = true
    assert.deepEqual(validateConfig(c), ['aviationstack is enabled but has no access key', 'aeroapi is enabled but has no API key'])
})

test('validateConfig: numbers and types', () => {
    const c = defaultFlightStatusConfig()
    c.opensky.dailyCredits = -1
    c.aviationstack.monthlyRequests = 0
    c.aeroapi.monthlyBudgetUsd = NaN
    c.aeroapi.costPerCallUsd = -0.1
    c.positionTtlSec = 4
    c.detailsTtlHours = 0
    assert.deepEqual(validateConfig(c), [
        'opensky.dailyCredits must be 0 (auto) or positive',
        'aviationstack.monthlyRequests must be a positive number',
        'aeroapi.monthlyBudgetUsd must be a positive number',
        'aeroapi.costPerCallUsd must be a positive number',
        'positionTtlSec must be at least 5',
        'detailsTtlHours must be a positive number',
    ])
    const t = normalizeConfig({ opensky: { clientId: 5 }, aviationstack: { enabled: 'yes', accessKey: 1 }, aeroapi: { enabled: 0, apiKey: null } })
    assert.deepEqual(validateConfig(t), [
        'opensky.clientId and opensky.clientSecret must be text',
        'aviationstack.enabled must be true or false',
        'aviationstack.accessKey must be text',
        'aeroapi.enabled must be true or false',
        'aeroapi.apiKey must be text',
    ])
})
