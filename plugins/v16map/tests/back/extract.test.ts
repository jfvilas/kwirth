import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { toPoint } from '../../src/back/V16Extract'
import { fixtureSituations } from '../helpers'

describe('toPoint, on the real DATEX2 fixture', () => {
    const points = fixtureSituations().map(toPoint)
    const byId = (id: string) => points.find(p => p.id === id)!

    test('every situation in the fixture becomes a point', () => {
        assert.deepEqual(points.map(p => p.id).sort(), ['24048680', '2816645'])
    })

    test('a V16 beacon is recognised by its creation reference', () => {
        const p = byId('24048680')
        assert.equal(p.v16, true)
        assert.equal(p.lat, 37.85428)
        assert.equal(p.lon, -4.779133)
        assert.equal(p.road, 'A-4')
        assert.equal(p.km, '404.821')
        assert.equal(p.cause, 'vehicleObstruction')
        assert.equal(p.detail, 'vehicleStuck')
        assert.equal(p.municipality, 'Córdoba')
        assert.equal(p.province, 'Córdoba')
        assert.equal(p.community, 'Andalucía')
        assert.equal(p.direction, 'northEastBound')
        assert.equal(p.start, '2026-09-26T07:56:22.000+02:00')
    })

    test('roadworks are not a V16 beacon', () => {
        const p = byId('2816645')
        assert.equal(p.v16, false)
        assert.equal(p.road, 'N-400')
        assert.equal(p.cause, 'roadMaintenance')
        assert.equal(p.detail, 'roadworks')
        assert.equal(typeof p.lat, 'number')
        assert.equal(typeof p.lon, 'number')
    })
})

describe('toPoint, on shapes the fixture does not have', () => {
    test('a situation with no coordinates has no lat/lon, but keeps the rest', () => {
        const p = toPoint({ '@_id': '1', situationRecord: [{ cause: { causeType: 'accident' } }] })
        assert.equal(p.id, '1')
        assert.equal(p.lat, undefined)
        assert.equal(p.lon, undefined)
        assert.equal(p.cause, 'accident')
    })

    test('latitude and longitude are taken from the same point', () => {
        // a linear location: from and to points; the first one wins, never a mix of both
        const p = toPoint({
            '@_id': '2',
            situationRecord: [{
                locationReference: {
                    from: { pointCoordinates: { latitude: '40.1', longitude: '-3.1' } },
                    to: { pointCoordinates: { latitude: '41.9', longitude: '-2.9' } }
                }
            }]
        })
        assert.deepEqual([p.lat, p.lon], [40.1, -3.1])
    })

    test('coordinates that are not numbers are ignored', () => {
        const p = toPoint({ '@_id': '3', situationRecord: [{ pointCoordinates: { latitude: 'n/a', longitude: '-3' } }] })
        assert.equal(p.lat, undefined)
    })

    test('a value with attributes arrives as #text and is still read', () => {
        const p = toPoint({ '@_id': '4', situationRecord: [{ roadName: { '#text': 'AP-7', '@_lang': 'es' } }] })
        assert.equal(p.road, 'AP-7')
    })

    test('a single situationRecord that is not an array is accepted', () => {
        const p = toPoint({ '@_id': '5', situationRecord: { situationRecordCreationReference: 'V16_abc' } })
        assert.equal(p.v16, true)
    })

    test('with no cause, the record type stands in for it, without its namespace', () => {
        const p = toPoint({ '@_id': '6', situationRecord: [{ '@_type': 'sit:AbnormalTraffic' }] })
        assert.equal(p.cause, 'AbnormalTraffic')
    })
})
