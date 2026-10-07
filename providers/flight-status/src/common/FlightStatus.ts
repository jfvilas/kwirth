/*
    Contract shared by the back and the front of the 'flight-status' provider: data model, provider
    configuration, subscription payload and the events subscribers receive.
*/

export const PROVIDER_ID = 'flight-status'

// ── Enums ───────────────────────────────────────────────────────────────────

/** What a source can answer. */
export enum EFlightCapability {
    POSITIONS = 'positions',
    DETAILS = 'details'
}

/** Background work is paced across the quota period; interactive requests may use the reserve. */
export enum EFlightPriority {
    INTERACTIVE = 'interactive',
    BACKGROUND = 'background'
}

/** Accounting period of a source quota, in UTC. */
export enum EQuotaPeriod {
    DAY = 'day',
    MONTH = 'month'
}

/** Why a source refused a call: the period budget is gone, or it is only a short-term rate limit. */
export enum EQuotaExhaustedKind {
    PERIOD = 'period',
    RATE = 'rate'
}

export enum EFlightSourceId {
    OPENSKY = 'opensky',
    AVIATIONSTACK = 'aviationstack',
    AEROAPI = 'aeroapi'
}

export enum EFlightStatusEventType {
    POSITIONS = 'positions',
    ERROR = 'error'
}

/** Storage entries: the public half goes to a ConfigMap, the credentials to a Secret. */
export enum EFlightStatusStorageKey {
    CONFIG = 'flight-status-config',
    CREDS = 'flight-status-creds'
}

// ── Data model ──────────────────────────────────────────────────────────────

export interface IBBox {
    lamin: number
    lomin: number
    lamax: number
    lomax: number
}

export interface IAircraftPosition {
    icao24: string
    callsign?: string
    originCountry?: string
    lat: number
    lon: number
    baroAltitudeM?: number
    geoAltitudeM?: number
    onGround: boolean
    velocityMs?: number
    trackDeg?: number
    verticalRateMs?: number
    squawk?: string
    lastContact: number // epoch, in seconds
    source: EFlightSourceId
}

export interface IAirportRef {
    icao?: string
    iata?: string
    name?: string
}

export interface IFlightDetails {
    callsign: string
    flightIata?: string
    flightIcao?: string
    airline?: string
    origin?: IAirportRef
    destination?: IAirportRef
    status?: string
    scheduledDeparture?: string
    actualDeparture?: string
    scheduledArrival?: string
    estimatedArrival?: string
    departureDelayMin?: number
    arrivalDelayMin?: number
    aircraftType?: string
    registration?: string
    source: EFlightSourceId
    fetchedAt: string
}

/** An aircraft of a positions event. Watched callsigns carry 'details' (null when no source knows the flight). */
export interface IWatchedAircraft extends IAircraftPosition {
    details?: IFlightDetails | null
}

// ── Provider configuration ──────────────────────────────────────────────────

export interface IOpenSkyConfig {
    clientId: string
    clientSecret: string
    dailyCredits: number // 0 = automatic (400 anonymous / 4000 with credentials)
}

export interface IAviationStackConfig {
    enabled: boolean
    accessKey: string
    monthlyRequests: number
}

export interface IAeroApiConfig {
    enabled: boolean
    apiKey: string
    monthlyBudgetUsd: number
    costPerCallUsd: number
}

/** What GET /config returns and PUT /config receives, credentials included. */
export interface IFlightStatusConfig {
    opensky: IOpenSkyConfig
    aviationstack: IAviationStackConfig
    aeroapi: IAeroApiConfig
    positionTtlSec: number
    detailsTtlHours: number
}

export const defaultFlightStatusConfig = (): IFlightStatusConfig => ({
    opensky: { clientId: '', clientSecret: '', dailyCredits: 0 },
    aviationstack: { enabled: false, accessKey: '', monthlyRequests: 100 },
    aeroapi: { enabled: false, apiKey: '', monthlyBudgetUsd: 5, costPerCallUsd: 0.005 },
    positionTtlSec: 15,
    detailsTtlHours: 12,
})

// ── Subscription and events ─────────────────────────────────────────────────

export const MIN_INTERVAL_SEC = 10
export const DEFAULT_INTERVAL_SEC = 30

export interface IFlightStatusSubscription {
    bbox: IBBox
    intervalSec: number
    watch: string[] // ICAO callsigns to enrich (origin, destination, times)
}

export interface IFlightStatusPositionsEvent {
    type: EFlightStatusEventType.POSITIONS
    timestamp: string
    bbox: IBBox
    aircraft: IWatchedAircraft[]
}

export interface IFlightStatusErrorEvent {
    type: EFlightStatusEventType.ERROR
    timestamp: string
    message: string
}

export type TFlightStatusEvent = IFlightStatusPositionsEvent | IFlightStatusErrorEvent

// ── Quota status (GET /status) ──────────────────────────────────────────────

export interface IQuotaSnapshot {
    sourceId: EFlightSourceId
    period: string
    used: number
    limit: number
    allowedNow: number // what the planned pace allows to have spent by now
    exhausted: boolean
}

export interface IBreakerState {
    failures: number
    openUntil: number
    lastError?: string
}

export interface ISourceStatus extends IQuotaSnapshot {
    breaker: IBreakerState | null
}
