import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EFlightPriority, EFlightSourceId, EQuotaExhaustedKind } from '../src/common/FlightStatus'
import { FlightProvider, NoSourceAvailableError } from '../src/back/lib/flightProvider'
import { MemoryQuotaManager } from '../src/back/lib/quota'
import { QuotaExhaustedError } from '../src/back/lib/types'
import { FakeSource, aircraft, details } from './helpers'

const BBOX = { lamin: 40.2, lomin: -9.3, lamax: 43.8, lomax: -6.7 }

test('getPositions: snaps the bbox to the grid and filters back to the requested one', async () => {
    const inside = aircraft('a', 41, -8)
    const outsideRequested = aircraft('b', 40.1, -8) // inside the snapped box, outside the asked one
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => [inside, outsideRequested])
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager() })
    const result = await fp.getPositions(BBOX)
    assert.deepEqual(src.positionCalls, [{ lamin: 40, lomin: -9.5, lamax: 44, lomax: -6.5 }])
    assert.deepEqual(result, [inside])
})

test('getPositions: nearby bboxes and concurrent calls share one upstream call', async () => {
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => [aircraft('a', 41, -8)])
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager() })
    await Promise.all([fp.getPositions(BBOX), fp.getPositions({ ...BBOX, lamin: 40.3 }), fp.getPositions(BBOX)])
    assert.equal(src.positionCalls.length, 1)
})

test('getPositions: an expired cache entry is fetched again', async () => {
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => [])
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager(), positionTtlMs: 0 })
    await fp.getPositions(BBOX)
    await new Promise(r => setTimeout(r, 2))
    await fp.getPositions(BBOX)
    assert.equal(src.positionCalls.length, 2)
})

test('getDetails: falls through a source that does not know the flight, and caches by normalized callsign', async () => {
    const first = new FakeSource(EFlightSourceId.AVIATIONSTACK, undefined, async () => null)
    const second = new FakeSource(EFlightSourceId.AEROAPI, undefined, async cs => details(cs, EFlightSourceId.AEROAPI))
    const fp = new FlightProvider({ sources: [first, second], quota: new MemoryQuotaManager() })
    const d = await fp.getDetails(' ibe3171 ')
    assert.equal(d?.source, EFlightSourceId.AEROAPI)
    assert.equal(d?.callsign, 'IBE3171')
    await fp.getDetails('IBE3171')
    assert.equal(first.detailCalls.length + second.detailCalls.length, 2)
})

test('getDetails: when every source answers "unknown" the result is null and cached', async () => {
    const src = new FakeSource(EFlightSourceId.AVIATIONSTACK, undefined, async () => null)
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager() })
    assert.equal(await fp.getDetails('XXX1'), null)
    assert.equal(await fp.getDetails('XXX1'), null)
    assert.deepEqual(src.detailCalls, ['XXX1'])
})

test('run: an error trips the breaker, the source is skipped and the error is reported', async () => {
    let calls = 0
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => { calls++; throw new Error('boom') })
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager(), positionTtlMs: 0 })
    await assert.rejects(fp.getPositions(BBOX), (err: Error) => err instanceof NoSourceAvailableError && err.message === 'positions: no sources available (boom)')
    await assert.rejects(fp.getPositions(BBOX), (err: Error) => err.message === 'positions: no sources available')
    assert.equal(calls, 1)
    const [st] = fp.status()
    assert.equal(st.breaker?.failures, 1)
    assert.equal(st.breaker?.lastError, 'boom')
    assert.ok((st.breaker?.openUntil ?? 0) > Date.now() + 50_000)
})

test('run: a period QuotaExhaustedError marks the quota exhausted and honours retryAfter', async () => {
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => { throw new QuotaExhaustedError(EFlightSourceId.OPENSKY, EQuotaExhaustedKind.PERIOD, 5) })
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager() })
    await assert.rejects(fp.getPositions(BBOX))
    const [st] = fp.status()
    assert.equal(st.exhausted, true)
    assert.ok((st.breaker?.openUntil ?? 0) <= Date.now() + 5000)
})

test('run: a source over its paced budget is skipped for background but used for interactive', async () => {
    const src = new FakeSource(EFlightSourceId.AVIATIONSTACK, undefined, async cs => details(cs, EFlightSourceId.AVIATIONSTACK), 100, 90)
    const fp = new FlightProvider({ sources: [src], quota: new MemoryQuotaManager() })
    await assert.rejects(fp.getDetails('IBE1', EFlightPriority.BACKGROUND), NoSourceAvailableError)
    assert.equal(src.detailCalls.length, 0)
    assert.equal((await fp.getDetails('IBE1', EFlightPriority.INTERACTIVE))?.callsign, 'IBE1')
    assert.equal(fp.status()[0].used, 90)
})

test('candidates: the source with most relative quota left goes first', async () => {
    const quota = new MemoryQuotaManager()
    const a = new FakeSource(EFlightSourceId.AVIATIONSTACK, undefined, async cs => details(cs, EFlightSourceId.AVIATIONSTACK), 100)
    const b = new FakeSource(EFlightSourceId.AEROAPI, undefined, async cs => details(cs, EFlightSourceId.AEROAPI), 100)
    quota.spend(a.id, a.quota, 50)
    const fp = new FlightProvider({ sources: [a, b], quota })
    assert.equal((await fp.getDetails('IBE1', EFlightPriority.INTERACTIVE))?.source, EFlightSourceId.AEROAPI)
})

test('onRemaining from a source syncs the quota counter', () => {
    const quota = new MemoryQuotaManager()
    const src = new FakeSource(EFlightSourceId.OPENSKY, async () => [], undefined, 400)
    const fp = new FlightProvider({ sources: [src], quota })
    src.onRemaining?.(150)
    assert.equal(fp.status()[0].used, 250)
    assert.deepEqual(fp.sourceIds(), [EFlightSourceId.OPENSKY])
})
