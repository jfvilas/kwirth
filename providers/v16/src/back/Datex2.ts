import { createHash } from 'crypto'
import { XMLParser } from 'fast-xml-parser'
import { IV16Diff, IV16KnownSituation, TV16Situation, V16_REFERENCE_PREFIX } from '../common/V16Types'

/*
    PURE DATEX2 helpers: no network, no state of their own. Everything the provider decides about the feed
    lives here so it can be tested against captured documents.
*/

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value)

const asArray = (value: unknown): unknown[] => value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]

/*
    ⚠️ The DGT feed is DATEX2 v3: the root is '<d2:payload xsi:type="sit:SituationPublication">' and the
    situations hang straight from it as '<sit:situation>'. DATEX2 v2 wrapped them in
    'd2LogicalModel > payloadPublication' instead. Namespace prefixes are stripped so neither the
    prefixes the publisher picks nor the version change the shape, and both roots are accepted.

    Values are kept as RAW strings: numeric conversion would turn ids into numbers and mangle anything
    with leading zeros (road codes, kilometre points).
*/
const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => name === 'situation' || name === 'situationRecord'
})

export const parseDatex2Situations = (xml: string): TV16Situation[] => {
    const doc: unknown = parser.parse(xml)
    if (!isRecord(doc)) return []
    const v3 = doc['payload']
    const v2 = isRecord(doc['d2LogicalModel']) ? doc['d2LogicalModel']['payloadPublication'] : undefined
    const publication = isRecord(v3) ? v3 : isRecord(v2) ? v2 : undefined
    if (!publication) return []
    return asArray(publication['situation']).filter(isRecord)
}

export const hashText = (text: string): string => createHash('sha1').update(text).digest('hex')

/**
 * Stable identity of a situation between polls: DATEX2 carries it as the 'id' attribute. A situation with
 * no id (it should not happen) gets one derived from its content, so it is at least not merged with others.
 */
export const situationId = (situation: TV16Situation): string => {
    const id = situation['@_id'] ?? situation['id']
    if (typeof id === 'string' && id.length > 0) return id
    return `nid:${hashText(JSON.stringify(situation))}`
}

/** A situation is a V16 beacon when any of its records was created from a V16 reference. */
export const isV16Situation = (situation: TV16Situation): boolean =>
    asArray(situation['situationRecord']).some(record =>
        isRecord(record) &&
        typeof record['situationRecordCreationReference'] === 'string' &&
        record['situationRecordCreationReference'].startsWith(V16_REFERENCE_PREFIX))

/**
 * Compares the situations of one poll against what is known from the previous ones, and brings 'known' up
 * to date in place. A situation that appears twice in the same document counts once (the first wins).
 */
export const diffSituations = (known: Map<string, IV16KnownSituation>, situations: TV16Situation[]): IV16Diff => {
    const diff: IV16Diff = { added: [], updated: [], removed: [] }
    const current = new Set<string>()

    for (const data of situations) {
        const id = situationId(data)
        if (current.has(id)) continue
        current.add(id)

        const entry: IV16KnownSituation = { id, hash: hashText(JSON.stringify(data)), v16: isV16Situation(data), data }
        const previous = known.get(id)
        if (!previous) diff.added.push(entry)
        else if (previous.hash !== entry.hash) diff.updated.push(entry)
        known.set(id, entry)
    }

    for (const [id, entry] of known) {
        if (!current.has(id)) diff.removed.push(entry)
    }
    for (const entry of diff.removed) known.delete(entry.id)

    return diff
}
