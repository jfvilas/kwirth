import { EFlightCapability, EFlightSourceId, EQuotaExhaustedKind, EQuotaPeriod, IAircraftPosition, IBBox } from '../../../common/FlightStatus'
import { HTTP_TIMEOUT_MS, IFlightSource, IQuotaSpec, QuotaExhaustedError, SourceHttpError } from '../types'

const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token'
const API = 'https://opensky-network.org/api'
const num = (v: unknown): number | undefined => (typeof v === 'number' ? v : undefined)

export interface IOpenSkyOptions {
    clientId?: string
    clientSecret?: string
    dailyCredits?: number
}

interface IOpenSkyToken {
    value: string
    expiresAt: number
}

interface IOpenSkyTokenResponse {
    access_token: string
    expires_in: number
}

// '/states/all' answers every state vector as a positional array; see the OpenSky REST API docs for the indexes.
interface IOpenSkyStatesResponse {
    states: unknown[][] | null
}

/** Live ADS-B positions. Quota in daily credits; the cost depends on the bbox area. */
export class OpenSkySource implements IFlightSource {
    readonly id = EFlightSourceId.OPENSKY
    readonly capabilities: EFlightCapability[] = [EFlightCapability.POSITIONS]
    readonly quota: IQuotaSpec
    onRemaining?: (remaining: number) => void
    private token?: IOpenSkyToken

    constructor(private readonly opts: IOpenSkyOptions = {}) {
        const authed = Boolean(opts.clientId && opts.clientSecret)
        this.quota = { period: EQuotaPeriod.DAY, limit: opts.dailyCredits ?? (authed ? 4000 : 400), reserveRatio: 0.1 }
    }

    costOf(_cap: EFlightCapability, arg: unknown): number {
        const b = arg as IBBox
        const area = (b.lamax - b.lamin) * (b.lomax - b.lomin) // square degrees
        if (area <= 25) return 1
        if (area <= 100) return 2
        if (area <= 400) return 3
        return 4
    }

    private async authHeaders(): Promise<Record<string, string>> {
        const { clientId, clientSecret } = this.opts
        if (!clientId || !clientSecret) return {}
        if (!this.token || this.token.expiresAt - 30_000 < Date.now()) {
            const res = await fetch(TOKEN_URL, {
                method: 'POST',
                signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
            })
            if (!res.ok) throw new SourceHttpError(this.id, res.status, 'token')
            const j = (await res.json()) as IOpenSkyTokenResponse
            this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 }
        }
        return { Authorization: `Bearer ${this.token.value}` }
    }

    async getPositions(bbox: IBBox): Promise<IAircraftPosition[]> {
        const qs = new URLSearchParams({ lamin: String(bbox.lamin), lomin: String(bbox.lomin), lamax: String(bbox.lamax), lomax: String(bbox.lomax) })
        const res = await fetch(`${API}/states/all?${qs}`, { headers: await this.authHeaders(), signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) })

        const remaining = res.headers.get('X-Rate-Limit-Remaining')
        if (remaining !== null && Number.isFinite(Number(remaining))) this.onRemaining?.(Number(remaining))

        if (res.status === 429) {
            const retry = Number(res.headers.get('X-Rate-Limit-Retry-After-Seconds') ?? '') || 3600
            throw new QuotaExhaustedError(this.id, EQuotaExhaustedKind.PERIOD, retry)
        }
        if (res.status === 401) this.token = undefined
        if (!res.ok) throw new SourceHttpError(this.id, res.status)

        const j = (await res.json()) as IOpenSkyStatesResponse
        return (j.states ?? [])
            .filter(s => typeof s[5] === 'number' && typeof s[6] === 'number')
            .map(s => ({
                icao24: String(s[0]),
                callsign: typeof s[1] === 'string' && s[1].trim() ? s[1].trim() : undefined,
                originCountry: typeof s[2] === 'string' ? s[2] : undefined,
                lastContact: Number(s[4]),
                lon: s[5] as number,
                lat: s[6] as number,
                baroAltitudeM: num(s[7]),
                onGround: Boolean(s[8]),
                velocityMs: num(s[9]),
                trackDeg: num(s[10]),
                verticalRateMs: num(s[11]),
                geoAltitudeM: num(s[13]),
                squawk: typeof s[14] === 'string' ? s[14] : undefined,
                source: this.id,
            }))
    }
}
