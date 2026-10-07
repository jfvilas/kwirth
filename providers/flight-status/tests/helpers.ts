import { IProviderStorage } from '@kwirthmagnify/kwirth-common-back'
import { EFlightCapability, EFlightSourceId, EQuotaPeriod, IAircraftPosition, IBBox, IFlightDetails } from '../src/common/FlightStatus'
import { IFlightSource, IQuotaSpec } from '../src/back/lib/types'

export const aircraft = (icao24: string, lat: number, lon: number, callsign?: string): IAircraftPosition => ({
    icao24, callsign, lat, lon, onGround: false, lastContact: 1_700_000_000, source: EFlightSourceId.OPENSKY
})

export const details = (callsign: string, source: EFlightSourceId): IFlightDetails => ({
    callsign, flightIata: 'IB3171', source, fetchedAt: '2026-09-26T00:00:00.000Z'
})

type TPositionsFn = (bbox: IBBox) => Promise<IAircraftPosition[]>
type TDetailsFn = (callsign: string) => Promise<IFlightDetails | null>

/** A scripted source that records every call it gets. */
export class FakeSource implements IFlightSource {
    readonly capabilities: EFlightCapability[]
    readonly quota: IQuotaSpec
    onRemaining?: (remaining: number) => void
    positionCalls: IBBox[] = []
    detailCalls: string[] = []

    constructor(
        readonly id: EFlightSourceId,
        private readonly positionsFn?: TPositionsFn,
        private readonly detailsFn?: TDetailsFn,
        limit = 1000,
        private readonly cost = 1,
    ) {
        this.capabilities = [
            ...(positionsFn ? [EFlightCapability.POSITIONS] : []),
            ...(detailsFn ? [EFlightCapability.DETAILS] : []),
        ]
        this.quota = { period: EQuotaPeriod.DAY, limit }
    }

    costOf(): number {
        return this.cost
    }

    getPositions = async (bbox: IBBox): Promise<IAircraftPosition[]> => {
        this.positionCalls.push(bbox)
        return this.positionsFn!(bbox)
    }

    getDetails = async (callsign: string): Promise<IFlightDetails | null> => {
        this.detailCalls.push(callsign)
        return this.detailsFn!(callsign)
    }
}

interface IStorageWrite {
    id: string
    secret: boolean
    data: unknown
}

/** In-memory IProviderStorage: ConfigMap and Secret halves kept apart, as the core does. */
export class FakeStorage implements IProviderStorage {
    configMap = new Map<string, unknown>()
    secret = new Map<string, unknown>()
    writes: IStorageWrite[] = []

    writeStorage = async (id: string, secret: boolean, data: unknown): Promise<void> => {
        this.writes.push({ id, secret, data })
        ;(secret ? this.secret : this.configMap).set(id, structuredClone(data))
    }

    readStorage = async (id: string, secret: boolean): Promise<unknown> => {
        const v = (secret ? this.secret : this.configMap).get(id)
        return v === undefined ? undefined : structuredClone(v)
    }

    writeStorageCommon = async (): Promise<void> => {}
    readStorageCommon = async (): Promise<unknown> => undefined
}

type TFetchHandler = (url: string, init?: RequestInit) => Response | Promise<Response>

/** Replaces global fetch for the duration of one test; returns the restore function and the recorded calls. */
export const mockFetch = (handler: TFetchHandler) => {
    const original = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        calls.push(url)
        return handler(url, init)
    }) as typeof fetch
    return { calls, restore: () => { globalThis.fetch = original } }
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
