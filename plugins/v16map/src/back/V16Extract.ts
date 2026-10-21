import { IV16Point } from '../common/V16MapTypes'

/*
    The v16 provider hands situations as the XML parser leaves them: namespace prefixes stripped,
    attributes as '@_name' and every value a string. The DGT profile nests the interesting fields at
    different depths depending on the location type (point, linear, area), so they are searched for by
    name instead of by path. The first occurrence wins, which for a linear location is its start point.
*/

const findValue = (node: unknown, key: string, depth = 0): unknown => {
    if (depth > 20 || node === null || typeof node !== 'object') return undefined
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findValue(item, key, depth + 1)
            if (found !== undefined) return found
        }
        return undefined
    }
    const obj = node as Record<string, unknown>
    if (key in obj) return obj[key]
    for (const value of Object.values(obj)) {
        const found = findValue(value, key, depth + 1)
        if (found !== undefined) return found
    }
    return undefined
}

/** A leaf as text: the parser gives '#text' when the element also had attributes. */
const textOf = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value
    if (typeof value === 'number') return String(value)
    if (value && typeof value === 'object' && '#text' in value) return textOf((value as Record<string, unknown>)['#text'])
    return undefined
}

const findText = (node: unknown, key: string): string | undefined => textOf(findValue(node, key))

/** The first object that carries both coordinates, so latitude and longitude come from the same point. */
const findCoordinates = (node: unknown, depth = 0): { lat: number, lon: number } | undefined => {
    if (depth > 20 || node === null || typeof node !== 'object') return undefined
    if (!Array.isArray(node)) {
        const obj = node as Record<string, unknown>
        if ('latitude' in obj && 'longitude' in obj) {
            const lat = Number(textOf(obj.latitude))
            const lon = Number(textOf(obj.longitude))
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
        }
    }
    for (const value of Object.values(node as object)) {
        const found = findCoordinates(value, depth + 1)
        if (found) return found
    }
    return undefined
}

const records = (situation: Record<string, unknown>): unknown[] => {
    const raw = situation.situationRecord
    return Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]
}

const isV16 = (situation: Record<string, unknown>): boolean =>
    records(situation).some(r => (findText(r, 'situationRecordCreationReference') ?? '').startsWith('V16_'))

/** 'sit:GenericSituationRecord' → 'GenericSituationRecord' */
const recordType = (situation: Record<string, unknown>): string | undefined => {
    const first = records(situation)[0] as Record<string, unknown> | undefined
    const type = first ? textOf(first['@_type'] ?? first['@_xsi:type']) : undefined
    return type?.replace(/^.*:/, '')
}

export const toPoint = (situation: Record<string, unknown>): IV16Point => {
    const coordinates = findCoordinates(situation)
    return {
        id: textOf(situation['@_id']) ?? '',
        ...(coordinates ?? {}),
        v16: isV16(situation),
        road: findText(situation, 'roadName'),
        km: findText(situation, 'kilometerPoint'),
        cause: findText(situation, 'causeType') ?? recordType(situation),
        detail: findText(situation, 'vehicleObstructionType') ?? findText(situation, 'accidentType')
            ?? findText(situation, 'roadMaintenanceType') ?? findText(situation, 'genericSituationRecordName'),
        municipality: findText(situation, 'municipality'),
        province: findText(situation, 'province'),
        community: findText(situation, 'autonomousCommunity'),
        direction: findText(situation, 'tpegDirection') ?? findText(situation, 'directionRelative'),
        start: findText(situation, 'overallStartTime')
    }
}
