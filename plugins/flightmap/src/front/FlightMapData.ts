import { EFlightMapPayload, IAircraft, IBBox, IFlightMapInstanceConfig, IFlightMapMessageResponse } from '../common/FlightMapTypes'

export interface IFlightMapData {
    aircraft: IAircraft[]
    /** ISO time of the last positions the provider sent, empty until the first one */
    timestamp: string
    /** last error the provider reported; cleared by the next positions */
    error: string
    signals: string[]
    started: boolean
    selectedId?: string
}

export class FlightMapData implements IFlightMapData {
    aircraft: IAircraft[] = []
    timestamp = ''
    error = ''
    signals: string[] = []
    started = false
    selectedId?: string
}

export interface IArea {
    name: string
    bbox: IBBox
}

/*
    The OpenSky cost of a call grows with the area of the box (1 credit up to 25 square degrees, 3 up to
    400). Anonymous access gets 400 credits a day, so the suggested interval is the one that fits a day.
*/
export const AREAS: IArea[] = [
    { name: 'Iberian peninsula', bbox: { lamin: 36.0, lomin: -9.5, lamax: 43.8, lomax: 3.3 } },
    { name: 'Madrid', bbox: { lamin: 39.8, lomin: -4.4, lamax: 41.0, lomax: -3.0 } },
    { name: 'Barcelona', bbox: { lamin: 40.9, lomin: 1.4, lamax: 41.9, lomax: 2.9 } },
    { name: 'Canary Islands', bbox: { lamin: 27.4, lomin: -18.4, lamax: 29.5, lomax: -13.3 } },
    { name: 'Balearic Islands', bbox: { lamin: 38.5, lomin: 1.1, lamax: 40.2, lomax: 4.5 } },
]

export class FlightMapInstanceConfig implements IFlightMapInstanceConfig {
    bbox = { ...AREAS[0].bbox }
    intervalSec = 720
    watch: string[] = []
}

/** The provider widens every box to a 0.5° grid before calling OpenSky, and pays for the widened one. */
const snapped = (b: IBBox): IBBox => ({
    lamin: Math.floor(b.lamin * 2) / 2, lomin: Math.floor(b.lomin * 2) / 2,
    lamax: Math.ceil(b.lamax * 2) / 2, lomax: Math.ceil(b.lomax * 2) / 2
})

export const squareDegrees = (b: IBBox): number => (b.lamax - b.lamin) * (b.lomax - b.lomin)

/** OpenSky credits per /states/all call for a box of that area */
export const creditsPerCall = (b: IBBox): number => {
    const area = squareDegrees(snapped(b))
    if (area <= 25) return 1
    if (area <= 100) return 2
    if (area <= 400) return 3
    return 4
}

export const applyMessage = (data: IFlightMapData, msg: IFlightMapMessageResponse): void => {
    if (msg.payloadType === EFlightMapPayload.ERROR) {
        data.error = msg.error ?? 'Unknown error'
        return
    }
    data.aircraft = msg.aircraft ?? []
    data.timestamp = msg.timestamp
    data.error = ''
    if (data.selectedId && !data.aircraft.some(a => a.icao24 === data.selectedId)) data.selectedId = undefined
}

export const isWatched = (a: IAircraft, watch: string[]): boolean =>
    Boolean(a.callsign) && watch.some(w => w.toUpperCase() === a.callsign!.trim().toUpperCase())

export const feet = (m?: number): string => m === undefined ? '-' : `${Math.round(m * 3.28084).toLocaleString()} ft`
export const knots = (ms?: number): string => ms === undefined ? '-' : `${Math.round(ms * 1.94384)} kt`
