import {
    DEFAULT_INTERVAL_SEC, IBBox, IFlightStatusConfig, IFlightStatusSubscription, MIN_INTERVAL_SEC, defaultFlightStatusConfig
} from './FlightStatus'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const BBOX_KEYS: (keyof IBBox)[] = ['lamin', 'lomin', 'lamax', 'lomax']

export const validateBBox = (b: unknown): string[] => {
    if (!isRecord(b)) return ['bbox is required: { lamin, lomin, lamax, lomax }']
    const errors: string[] = []
    for (const k of BBOX_KEYS) {
        if (!isNum(b[k])) errors.push(`bbox.${k} must be a number`)
    }
    if (errors.length > 0) return errors
    const box = b as unknown as IBBox
    if (box.lamin < -90 || box.lamax > 90) errors.push('bbox latitudes must be within [-90, 90]')
    if (box.lomin < -180 || box.lomax > 180) errors.push('bbox longitudes must be within [-180, 180]')
    if (box.lamin >= box.lamax) errors.push('bbox.lamin must be lower than bbox.lamax')
    if (box.lomin >= box.lomax) errors.push('bbox.lomin must be lower than bbox.lomax')
    return errors
}

export interface IParsedSubscription {
    sub?: IFlightStatusSubscription
    errors: string[]
}

/** Normalizes a subscription payload, or returns what prevents using it. */
export const parseSubscription = (data: unknown): IParsedSubscription => {
    const d = isRecord(data) ? data : {}
    const errors = validateBBox(d.bbox)
    if (d.intervalSec !== undefined && !isNum(d.intervalSec)) errors.push('intervalSec must be a number')
    const watch = d.watch
    if (watch !== undefined && !(Array.isArray(watch) && watch.every((w: unknown) => typeof w === 'string'))) {
        errors.push('watch must be an array of callsigns')
    }
    if (errors.length > 0) return { errors }
    const bbox = d.bbox as unknown as IBBox
    return {
        errors,
        sub: {
            bbox: { lamin: bbox.lamin, lomin: bbox.lomin, lamax: bbox.lamax, lomax: bbox.lomax },
            intervalSec: Math.max(MIN_INTERVAL_SEC, isNum(d.intervalSec) ? d.intervalSec : DEFAULT_INTERVAL_SEC),
            watch: ((watch as string[] | undefined) ?? []).map(w => w.trim().toUpperCase()).filter(Boolean),
        },
    }
}

/**
 * Lays whatever arrives (a PUT body, a stored ConfigMap from an older version) over the defaults,
 * section by section. It only fills what is missing: it never changes a value that came in, so
 * validateConfig sees exactly what the user sent.
 */
export const normalizeConfig = (incoming: unknown): IFlightStatusConfig => {
    const d = defaultFlightStatusConfig()
    const p = isRecord(incoming) ? incoming : {}
    const section = <T extends object>(value: unknown, base: T): T => (isRecord(value) ? { ...base, ...value } as T : base)
    return {
        opensky: section(p.opensky, d.opensky),
        aviationstack: section(p.aviationstack, d.aviationstack),
        aeroapi: section(p.aeroapi, d.aeroapi),
        positionTtlSec: (p.positionTtlSec as number | undefined) ?? d.positionTtlSec,
        detailsTtlHours: (p.detailsTtlHours as number | undefined) ?? d.detailsTtlHours,
    }
}

export const validateConfig = (c: IFlightStatusConfig): string[] => {
    const errors: string[] = []
    const positive = (v: unknown, name: string) => {
        if (!isNum(v) || v <= 0) errors.push(`${name} must be a positive number`)
    }
    const isText = (v: unknown) => typeof v === 'string'
    if (!isText(c.opensky.clientId) || !isText(c.opensky.clientSecret)) errors.push('opensky.clientId and opensky.clientSecret must be text')
    else if (Boolean(c.opensky.clientId) !== Boolean(c.opensky.clientSecret)) errors.push('opensky needs both clientId and clientSecret, or neither (anonymous)')
    if (!isNum(c.opensky.dailyCredits) || c.opensky.dailyCredits < 0) errors.push('opensky.dailyCredits must be 0 (auto) or positive')
    if (typeof c.aviationstack.enabled !== 'boolean') errors.push('aviationstack.enabled must be true or false')
    if (!isText(c.aviationstack.accessKey)) errors.push('aviationstack.accessKey must be text')
    positive(c.aviationstack.monthlyRequests, 'aviationstack.monthlyRequests')
    if (c.aviationstack.enabled && !c.aviationstack.accessKey) errors.push('aviationstack is enabled but has no access key')
    if (typeof c.aeroapi.enabled !== 'boolean') errors.push('aeroapi.enabled must be true or false')
    if (!isText(c.aeroapi.apiKey)) errors.push('aeroapi.apiKey must be text')
    positive(c.aeroapi.monthlyBudgetUsd, 'aeroapi.monthlyBudgetUsd')
    positive(c.aeroapi.costPerCallUsd, 'aeroapi.costPerCallUsd')
    if (c.aeroapi.enabled && !c.aeroapi.apiKey) errors.push('aeroapi is enabled but has no API key')
    if (!isNum(c.positionTtlSec) || c.positionTtlSec < 5) errors.push('positionTtlSec must be at least 5')
    positive(c.detailsTtlHours, 'detailsTtlHours')
    return errors
}
