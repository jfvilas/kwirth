import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EFlightPriority, EFlightSourceId, EQuotaPeriod } from '../src/common/FlightStatus'
import { MemoryQuotaManager } from '../src/back/lib/quota'
import { IQuotaSpec } from '../src/back/lib/types'

const ID = EFlightSourceId.AVIATIONSTACK
// September has 30 days: every day is exactly 1/30 of the month.
const MONTH: IQuotaSpec = { period: EQuotaPeriod.MONTH, limit: 300, reserveRatio: 0.2 }
const DAY: IQuotaSpec = { period: EQuotaPeriod.DAY, limit: 240 }
const at = (iso: string) => new Date(iso)

test('snapshot: a fresh manager without assumeOnSchedule starts at zero', () => {
    const q = new MemoryQuotaManager()
    const s = q.snapshot(ID, MONTH, at('2026-09-16T00:00:00Z'))
    assert.equal(s.sourceId, ID)
    assert.equal(s.period, '2026-09')
    assert.equal(s.used, 0)
    assert.equal(s.limit, 300)
    // usable = 240; half the month elapsed → 120, plus one day of burst (240/30 = 8)
    assert.equal(s.allowedNow, 128)
    assert.equal(s.exhausted, false)
})

test('assumeOnSchedule: the first period starts as if it had been spent at the planned pace', () => {
    const q = new MemoryQuotaManager({ assumeOnSchedule: true })
    assert.equal(q.snapshot(ID, MONTH, at('2026-09-16T00:00:00Z')).used, 120)
})

test('assumeOnSchedule: a period change starts from zero for real', () => {
    const q = new MemoryQuotaManager({ assumeOnSchedule: true })
    q.snapshot(ID, MONTH, at('2026-09-16T00:00:00Z'))
    const s = q.snapshot(ID, MONTH, at('2026-10-16T00:00:00Z'))
    assert.equal(s.period, '2026-10')
    assert.equal(s.used, 0)
})

test('canSpend: background is paced, interactive may use the reserve, nobody passes the limit', () => {
    const q = new MemoryQuotaManager()
    const now = at('2026-09-01T00:00:00Z') // start of month: only the burst margin (8) is paced in
    assert.equal(q.canSpend(ID, MONTH, 8, EFlightPriority.BACKGROUND, now), true)
    assert.equal(q.canSpend(ID, MONTH, 9, EFlightPriority.BACKGROUND, now), false)
    assert.equal(q.canSpend(ID, MONTH, 9, EFlightPriority.INTERACTIVE, now), true)
    assert.equal(q.canSpend(ID, MONTH, 301, EFlightPriority.INTERACTIVE, now), false)
})

test('spend and remainingRatio', () => {
    const q = new MemoryQuotaManager()
    const now = at('2026-09-10T00:00:00Z')
    q.spend(ID, MONTH, 75, now)
    assert.equal(q.snapshot(ID, MONTH, now).used, 75)
    assert.equal(q.remainingRatio(ID, MONTH, now), 0.75)
})

test('sync aligns the counter with the real one, never below zero', () => {
    const q = new MemoryQuotaManager()
    const now = at('2026-09-10T12:00:00Z')
    q.sync(ID, DAY, 100, now)
    assert.equal(q.snapshot(ID, DAY, now).used, 100)
    q.sync(ID, DAY, -5, now)
    assert.equal(q.snapshot(ID, DAY, now).used, 0)
})

test('markExhausted blocks every priority and zeroes the ratio until the next period', () => {
    const q = new MemoryQuotaManager()
    const now = at('2026-09-10T12:00:00Z')
    q.markExhausted(ID, DAY, now)
    assert.equal(q.canSpend(ID, DAY, 1, EFlightPriority.INTERACTIVE, now), false)
    assert.equal(q.remainingRatio(ID, DAY, now), 0)
    assert.equal(q.snapshot(ID, DAY, now).exhausted, true)
    assert.equal(q.canSpend(ID, DAY, 1, EFlightPriority.INTERACTIVE, at('2026-09-11T00:00:00Z')), true)
})

test('daily periods: key and a one-hour burst margin', () => {
    const q = new MemoryQuotaManager()
    const s = q.snapshot(ID, DAY, at('2026-09-10T06:00:00Z'))
    assert.equal(s.period, '2026-09-10')
    // a quarter of the day (60) plus one hour (10)
    assert.equal(s.allowedNow, 70)
})
