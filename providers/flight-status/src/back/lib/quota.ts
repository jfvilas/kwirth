import { EFlightPriority, EFlightSourceId, EQuotaPeriod, IQuotaSnapshot } from '../../common/FlightStatus'
import { IQuotaSpec } from './types'

export interface IQuotaManager {
    snapshot(sourceId: EFlightSourceId, spec: IQuotaSpec, now?: Date): IQuotaSnapshot
    canSpend(sourceId: EFlightSourceId, spec: IQuotaSpec, cost: number, priority: EFlightPriority, now?: Date): boolean
    remainingRatio(sourceId: EFlightSourceId, spec: IQuotaSpec, now?: Date): number
    spend(sourceId: EFlightSourceId, spec: IQuotaSpec, cost: number, now?: Date): void
    sync(sourceId: EFlightSourceId, spec: IQuotaSpec, used: number, now?: Date): void
    markExhausted(sourceId: EFlightSourceId, spec: IQuotaSpec, now?: Date): void
}

const DAY_MS = 86_400_000

interface IPeriodBounds {
    key: string
    start: number
    end: number
    slices: number // burst margin: one day of budget on monthly quotas, one hour on daily ones
}

// Periods in UTC.
const periodBounds = (spec: IQuotaSpec, now: Date): IPeriodBounds => {
    const y = now.getUTCFullYear()
    const m = now.getUTCMonth()
    switch (spec.period) {
        case EQuotaPeriod.DAY: {
            const start = Date.UTC(y, m, now.getUTCDate())
            return { key: now.toISOString().slice(0, 10), start, end: start + DAY_MS, slices: 24 }
        }
        case EQuotaPeriod.MONTH: {
            const start = Date.UTC(y, m, 1)
            const end = Date.UTC(y, m + 1, 1)
            return { key: now.toISOString().slice(0, 7), start, end, slices: Math.round((end - start) / DAY_MS) }
        }
    }
}

interface IUsage {
    period: string
    used: number
    exhausted: boolean
}

interface IUsageState {
    rec: IUsage
    allowedNow: number
}

export interface IMemoryQuotaOptions {
    /*
        After a start nobody knows how much was spent before. With this the manager assumes it was going
        at the planned pace: background work carries on the same and only the reserve already "consumed"
        is given up. Without it, every pod restart hands out the whole month again.
    */
    assumeOnSchedule?: boolean
}

/*
    In-memory quota accounting. Spending is spread continuously across the period: at any moment, what
    background work has spent cannot exceed the elapsed share of the period plus a burst margin.
    Interactive requests may draw on the reserve.
*/
export class MemoryQuotaManager implements IQuotaManager {
    private usage = new Map<EFlightSourceId, IUsage>()

    constructor(private readonly opts: IMemoryQuotaOptions = {}) {}

    private state(sourceId: EFlightSourceId, spec: IQuotaSpec, now: Date): IUsageState {
        const b = periodBounds(spec, now)
        const usable = spec.limit * (1 - (spec.reserveRatio ?? 0))
        const elapsed = Math.min(1, Math.max(0, (now.getTime() - b.start) / (b.end - b.start)))
        const allowedNow = Math.min(usable, usable * elapsed + usable / b.slices)
        let rec = this.usage.get(sourceId)
        if (!rec || rec.period !== b.key) {
            // Only the very first period is assumed on schedule: a period change starts from zero for real
            const assumed = !rec && this.opts.assumeOnSchedule ? usable * elapsed : 0
            rec = { period: b.key, used: assumed, exhausted: false }
            this.usage.set(sourceId, rec)
        }
        return { rec, allowedNow }
    }

    snapshot(sourceId: EFlightSourceId, spec: IQuotaSpec, now = new Date()): IQuotaSnapshot {
        const { rec, allowedNow } = this.state(sourceId, spec, now)
        return { sourceId, period: rec.period, used: rec.used, limit: spec.limit, allowedNow, exhausted: rec.exhausted }
    }

    canSpend(sourceId: EFlightSourceId, spec: IQuotaSpec, cost: number, priority: EFlightPriority, now = new Date()): boolean {
        const { rec, allowedNow } = this.state(sourceId, spec, now)
        if (rec.exhausted || rec.used + cost > spec.limit) return false
        if (priority === EFlightPriority.INTERACTIVE) return true
        return rec.used + cost <= allowedNow
    }

    remainingRatio(sourceId: EFlightSourceId, spec: IQuotaSpec, now = new Date()): number {
        const { rec } = this.state(sourceId, spec, now)
        return rec.exhausted ? 0 : Math.max(0, 1 - rec.used / spec.limit)
    }

    spend(sourceId: EFlightSourceId, spec: IQuotaSpec, cost: number, now = new Date()): void {
        this.state(sourceId, spec, now).rec.used += cost
    }

    /** Aligns the counter with the real one when the API exposes it (OpenSky headers). */
    sync(sourceId: EFlightSourceId, spec: IQuotaSpec, used: number, now = new Date()): void {
        this.state(sourceId, spec, now).rec.used = Math.max(0, used)
    }

    markExhausted(sourceId: EFlightSourceId, spec: IQuotaSpec, now = new Date()): void {
        this.state(sourceId, spec, now).rec.exhausted = true
    }
}
