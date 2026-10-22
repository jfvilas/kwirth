import { IInstanceMessage } from '@kwirthmagnify/kwirth-common'

/*
    The shapes the flight-status provider publishes (providers/flight-status/src/common/FlightStatus.ts),
    copied here and reduced to what the map reads: a plugin cannot import from another package's sources.
*/

export interface IBBox {
    lamin: number
    lomin: number
    lamax: number
    lomax: number
}

export interface IAirportRef {
    icao?: string
    iata?: string
    name?: string
}

export interface IFlightDetails {
    callsign: string
    flightIata?: string
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
    source: string
}

export interface IAircraft {
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
    lastContact: number
    source: string
    /** only on watched callsigns; null when no source knows the flight */
    details?: IFlightDetails | null
}

/** What the instance setup decides: it is exactly the provider's subscription payload. */
export interface IFlightMapInstanceConfig {
    bbox: IBBox
    intervalSec: number
    /** ICAO callsigns as the aircraft broadcast them (IBE3171, not IB3171) */
    watch: string[]
}

export enum EFlightMapPayload {
    POSITIONS = 'positions',
    ERROR = 'error'
}

export interface IFlightMapMessageResponse extends IInstanceMessage {
    msgtype: 'flightmapmessageresponse'
    payloadType: EFlightMapPayload
    timestamp: string
    aircraft?: IAircraft[]
    error?: string
}

export const FLIGHT_STATUS_PROVIDER_ID = 'flight-status'
