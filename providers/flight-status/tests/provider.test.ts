import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { AddressInfo } from 'net'
import { IProviderSubscriber, KwirthData } from '@kwirthmagnify/kwirth-common-back'
import {
    EFlightStatusEventType, EFlightStatusStorageKey, IFlightStatusConfig, PROVIDER_ID, TFlightStatusEvent, defaultFlightStatusConfig
} from '../src/common/FlightStatus'
import { FlightStatusProvider } from '../src/back/index'
import { parseSubscription } from '../src/common/Validation'
import { FakeStorage, json, mockFetch } from './helpers'

class RecordingSubscriber implements IProviderSubscriber {
    events: TFlightStatusEvent[] = []
    ids: string[] = []
    processProviderEvent(providerId: string, obj: TFlightStatusEvent): void {
        this.ids.push(providerId)
        this.events.push(obj)
    }
}

const until = async (cond: () => boolean, ms = 2000) => {
    const end = Date.now() + ms
    while (!cond()) {
        if (Date.now() > end) throw new Error('timeout waiting for condition')
        await new Promise(r => setTimeout(r, 5))
    }
}

const newProvider = async (storage = new FakeStorage()) => {
    const p = new FlightStatusProvider(undefined, {} as KwirthData, storage)
    p.setLogger({ info: () => {}, warning: () => {}, error: () => {} })
    await p.startProvider()
    return p
}

/** Mounts the configRouter on a real express app, as the core does, and returns its base URL. */
const serve = async (p: FlightStatusProvider) => {
    const app = express()
    app.use(express.json())
    app.use('/cfg', p.configRouter)
    const server = app.listen(0)
    await new Promise(r => server.once('listening', r))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/cfg`
    return { base, close: () => new Promise(r => server.close(r)) }
}

test('identity and contract flags', async () => {
    const p = await newProvider()
    assert.equal(p.id, PROVIDER_ID)
    assert.equal(p.id, 'flight-status')
    assert.equal(p.providesRouter, false)
    assert.equal(p.requiresApiKeyApi, false)
    assert.deepEqual(p.getStats(), { subscribers: 0, events: 0, errors: 0 })
    const help = p.getSubscriptionHelp()
    assert.deepEqual(help.example, {
        bbox: { lamin: 36.0, lomin: -9.5, lamax: 43.8, lomax: 3.3 },
        intervalSec: 120,
        watch: ['IBE3171', 'VLG1001', 'AEA5023', 'IBS3902', 'ANE8410']
    })
    // The example must be a valid subscription as it is: provider-debug pastes it straight into addSubscriber
    const parsed = parseSubscription(help.example)
    assert.deepEqual(parsed.errors, [])
    assert.deepEqual(parsed.sub, help.example)
    assert.match(help.usage, /3 OpenSky credits/)
})

test('GET /config returns the REAL credentials, as loaded from storage', async () => {
    const storage = new FakeStorage()
    storage.configMap.set(EFlightStatusStorageKey.CONFIG, { ...defaultFlightStatusConfig(), aviationstack: { enabled: true, accessKey: '', monthlyRequests: 100 } })
    storage.secret.set(EFlightStatusStorageKey.CREDS, { aviationstackAccessKey: 'as-key' })
    const s = await serve(await newProvider(storage))
    try {
        const cfg = await (await fetch(`${s.base}/config`)).json() as IFlightStatusConfig
        assert.equal(cfg.aviationstack.accessKey, 'as-key')
        assert.equal('secretsSet' in cfg, false)
    }
    finally {
        await s.close()
    }
})

test('PUT /config persists what arrives, applies it, and GET returns it back unchanged', async () => {
    const storage = new FakeStorage()
    const p = await newProvider(storage)
    const s = await serve(p)
    try {
        const next = defaultFlightStatusConfig()
        next.aeroapi = { enabled: true, apiKey: 'fa-key', monthlyBudgetUsd: 10, costPerCallUsd: 0.01 }
        const r = await fetch(`${s.base}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) })
        assert.equal(r.status, 200)
        assert.deepEqual(await r.json(), { ok: true })
        assert.deepEqual(storage.secret.get(EFlightStatusStorageKey.CREDS), { aeroapiApiKey: 'fa-key' })
        assert.deepEqual(await (await fetch(`${s.base}/config`)).json(), next)
        const status = await (await fetch(`${s.base}/status`)).json() as { sourceId: string, limit: number }[]
        assert.deepEqual(status.map(x => [x.sourceId, x.limit]), [['opensky', 400], ['aeroapi', 10]])
    }
    finally {
        await s.close()
    }
})

test('PUT /config: an empty secret is stored empty, never "kept" from before', async () => {
    const storage = new FakeStorage()
    const s = await serve(await newProvider(storage))
    try {
        const put = (c: IFlightStatusConfig) => fetch(`${s.base}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) })
        const withKey = defaultFlightStatusConfig()
        withKey.aviationstack.accessKey = 'as-key'
        await put(withKey)
        await put(defaultFlightStatusConfig())
        assert.deepEqual(storage.secret.get(EFlightStatusStorageKey.CREDS), {})
        assert.equal(((await (await fetch(`${s.base}/config`)).json()) as IFlightStatusConfig).aviationstack.accessKey, '')
    }
    finally {
        await s.close()
    }
})

test('PUT /config rejects an invalid configuration with 400 and stores nothing', async () => {
    const storage = new FakeStorage()
    const s = await serve(await newProvider(storage))
    try {
        const bad = defaultFlightStatusConfig()
        bad.opensky.clientId = 'id-without-secret'
        const r = await fetch(`${s.base}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bad) })
        assert.equal(r.status, 400)
        assert.deepEqual(await r.json(), { errors: ['opensky needs both clientId and clientSecret, or neither (anonymous)'] })
        assert.equal(storage.writes.length, 0)
    }
    finally {
        await s.close()
    }
})

test('an invalid subscription gets one error event and no polling', async () => {
    const p = await newProvider()
    const sub = new RecordingSubscriber()
    await p.addSubscriber(sub, { bbox: { lamin: 50, lomin: 0, lamax: 40, lomax: 10 } })
    assert.equal(sub.events.length, 1)
    const [e] = sub.events
    assert.equal(e.type, EFlightStatusEventType.ERROR)
    assert.equal(e.type === EFlightStatusEventType.ERROR && e.message, 'Invalid subscription: bbox.lamin must be lower than bbox.lamax')
    await p.removeSubscriber(sub)
})

test('a valid subscription gets positions at once, filtered to its bbox; watched callsigns get details', async () => {
    const f = mockFetch(url => {
        if (url.startsWith('https://opensky-network.org')) {
            return json({ states: [
                ['aaa', 'IBE3171', 'Spain', 0, 1, -8, 42, 1, false, 1, 1, 0, null, 1, null],
                ['bbb', 'RYR1', 'Ireland', 0, 1, -7, 41, 1, false, 1, 1, 0, null, 1, null],
                ['ccc', 'OUT1', 'Spain', 0, 1, -7, 43.9, 1, false, 1, 1, 0, null, 1, null], // outside the asked bbox
            ] })
        }
        return json({ flights: [{ ident_icao: 'IBE3171', actual_off: 'x', status: 'En Route' }] })
    })
    const storage = new FakeStorage()
    const cfg = defaultFlightStatusConfig()
    cfg.aeroapi = { enabled: true, apiKey: 'k', monthlyBudgetUsd: 1000, costPerCallUsd: 0.001 }
    await new (await import('../src/back/ConfigStore')).ConfigStore(storage).save(cfg)
    const p = await newProvider(storage)
    const sub = new RecordingSubscriber()
    try {
        await p.addSubscriber(sub, { bbox: { lamin: 40, lomin: -9, lamax: 43.5, lomax: -6 }, watch: ['ibe3171'] })
        await until(() => sub.events.length > 0)
        const e = sub.events[0]
        assert.deepEqual(sub.ids, [PROVIDER_ID])
        assert.equal(e.type, EFlightStatusEventType.POSITIONS)
        if (e.type !== EFlightStatusEventType.POSITIONS) return
        assert.deepEqual(e.bbox, { lamin: 40, lomin: -9, lamax: 43.5, lomax: -6 })
        assert.deepEqual(e.aircraft.map(a => a.icao24), ['aaa', 'bbb'])
        assert.equal(e.aircraft[0].details?.status, 'En Route')
        assert.equal('details' in e.aircraft[1], false)
        assert.deepEqual(p.getStats(), { subscribers: 1, events: 1, errors: 0 })
    }
    finally {
        await p.removeSubscriber(sub)
        f.restore()
    }
    assert.equal(p.getStats().subscribers, 0)
})

test('an upstream failure arrives as an error event; after it the breaker keeps the source paused', async () => {
    const f = mockFetch(() => json({}, 500))
    const p = await newProvider()
    const sub = new RecordingSubscriber()
    const bbox = { lamin: 40, lomin: -9, lamax: 43, lomax: -6 }
    try {
        await p.addSubscriber(sub, { bbox })
        await until(() => sub.events.length > 0)
        // updateSubscription forgets the last error, so the new message (breaker open) is delivered too
        await p.updateSubscription(sub, { bbox })
        await until(() => sub.events.length > 1)
        const messages = sub.events.map(e => e.type === EFlightStatusEventType.ERROR ? e.message : e.type)
        assert.deepEqual(messages, ['positions: no sources available (opensky: HTTP 500)', 'positions: no sources available'])
        assert.equal(f.calls.length, 1)
    }
    finally {
        await p.stopProvider()
        f.restore()
    }
    assert.equal(p.getStats().subscribers, 0)
})

test('a subscriber that throws is counted as an error and does not break the provider', async () => {
    const p = await newProvider()
    const bad: IProviderSubscriber = { processProviderEvent: () => { throw new Error('nope') } }
    await p.addSubscriber(bad, {})
    assert.deepEqual(p.getStats(), { subscribers: 1, events: 1, errors: 1 })
    await p.removeSubscriber(bad)
})
