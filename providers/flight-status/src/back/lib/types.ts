import {
    EFlightCapability, EFlightSourceId, EQuotaExhaustedKind, EQuotaPeriod, IAircraftPosition, IBBox, IFlightDetails
} from '../../common/FlightStatus'

export interface IQuotaSpec {
    period: EQuotaPeriod
    limit: number // requests, credits or money, whatever the source bills in
    reserveRatio?: number // share kept for interactive requests
}

export interface IFlightSource {
    readonly id: EFlightSourceId
    readonly capabilities: EFlightCapability[]
    readonly quota: IQuotaSpec
    /** Set by the FlightProvider when the source reports its real remaining quota. */
    onRemaining?: (remaining: number) => void
    costOf(cap: EFlightCapability, arg: unknown): number
    getPositions?(bbox: IBBox): Promise<IAircraftPosition[]>
    getDetails?(callsign: string): Promise<IFlightDetails | null>
}

export class QuotaExhaustedError extends Error {
    constructor(
        public readonly sourceId: EFlightSourceId,
        public readonly kind: EQuotaExhaustedKind,
        public readonly retryAfterSec?: number,
    ) {
        super(`${sourceId}: ${kind === EQuotaExhaustedKind.PERIOD ? 'quota exhausted' : 'rate limited'}`)
    }
}

export class SourceHttpError extends Error {
    constructor(public readonly sourceId: EFlightSourceId, public readonly status: number, detail?: string) {
        super(`${sourceId}: HTTP ${status}${detail ? ` - ${detail.slice(0, 200)}` : ''}`)
    }
}

/** Upstream APIs send null for "unknown"; the model uses undefined. */
export const orUndefined = <T>(v: T | null | undefined): T | undefined => v ?? undefined

export const HTTP_TIMEOUT_MS = 15_000
