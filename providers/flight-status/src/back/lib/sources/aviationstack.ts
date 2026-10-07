import { EFlightCapability, EFlightSourceId, EQuotaExhaustedKind, EQuotaPeriod, IFlightDetails } from '../../../common/FlightStatus'
import { HTTP_TIMEOUT_MS, IFlightSource, IQuotaSpec, QuotaExhaustedError, SourceHttpError, orUndefined } from '../types'

// The free plan has historically not allowed HTTPS: the key travels in clear in the query string.
const DEFAULT_BASE = 'http://api.aviationstack.com/v1'

interface IAsEndpoint {
    airport?: string | null
    iata?: string | null
    icao?: string | null
    scheduled?: string | null
    estimated?: string | null
    actual?: string | null
    delay?: number | null
}

interface IAsAirline {
    name?: string | null
}

interface IAsFlightCode {
    iata?: string | null
    icao?: string | null
}

interface IAsAircraft {
    registration?: string | null
    icao?: string | null
}

interface IAsFlight {
    flight_status?: string
    departure: IAsEndpoint
    arrival: IAsEndpoint
    airline?: IAsAirline | null
    flight?: IAsFlightCode | null
    aircraft?: IAsAircraft | null
}

interface IAsError {
    code?: string
}

interface IAsResponse {
    data?: IAsFlight[]
    error?: IAsError
}

export interface IAviationStackOptions {
    accessKey: string
    baseUrl?: string
    monthlyRequests?: number
}

/** Flight enrichment (route, times, delays). About 100 requests a month on the free plan. */
export class AviationStackSource implements IFlightSource {
    readonly id = EFlightSourceId.AVIATIONSTACK
    readonly capabilities: EFlightCapability[] = [EFlightCapability.DETAILS]
    readonly quota: IQuotaSpec

    constructor(private readonly opts: IAviationStackOptions) {
        this.quota = { period: EQuotaPeriod.MONTH, limit: opts.monthlyRequests ?? 100, reserveRatio: 0.2 }
    }

    costOf(): number {
        return 1
    }

    async getDetails(callsign: string): Promise<IFlightDetails | null> {
        const qs = new URLSearchParams({ access_key: this.opts.accessKey, flight_icao: callsign })
        const res = await fetch(`${this.opts.baseUrl ?? DEFAULT_BASE}/flights?${qs}`, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })
        const j = (await res.json().catch(() => ({}))) as IAsResponse

        if (j.error) {
            if (j.error.code === 'usage_limit_reached') throw new QuotaExhaustedError(this.id, EQuotaExhaustedKind.PERIOD)
            if (j.error.code === 'rate_limit_reached') throw new QuotaExhaustedError(this.id, EQuotaExhaustedKind.RATE, 60)
            throw new SourceHttpError(this.id, res.status, j.error.code)
        }
        if (!res.ok) throw new SourceHttpError(this.id, res.status)

        const flights = j.data ?? []
        const f = flights.find(x => x.flight_status === 'active') ?? flights[0]
        if (!f) return null

        return {
            callsign,
            flightIata: orUndefined(f.flight?.iata),
            flightIcao: orUndefined(f.flight?.icao),
            airline: orUndefined(f.airline?.name),
            origin: { icao: orUndefined(f.departure.icao), iata: orUndefined(f.departure.iata), name: orUndefined(f.departure.airport) },
            destination: { icao: orUndefined(f.arrival.icao), iata: orUndefined(f.arrival.iata), name: orUndefined(f.arrival.airport) },
            status: f.flight_status,
            scheduledDeparture: orUndefined(f.departure.scheduled),
            actualDeparture: orUndefined(f.departure.actual),
            scheduledArrival: orUndefined(f.arrival.scheduled),
            estimatedArrival: orUndefined(f.arrival.estimated),
            departureDelayMin: orUndefined(f.departure.delay),
            arrivalDelayMin: orUndefined(f.arrival.delay),
            aircraftType: orUndefined(f.aircraft?.icao),
            registration: orUndefined(f.aircraft?.registration),
            source: this.id,
            fetchedAt: new Date().toISOString(),
        }
    }
}
