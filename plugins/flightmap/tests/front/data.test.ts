import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyMessage, AREAS, creditsPerCall, feet, FlightMapData, FlightMapInstanceConfig, isWatched, knots, squareDegrees } from '../../src/front/FlightMapData'
import { EFlightMapPayload, IFlightMapMessageResponse } from '../../src/common/FlightMapTypes'
import { aircraft } from '../helpers'

const positionsMsg = (list = [aircraft('a1')], timestamp = '2026-09-26T10:00:00.000Z') =>
    ({ payloadType: EFlightMapPayload.POSITIONS, timestamp, aircraft: list } as unknown as IFlightMapMessageResponse)

const errorMsg = (error?: string) =>
    ({ payloadType: EFlightMapPayload.ERROR, timestamp: '2026-09-26T10:01:00.000Z', error } as unknown as IFlightMapMessageResponse)

describe('applyMessage', () => {
    test('positions replace the aircraft and clear the last error', () => {
        const data = new FlightMapData()
        data.error = 'old'
        applyMessage(data, positionsMsg([aircraft('a1'), aircraft('a2')]))
        assert.deepEqual(data.aircraft.map(a => a.icao24), ['a1', 'a2'])
        assert.equal(data.timestamp, '2026-09-26T10:00:00.000Z')
        assert.equal(data.error, '')
    })

    test('an error keeps the last positions on the map', () => {
        const data = new FlightMapData()
        applyMessage(data, positionsMsg([aircraft('a1')]))
        applyMessage(data, errorMsg('no budget'))
        assert.equal(data.aircraft.length, 1)
        assert.equal(data.error, 'no budget')
        assert.equal(data.timestamp, '2026-09-26T10:00:00.000Z')
    })

    test('an error without a message still says something', () => {
        const data = new FlightMapData()
        applyMessage(data, errorMsg())
        assert.equal(data.error, 'Unknown error')
    })

    test('the selection goes away with its aircraft', () => {
        const data = new FlightMapData()
        applyMessage(data, positionsMsg([aircraft('a1'), aircraft('a2')]))
        data.selectedId = 'a1'
        applyMessage(data, positionsMsg([aircraft('a1')]))
        assert.equal(data.selectedId, 'a1')
        applyMessage(data, positionsMsg([aircraft('a2')]))
        assert.equal(data.selectedId, undefined)
    })
})

describe('OpenSky cost', () => {
    test('is charged on the box widened to the 0.5° grid, as the provider does', () => {
        const peninsula = AREAS.find(a => a.name === 'Iberian peninsula')!.bbox
        // 99.84 square degrees as given, 104 once widened: 3 credits, not 2
        assert.ok(squareDegrees(peninsula) < 100)
        assert.equal(creditsPerCall(peninsula), 3)
    })

    test('small areas cost one credit', () => {
        assert.equal(creditsPerCall(AREAS.find(a => a.name === 'Madrid')!.bbox), 1)
        assert.equal(creditsPerCall(AREAS.find(a => a.name === 'Barcelona')!.bbox), 1)
    })

    test('the thresholds', () => {
        assert.equal(creditsPerCall({ lamin: 0, lomin: 0, lamax: 5, lomax: 5 }), 1)
        assert.equal(creditsPerCall({ lamin: 0, lomin: 0, lamax: 10, lomax: 10 }), 2)
        assert.equal(creditsPerCall({ lamin: 0, lomin: 0, lamax: 20, lomax: 20 }), 3)
        assert.equal(creditsPerCall({ lamin: 0, lomin: 0, lamax: 21, lomax: 20 }), 4)
    })

    test('the default setup fits the anonymous quota: 3 credits every 12 minutes', () => {
        const config = new FlightMapInstanceConfig()
        assert.ok(Math.ceil(86400 / config.intervalSec) * creditsPerCall(config.bbox) <= 400)
    })
})

describe('texts', () => {
    test('a followed flight is matched ignoring case and the padding OpenSky leaves', () => {
        assert.equal(isWatched(aircraft('x', { callsign: 'IBE3171 ' }), ['ibe3171']), true)
        assert.equal(isWatched(aircraft('x', { callsign: 'VLG1001' }), ['IBE3171']), false)
        assert.equal(isWatched(aircraft('x', { callsign: undefined }), ['IBE3171']), false)
    })

    test('units', () => {
        assert.equal(feet(10000), `${(32808).toLocaleString()} ft`)
        assert.equal(feet(undefined), '-')
        assert.equal(knots(230), '447 kt')
        assert.equal(knots(undefined), '-')
    })
})
