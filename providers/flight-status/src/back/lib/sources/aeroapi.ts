import { EFlightCapability, EFlightSourceId, EQuotaExhaustedKind, EQuotaPeriod, IFlightDetails } from '../../../common/FlightStatus'
import { HTTP_TIMEOUT_MS, IFlightSource, IQuotaSpec, QuotaExhaustedError, SourceHttpError, orUndefined } from '../types'

const BASE = 'https://aeroapi.flightaware.com/aeroapi'

interface IFaAirport {
    code_icao?: string | null
    code_iata?: string | null
    name?: string | null
}

interface IFaFlight {
    ident_icao?: string | null
    ident_iata?: string | null
    operator?: string | null
    origin?: IFaAirport | null
    destination?: IFaAirport | null
    status?: string
    scheduled_out?: string | null
    actual_out?: string | null
    actual_off?: string | null
    actual_on?: string | null
    scheduled_in?: string | null
    estimated_in?: string | null
    departure_delay?: number | null // seconds
    arrival_delay?: number | null // seconds
    aircraft_type?: string | null
    registration?: string | null
}

interface IFaFlightsResponse {
    flights?: IFaFlight[]
}

export interface IAeroApiOptions {
    apiKey: string
    monthlyBudgetUsd?: number
    costPerCallUsd?: number
}

/** FlightAware AeroAPI. The quota is measured in money (monthly credit), not in number of requests. */
export class AeroApiSource implements IFlightSource {
    readonly id = EFlightSourceId.AEROAPI
    readonly capabilities: EFlightCapability[] = [EFlightCapability.DETAILS]
    readonly quota: IQuotaSpec

    constructor(private readonly opts: IAeroApiOptions) {
        this.quota = { period: EQuotaPeriod.MONTH, limit: opts.monthlyBudgetUsd ?? 5, reserveRatio: 0.2 }
    }

    costOf(): number {
        return this.opts.costPerCallUsd ?? 0.005
    }

    async getDetails(callsign: string): Promise<IFlightDetails | null> {
        const res = await fetch(`${BASE}/flights/${encodeURIComponent(callsign)}?max_pages=1`, {
            headers: { 'x-apikey': this.opts.apiKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        })
        if (res.status === 429) {
            throw new QuotaExhaustedError(this.id, EQuotaExhaustedKind.RATE, Number(res.headers.get('Retry-After') ?? '') || 60)
        }
        if (res.status === 404) return null
        if (!res.ok) throw new SourceHttpError(this.id, res.status, await res.text().catch(() => undefined))

        const { flights = [] } = (await res.json()) as IFaFlightsResponse
        const now = Date.now()
        const distance = (x: IFaFlight) => {
            const t = Date.parse(x.scheduled_out ?? '')
            return Number.isNaN(t) ? Infinity : Math.abs(t - now)
        }
        // Airborne if it took off and has not landed; otherwise, the one scheduled closest to now
        const f = flights.find(x => x.actual_off && !x.actual_on) ?? [...flights].sort((a, b) => distance(a) - distance(b))[0]
        if (!f) return null

        const minutes = (s?: number | null) => (typeof s === 'number' ? Math.round(s / 60) : undefined)
        return {
            callsign,
            flightIata: orUndefined(f.ident_iata),
            flightIcao: orUndefined(f.ident_icao),
            airline: orUndefined(f.operator),
            origin: { icao: orUndefined(f.origin?.code_icao), iata: orUndefined(f.origin?.code_iata), name: orUndefined(f.origin?.name) },
            destination: { icao: orUndefined(f.destination?.code_icao), iata: orUndefined(f.destination?.code_iata), name: orUndefined(f.destination?.name) },
            status: f.status,
            scheduledDeparture: orUndefined(f.scheduled_out),
            actualDeparture: orUndefined(f.actual_out),
            scheduledArrival: orUndefined(f.scheduled_in),
            estimatedArrival: orUndefined(f.estimated_in),
            departureDelayMin: minutes(f.departure_delay),
            arrivalDelayMin: minutes(f.arrival_delay),
            aircraftType: orUndefined(f.aircraft_type),
            registration: orUndefined(f.registration),
            source: this.id,
            fetchedAt: new Date().toISOString(),
        }
    }
}
