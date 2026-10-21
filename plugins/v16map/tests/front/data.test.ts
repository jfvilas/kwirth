import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { applyMessage, humanize, placeOf, V16MapData } from '../../src/front/V16MapData'
import { fitZoom, project, unproject } from '../../src/front/TileMath'
import { EV16MapPayload, IV16MapMessageResponse, IV16Point } from '../../src/common/V16MapTypes'

const point = (id: string, over: Partial<IV16Point> = {}): IV16Point => ({ id, lat: 40, lon: -3, v16: false, ...over })

const message = (payloadType: EV16MapPayload, added: IV16Point[] = [], updated: IV16Point[] = [], removed: string[] = []): IV16MapMessageResponse =>
    ({ payloadType, added, updated, removed, at: 1000 } as unknown as IV16MapMessageResponse)

describe('applyMessage', () => {
    test('a snapshot replaces whatever the tab had', () => {
        const data = new V16MapData()
        data.points = { old: point('old') }
        applyMessage(data, message(EV16MapPayload.SNAPSHOT, [point('a'), point('b')]))
        assert.deepEqual(Object.keys(data.points).sort(), ['a', 'b'])
        assert.equal(data.lastUpdate, 1000)
    })

    test('changes add, update and remove, and are counted for the header', () => {
        const data = new V16MapData()
        applyMessage(data, message(EV16MapPayload.SNAPSHOT, [point('a'), point('b', { road: 'A-1' })]))
        applyMessage(data, message(EV16MapPayload.CHANGES, [point('c')], [point('b', { road: 'A-2' })], ['a']))
        assert.deepEqual(Object.keys(data.points).sort(), ['b', 'c'])
        assert.equal(data.points.b.road, 'A-2')
        assert.deepEqual(data.lastChanges, { added: 1, updated: 1, removed: 1 })
    })

    test('a snapshot does not touch the change counters', () => {
        const data = new V16MapData()
        applyMessage(data, message(EV16MapPayload.SNAPSHOT, [point('a')]))
        assert.deepEqual(data.lastChanges, { added: 0, updated: 0, removed: 0 })
    })

    test('the selection goes away with its situation', () => {
        const data = new V16MapData()
        applyMessage(data, message(EV16MapPayload.SNAPSHOT, [point('a'), point('b')]))
        data.selectedId = 'a'
        applyMessage(data, message(EV16MapPayload.CHANGES, [], [], ['b']))
        assert.equal(data.selectedId, 'a')
        applyMessage(data, message(EV16MapPayload.CHANGES, [], [], ['a']))
        assert.equal(data.selectedId, undefined)
    })
})

describe('texts', () => {
    test('humanize splits camel case', () => {
        assert.equal(humanize('vehicleObstruction'), 'Vehicle obstruction')
        assert.equal(humanize('roadworks'), 'Roadworks')
        assert.equal(humanize(undefined), '')
    })

    test('placeOf joins what there is', () => {
        assert.equal(placeOf(point('a', { road: 'A-4', km: '404.821', municipality: 'Córdoba', province: 'Córdoba' })), 'A-4 km 404.8 · Córdoba · Córdoba')
        assert.equal(placeOf(point('a', { road: 'N-400' })), 'N-400')
        assert.equal(placeOf(point('a', { province: 'Toledo' })), 'Toledo')
        assert.equal(placeOf(point('a')), '')
    })
})

describe('tile math', () => {
    test('the origin of the world is the top left corner', () => {
        const p = project(85.05112878, -180, 0)
        assert.ok(Math.abs(p.x) < 1e-6)
        assert.ok(Math.abs(p.y) < 0.01)
    })

    test('lat 0, lon 0 is the centre of the world at any zoom', () => {
        assert.deepEqual(project(0, 0, 3), { x: 1024, y: 1024 })
    })

    test('unproject undoes project', () => {
        const p = project(37.85428, -4.779133, 12)
        const back = unproject(p.x, p.y, 12)
        assert.ok(Math.abs(back.lat - 37.85428) < 1e-9)
        assert.ok(Math.abs(back.lon + 4.779133) < 1e-9)
    })

    test('fitZoom picks the highest zoom where the box fits', () => {
        const spain = { lamin: 27.5, lomin: -18.3, lamax: 43.9, lomax: 4.4 }
        const z = fitZoom(spain, 900, 600)
        const width = (b: number) => project(spain.lamin, spain.lomax, b).x - project(spain.lamax, spain.lomin, b).x
        assert.ok(width(z) <= 900)
        assert.ok(width(z + 1) > 900)
    })

    test('fitZoom never goes below the minimum', () => {
        assert.equal(fitZoom({ lamin: -80, lomin: -180, lamax: 80, lomax: 180 }, 10, 10), 2)
    })
})
