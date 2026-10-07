// Unit tests for the V16 provider — PURE DATEX2 helpers against a trimmed capture of the real DGT feed, and the
// provider lifecycle against a fake fetch. No network.
import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import path from 'path'
import { AddressInfo } from 'net'
import express from 'express'
import { diffSituations, isV16Situation, parseDatex2Situations, situationId, hashText } from '../src/back/Datex2'
import { V16Provider, eventFor, sanitizeConfig, schema } from '../src/back/index'
import { EV16EventType, IV16Event, IV16KnownSituation, IV16State, TV16Situation, V16_DEFAULT_CONFIG, V16_DEFAULT_URL } from '../src/common/V16Types'
import { IProviderStorage, IProviderSubscriber, KwirthData } from '@kwirthmagnify/kwirth-common-back'

const FEED = readFileSync(path.join('tests', 'fixtures', 'datex2-v3.xml'), 'utf-8')
const ROADWORKS_ID = '2816645'
const V16_ID = '24048680'

// Drops one situation from the feed, and makes a changed copy of another, to build the next poll.
const withoutSituation = (xml: string, id: string): string => xml.replace(new RegExp(`<sit:situation id="${id}">[\\s\\S]*?</sit:situation>`), '')
const withChangedRoadworks = (xml: string): string => xml.replace('<sit:probabilityOfOccurrence>certain</sit:probabilityOfOccurrence>', '<sit:probabilityOfOccurrence>probable</sit:probabilityOfOccurrence>')

// ── parsing ─────────────────────────────────────────────────────────────────────────────────────────────
test('the DATEX2 v3 feed is parsed: namespace prefixes stripped, both situations, raw string values', () => {
    const situations = parseDatex2Situations(FEED)
    assert.equal(situations.length, 2)
    assert.equal(situations[0]['@_id'], ROADWORKS_ID)
    assert.equal(situations[1]['@_id'], V16_ID)
    // Values stay strings: an id is never turned into a number.
    assert.equal(typeof situations[0]['@_id'], 'string')
    // situationRecord is ALWAYS an array, even with a single record.
    assert.ok(Array.isArray(situations[0]['situationRecord']))
    const record = (situations[0]['situationRecord'] as Record<string, unknown>[])[0]
    assert.equal(record['@_id'], '18811074')
    assert.equal(record['probabilityOfOccurrence'], 'certain')
})

test('the DATEX2 v2 root is still accepted', () => {
    const v2 = '<d2LogicalModel><payloadPublication><situation id="A1"><situationRecord id="R1"/></situation></payloadPublication></d2LogicalModel>'
    const situations = parseDatex2Situations(v2)
    assert.equal(situations.length, 1)
    assert.equal(situations[0]['@_id'], 'A1')
})

test('a single situation still comes out as an array, and junk yields nothing', () => {
    assert.equal(parseDatex2Situations(withoutSituation(FEED, V16_ID)).length, 1)
    assert.deepEqual(parseDatex2Situations('<other/>'), [])
    assert.deepEqual(parseDatex2Situations(''), [])
    assert.deepEqual(parseDatex2Situations('<d2:payload xmlns:d2="x"></d2:payload>'), [])
})

// ── identity and V16 detection ──────────────────────────────────────────────────────────────────────────
test('situationId takes the DATEX2 id, and derives a stable one when it is missing', () => {
    assert.equal(situationId({ '@_id': 'X' }), 'X')
    assert.equal(situationId({ id: 'Y' }), 'Y')
    const noId: TV16Situation = { situationRecord: [{ a: '1' }] }
    assert.equal(situationId(noId), `nid:${hashText(JSON.stringify(noId))}`)
    assert.equal(situationId(noId), situationId({ situationRecord: [{ a: '1' }] }))
})

test('isV16Situation is true only for records created from a V16_ reference', () => {
    const [roadworks, beacon] = parseDatex2Situations(FEED)
    assert.equal(isV16Situation(roadworks), false)
    assert.equal(isV16Situation(beacon), true)
    assert.equal(isV16Situation({ situationRecord: [{ situationRecordCreationReference: 'XV16_1' }] }), false)
    assert.equal(isV16Situation({ situationRecord: [{ situationRecordCreationReference: 'DGT_1' }, { situationRecordCreationReference: 'V16_2' }] }), true)
    assert.equal(isV16Situation({}), false)
})

test('hashText is deterministic and content-sensitive', () => {
    assert.equal(hashText('a'), hashText('a'))
    assert.notEqual(hashText('a'), hashText('b'))
    assert.match(hashText('a'), /^[0-9a-f]{40}$/)
})

// ── diff ────────────────────────────────────────────────────────────────────────────────────────────────
test('diffSituations: first poll adds everything, same poll again changes nothing', () => {
    const known = new Map<string, IV16KnownSituation>()
    const first = diffSituations(known, parseDatex2Situations(FEED))
    assert.deepEqual(first.added.map(e => e.id), [ROADWORKS_ID, V16_ID])
    assert.deepEqual(first.added.map(e => e.v16), [false, true])
    assert.equal(first.updated.length, 0)
    assert.equal(first.removed.length, 0)
    assert.equal(known.size, 2)

    const again = diffSituations(known, parseDatex2Situations(FEED))
    assert.equal(again.added.length + again.updated.length + again.removed.length, 0)
})

test('diffSituations: a changed situation is updated and a missing one is removed', () => {
    const known = new Map<string, IV16KnownSituation>()
    diffSituations(known, parseDatex2Situations(FEED))
    const next = diffSituations(known, parseDatex2Situations(withChangedRoadworks(withoutSituation(FEED, V16_ID))))
    assert.equal(next.added.length, 0)
    assert.deepEqual(next.updated.map(e => e.id), [ROADWORKS_ID])
    assert.deepEqual(next.removed.map(e => e.id), [V16_ID])
    assert.equal(next.removed[0].v16, true)
    assert.deepEqual([...known.keys()], [ROADWORKS_ID])
})

test('diffSituations: a duplicated id in the same document counts once', () => {
    const known = new Map<string, IV16KnownSituation>()
    const diff = diffSituations(known, [{ '@_id': 'D', v: '1' }, { '@_id': 'D', v: '2' }])
    assert.equal(diff.added.length, 1)
    assert.equal(diff.added[0].data['v'], '1')
})

// ── per-subscriber events ───────────────────────────────────────────────────────────────────────────────
const entry = (id: string, v16: boolean): IV16KnownSituation => ({ id, hash: id, v16, data: { '@_id': id } })

test('eventFor filters by v16Only and returns ids for removed', () => {
    const all = eventFor({}, EV16EventType.UPDATE, [entry('a', false), entry('b', true)], [entry('c', true)], [entry('d', false)])
    assert.deepEqual(all, { type: EV16EventType.UPDATE, added: [{ '@_id': 'a' }, { '@_id': 'b' }], updated: [{ '@_id': 'c' }], removed: ['d'] })
    const beacons = eventFor({ v16Only: true }, EV16EventType.UPDATE, [entry('a', false), entry('b', true)], [entry('c', true)], [entry('d', false)])
    assert.deepEqual(beacons, { type: EV16EventType.UPDATE, added: [{ '@_id': 'b' }], updated: [{ '@_id': 'c' }], removed: [] })
})

test('eventFor: an empty UPDATE is not sent, an empty INITIAL is', () => {
    assert.equal(eventFor({ v16Only: true }, EV16EventType.UPDATE, [entry('a', false)], [], []), undefined)
    assert.deepEqual(eventFor({ v16Only: true }, EV16EventType.INITIAL, [entry('a', false)], [], []), { type: EV16EventType.INITIAL, added: [], updated: [], removed: [] })
})

// ── configuration ───────────────────────────────────────────────────────────────────────────────────────
test('sanitizeConfig keeps only valid fields', () => {
    assert.deepEqual(sanitizeConfig(V16_DEFAULT_CONFIG, { url: '  https://x/feed.xml ', intervalSeconds: '30' }), { url: 'https://x/feed.xml', intervalSeconds: 30 })
    assert.deepEqual(sanitizeConfig(V16_DEFAULT_CONFIG, { url: '', intervalSeconds: 2 }), V16_DEFAULT_CONFIG)
    assert.deepEqual(sanitizeConfig(V16_DEFAULT_CONFIG, { url: 5, intervalSeconds: 'abc' }), V16_DEFAULT_CONFIG)
    assert.equal(V16_DEFAULT_CONFIG.url, V16_DEFAULT_URL)
    assert.equal(V16_DEFAULT_CONFIG.intervalSeconds, 60)
})

test('the schema has a label for every field and its defaults match the config defaults', () => {
    assert.deepEqual(schema.map(f => f.name), ['url', 'intervalSeconds'])
    for (const field of schema) assert.ok(field.label.length > 0)
    assert.equal(schema[0].default, V16_DEFAULT_URL)
    assert.equal(schema[1].default, 60)
})

// ── provider lifecycle (fake fetch) ─────────────────────────────────────────────────────────────────────
interface IFakeResponse { status: number, body?: string, etag?: string }

const realFetch = globalThis.fetch
let responses: IFakeResponse[] = []
let requests: Record<string, string>[] = []

const installFetch = (): void => {
    globalThis.fetch = (async (_url: string, init?: { headers?: Record<string, string> }) => {
        requests.push(init?.headers ?? {})
        const next = responses.shift() ?? { status: 304 }
        return new Response(next.status === 304 ? null : next.body ?? '', { status: next.status, headers: next.etag ? { etag: next.etag } : {} })
    }) as typeof fetch
}

const quiet = { info: () => {}, warning: () => {}, error: () => {} }

class Collector implements IProviderSubscriber {
    events: IV16Event[] = []
    processProviderEvent(providerId: string, obj: IV16Event): void {
        assert.equal(providerId, 'v16')
        this.events.push(obj)
    }
}

// The next poll, run by hand instead of waiting for the timer.
const pollNow = (provider: V16Provider): Promise<void> => (provider as unknown as { poll: () => Promise<void> }).poll()
const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20))
const newProvider = (storage?: IProviderStorage): V16Provider => {
    const provider = new V16Provider(undefined, {} as KwirthData, storage)
    provider.setLogger(quiet)
    return provider
}

let running: V16Provider | undefined
afterEach(async () => {
    if (running) await running.stopProvider()
    running = undefined
    globalThis.fetch = realFetch
    responses = []
    requests = []
})

test('provider: INITIAL on the first poll, then only the changes, and nothing when nothing changed', async () => {
    installFetch()
    responses = [{ status: 200, body: FEED, etag: '"e1"' }]
    const provider = running = newProvider()
    const all = new Collector()
    const beacons = new Collector()
    await provider.addSubscriber(all, {})
    await provider.addSubscriber(beacons, { v16Only: true })
    await provider.startProvider()
    await flush()

    assert.equal(all.events.length, 1)
    assert.equal(all.events[0].type, EV16EventType.INITIAL)
    assert.deepEqual(all.events[0].added.map(s => s['@_id']), [ROADWORKS_ID, V16_ID])
    assert.deepEqual(beacons.events[0].added.map(s => s['@_id']), [V16_ID])

    // 304: nothing dispatched, and the ETag was sent back.
    responses = [{ status: 304 }]
    await pollNow(provider)
    assert.equal(requests[1]['If-None-Match'], '"e1"')
    assert.equal(all.events.length, 1)

    // Same body with a new ETag: hash unchanged, nothing dispatched.
    responses = [{ status: 200, body: FEED, etag: '"e2"' }]
    await pollNow(provider)
    assert.equal(all.events.length, 1)

    // Roadworks modified: only 'all' hears about it, the beacon subscriber gets nothing.
    responses = [{ status: 200, body: withChangedRoadworks(FEED), etag: '"e3"' }]
    await pollNow(provider)
    assert.equal(all.events.length, 2)
    assert.deepEqual(all.events[1], { type: EV16EventType.UPDATE, added: [], updated: [all.events[1].updated[0]], removed: [] })
    assert.equal(all.events[1].updated[0]['@_id'], ROADWORKS_ID)
    assert.equal(beacons.events.length, 1)

    // The beacon clears: both hear about it.
    responses = [{ status: 200, body: withChangedRoadworks(withoutSituation(FEED, V16_ID)), etag: '"e4"' }]
    await pollNow(provider)
    assert.deepEqual(all.events[2], { type: EV16EventType.UPDATE, added: [], updated: [], removed: [V16_ID] })
    assert.deepEqual(beacons.events[1], { type: EV16EventType.UPDATE, added: [], updated: [], removed: [V16_ID] })

    assert.deepEqual(provider.getStats(), { subscribers: 2, events: 5, errors: 0 })
})

test('provider: a late subscriber gets the snapshot to itself alone', async () => {
    installFetch()
    responses = [{ status: 200, body: FEED }]
    const provider = running = newProvider()
    const early = new Collector()
    await provider.addSubscriber(early, {})
    await provider.startProvider()
    await flush()

    const late = new Collector()
    await provider.addSubscriber(late, { v16Only: true })
    assert.equal(early.events.length, 1)
    assert.equal(late.events.length, 1)
    assert.equal(late.events[0].type, EV16EventType.INITIAL)
    assert.deepEqual(late.events[0].added.map(s => s['@_id']), [V16_ID])

    await provider.removeSubscriber(late)
    assert.equal(provider.getStats().subscribers, 1)
})

test('provider: HTTP errors and exceptions are counted, and a throwing subscriber does not stop the rest', async () => {
    installFetch()
    responses = [{ status: 500 }]
    const provider = running = newProvider()
    await provider.startProvider()
    await flush()
    assert.equal(provider.getStats().errors, 1)

    globalThis.fetch = (async () => { throw new Error('boom') }) as typeof fetch
    await pollNow(provider)
    assert.equal(provider.getStats().errors, 2)

    installFetch()
    responses = [{ status: 200, body: FEED }]
    const bad: IProviderSubscriber = { processProviderEvent: () => { throw new Error('bad subscriber') } }
    const good = new Collector()
    await provider.addSubscriber(bad, {})
    await provider.addSubscriber(good, {})
    await pollNow(provider)
    assert.equal(good.events.length, 1)
    assert.deepEqual(provider.getStats(), { subscribers: 2, events: 1, errors: 3 })
})

test('provider: a poll in flight when it stops does not schedule another one', async () => {
    let release: (() => void) | undefined
    globalThis.fetch = (() => new Promise<Response>(resolve => { release = () => resolve(new Response(FEED, { status: 200 })) })) as typeof fetch
    const provider = newProvider()
    const collector = new Collector()
    await provider.addSubscriber(collector, {})
    await provider.startProvider()
    await provider.stopProvider()
    release?.()
    await flush()
    // Nothing delivered and no timer left: node:test would hang on a live 60 s timer otherwise.
    assert.equal(collector.events.length, 0)
    assert.equal((provider as unknown as { timer: unknown }).timer, undefined)
})

test('provider: configure, stored config, export and import', async () => {
    const stored = new Map<string, unknown>()
    const storage: IProviderStorage = {
        writeStorage: async (id: string, _secret: boolean, data: unknown) => { stored.set(id, data) },
        readStorage: async (id: string) => stored.get(id),
        writeStorageCommon: async () => {},
        readStorageCommon: async () => undefined
    }
    const provider = newProvider(storage)
    provider.configure({ intervalSeconds: 120, url: 'https://a/feed.xml' })
    assert.deepEqual(await provider.exportConfig({ includeCredentials: false }), { config: { url: 'https://a/feed.xml', intervalSeconds: 120 } })

    assert.deepEqual(await provider.importConfig({ config: { url: 'https://b/feed.xml', intervalSeconds: 30 } }), { applied: 1, skipped: 0, warnings: [] })
    assert.deepEqual(stored.get('v16-config'), { url: 'https://b/feed.xml', intervalSeconds: 30 })

    const bad = await provider.importConfig({ config: { intervalSeconds: 1 } })
    assert.equal(bad.applied, 1)
    assert.equal(bad.warnings.length, 1)
    assert.deepEqual(stored.get('v16-config'), V16_DEFAULT_CONFIG)

    assert.deepEqual(await provider.importConfig({}), { applied: 0, skipped: 0, warnings: ['no v16 configuration found in the imported data'] })

    // What was stored is what a fresh instance starts with.
    await provider.importConfig({ config: { url: 'https://c/feed.xml', intervalSeconds: 45 } })
    installFetch()
    const fresh = running = newProvider(storage)
    await fresh.startProvider()
    await flush()
    assert.deepEqual(await fresh.exportConfig({ includeCredentials: true }), { config: { url: 'https://c/feed.xml', intervalSeconds: 45 } })
})

test('provider: the read-only configRouter serves /state and /situations', async () => {
    installFetch()
    responses = [{ status: 200, body: FEED }]
    const provider = running = newProvider()
    await provider.addSubscriber(new Collector(), {})
    await provider.startProvider()
    await flush()
    globalThis.fetch = realFetch

    const app = express()
    app.use('/core/providerconfig/v16', provider.configRouter)
    const server = app.listen(0)
    try {
        const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/core/providerconfig/v16`
        const state = await (await fetch(`${base}/state`)).json() as IV16State
        assert.equal(state.url, V16_DEFAULT_URL)
        assert.equal(state.intervalSeconds, 60)
        assert.equal(state.situations, 2)
        assert.equal(state.v16Situations, 1)
        assert.equal(state.subscribers, 1)
        assert.equal(state.lastError, '')
        assert.ok(state.lastPoll > 0)

        const all = await (await fetch(`${base}/situations`)).json() as TV16Situation[]
        assert.deepEqual(all.map(s => s['@_id']), [ROADWORKS_ID, V16_ID])
        const beacons = await (await fetch(`${base}/situations?v16Only=true`)).json() as TV16Situation[]
        assert.deepEqual(beacons.map(s => s['@_id']), [V16_ID])
    }
    finally {
        server.close()
    }
})

test('provider: subscription help and config names', () => {
    const provider = newProvider()
    const help = provider.getSubscriptionHelp()
    assert.deepEqual(help.example, { v16Only: true })
    assert.deepEqual(help.fields?.map(f => f.name), ['v16Only'])
    assert.deepEqual(provider.getConfigNames(), ['default'])
    assert.equal(provider.getConfigSchema(), schema)
    assert.equal(provider.providesRouter, false)
    assert.ok(provider.configRouter)
})
