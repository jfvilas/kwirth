import {
    EFlightCapability, EFlightPriority, EFlightSourceId, EQuotaExhaustedKind, IAircraftPosition, IBBox, IBreakerState,
    IFlightDetails, ISourceStatus
} from '../../common/FlightStatus'
import { TtlCache } from './cache'
import { IQuotaManager } from './quota'
import { IFlightSource, QuotaExhaustedError } from './types'

export interface IFlightProviderOptions {
    sources: IFlightSource[]
    quota: IQuotaManager
    positionTtlMs?: number
    detailsTtlMs?: number
    negativeTtlMs?: number // cache of "flight not found", not to burn quota asking again
    gridDeg?: number // grid the bbox is snapped to, so that nearby subscribers share cache
}

export class NoSourceAvailableError extends Error {}

/*
    Picks a source for every call, under quota and circuit breaker, and caches the answers. It is rebuilt
    on every configuration change; the quota manager is handed in from outside so that it survives.
*/
export class FlightProvider {
    private positions = new TtlCache<IAircraftPosition[]>(500)
    private details = new TtlCache<IFlightDetails | null>(5000)
    private breakers = new Map<EFlightSourceId, IBreakerState>()
    private readonly positionTtlMs: number
    private readonly detailsTtlMs: number
    private readonly negativeTtlMs: number
    private readonly gridDeg: number

    constructor(private readonly opts: IFlightProviderOptions) {
        this.positionTtlMs = opts.positionTtlMs ?? 15_000
        this.detailsTtlMs = opts.detailsTtlMs ?? 12 * 3600_000
        this.negativeTtlMs = opts.negativeTtlMs ?? 3600_000
        this.gridDeg = opts.gridDeg ?? 0.5
        for (const s of opts.sources) {
            s.onRemaining = (remaining: number) => opts.quota.sync(s.id, s.quota, s.quota.limit - remaining)
        }
    }

    /** Live positions. The bbox is widened to the grid so that nearby subscribers share cache. */
    async getPositions(bbox: IBBox, priority: EFlightPriority = EFlightPriority.BACKGROUND): Promise<IAircraftPosition[]> {
        const g = this.gridDeg
        const snapped: IBBox = {
            lamin: Math.floor(bbox.lamin / g) * g,
            lomin: Math.floor(bbox.lomin / g) * g,
            lamax: Math.ceil(bbox.lamax / g) * g,
            lomax: Math.ceil(bbox.lomax / g) * g,
        }
        const key = `${snapped.lamin},${snapped.lomin},${snapped.lamax},${snapped.lomax}`
        const all = await this.positions.getOrLoad(
            key,
            async () => (await this.run(EFlightCapability.POSITIONS, snapped, priority, s => s.getPositions!(snapped))) ?? [],
            () => this.positionTtlMs,
        )
        return all.filter(p => p.lat >= bbox.lamin && p.lat <= bbox.lamax && p.lon >= bbox.lomin && p.lon <= bbox.lomax)
    }

    /** On-demand enrichment (a selected aircraft or the watch list), never for the whole bbox. */
    getDetails(callsign: string, priority: EFlightPriority = EFlightPriority.INTERACTIVE): Promise<IFlightDetails | null> {
        const cs = callsign.trim().toUpperCase()
        return this.details.getOrLoad(
            cs,
            () => this.run(EFlightCapability.DETAILS, cs, priority, s => s.getDetails!(cs)),
            v => (v ? this.detailsTtlMs : this.negativeTtlMs),
        )
    }

    sourceIds(): EFlightSourceId[] {
        return this.opts.sources.map(s => s.id)
    }

    /** Quota and breaker state of every source, for the configuration dialog. */
    status(): ISourceStatus[] {
        return this.opts.sources.map(s => ({
            ...this.opts.quota.snapshot(s.id, s.quota),
            breaker: this.breakers.get(s.id) ?? null,
        }))
    }

    // Sorted by relative remaining quota: load spreads across sources naturally
    private candidates(cap: EFlightCapability): IFlightSource[] {
        const q = this.opts.quota
        return this.opts.sources
            .filter(s => s.capabilities.includes(cap))
            .sort((a, b) => q.remainingRatio(b.id, b.quota) - q.remainingRatio(a.id, a.quota))
    }

    private async run<T>(cap: EFlightCapability, arg: unknown, priority: EFlightPriority, call: (s: IFlightSource) => Promise<T | null>): Promise<T | null> {
        const now = Date.now()
        const errors: string[] = []
        let answered = false

        for (const s of this.candidates(cap)) {
            const b = this.breakers.get(s.id)
            if (b && b.openUntil > now) continue
            const cost = s.costOf(cap, arg)
            if (!this.opts.quota.canSpend(s.id, s.quota, cost, priority)) continue

            this.opts.quota.spend(s.id, s.quota, cost) // counted BEFORE calling: better safe than sorry
            try {
                const result = await call(s)
                this.breakers.delete(s.id)
                if (result !== null) return result
                answered = true // this source does not know the flight: try the next one
            }
            catch (err) {
                errors.push(err instanceof Error ? err.message : String(err))
                this.trip(s, err)
            }
        }
        if (answered) return null
        throw new NoSourceAvailableError(`${cap}: no sources available${errors.length > 0 ? ` (${errors.join('; ')})` : ''}`)
    }

    private trip(s: IFlightSource, err: unknown): void {
        const b = this.breakers.get(s.id) ?? { failures: 0, openUntil: 0 }
        b.failures++
        b.lastError = err instanceof Error ? err.message : String(err)
        if (err instanceof QuotaExhaustedError) {
            if (err.kind === EQuotaExhaustedKind.PERIOD) this.opts.quota.markExhausted(s.id, s.quota)
            b.openUntil = Date.now() + (err.retryAfterSec ?? 60) * 1000
        }
        else {
            // Exponential backoff, from 1 minute up to 30
            b.openUntil = Date.now() + Math.min(60_000 * 2 ** (b.failures - 1), 30 * 60_000)
        }
        this.breakers.set(s.id, b)
    }
}
