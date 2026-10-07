import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EFlightStatusStorageKey, IFlightStatusConfig, defaultFlightStatusConfig } from '../src/common/FlightStatus'
import { ConfigStore, configFromEnv } from '../src/back/ConfigStore'
import { FakeStorage } from './helpers'

const withSecrets = (): IFlightStatusConfig => {
    const c = defaultFlightStatusConfig()
    c.opensky.clientId = 'os-id'
    c.opensky.clientSecret = 'os-secret'
    c.aviationstack.enabled = true
    c.aviationstack.accessKey = 'as-key'
    c.aeroapi.enabled = true
    c.aeroapi.apiKey = 'fa-key'
    return c
}

test('save splits the configuration: credentials to the Secret, everything else to the ConfigMap', async () => {
    const storage = new FakeStorage()
    await new ConfigStore(storage).save(withSecrets())
    const pub = storage.configMap.get(EFlightStatusStorageKey.CONFIG) as IFlightStatusConfig
    assert.equal(pub.opensky.clientId, 'os-id')
    assert.equal(pub.opensky.clientSecret, '')
    assert.equal(pub.aviationstack.accessKey, '')
    assert.equal(pub.aeroapi.apiKey, '')
    assert.deepEqual(storage.secret.get(EFlightStatusStorageKey.CREDS), {
        openskyClientSecret: 'os-secret', aviationstackAccessKey: 'as-key', aeroapiApiKey: 'fa-key'
    })
    assert.equal(JSON.stringify(pub).includes('secret'), false)
})

test('load puts both halves back together: the provider holds the REAL credentials', async () => {
    const storage = new FakeStorage()
    const store = new ConfigStore(storage)
    await store.save(withSecrets())
    assert.deepEqual(await store.load(), withSecrets())
})

test('save persists what arrives: a removed credential is removed', async () => {
    const storage = new FakeStorage()
    const store = new ConfigStore(storage)
    await store.save(withSecrets())
    const next = withSecrets()
    next.aeroapi.apiKey = ''
    next.aeroapi.enabled = false
    await store.save(next)
    assert.deepEqual(storage.secret.get(EFlightStatusStorageKey.CREDS), { openskyClientSecret: 'os-secret', aviationstackAccessKey: 'as-key' })
    assert.equal((await store.load()).aeroapi.apiKey, '')
})

test('load on an empty storage gives the defaults', async () => {
    assert.deepEqual(await new ConfigStore(new FakeStorage()).load(), defaultFlightStatusConfig())
})

test('load tolerates a partial stored configuration from an older version', async () => {
    const storage = new FakeStorage()
    storage.configMap.set(EFlightStatusStorageKey.CONFIG, { aeroapi: { enabled: true } })
    storage.secret.set(EFlightStatusStorageKey.CREDS, { aeroapiApiKey: 'k' })
    const c = await new ConfigStore(storage).load()
    assert.deepEqual(c.aeroapi, { enabled: true, apiKey: 'k', monthlyBudgetUsd: 5, costPerCallUsd: 0.005 })
    assert.equal(c.positionTtlSec, 15)
})

test('without storage: load reads the environment and save refuses', async () => {
    const store = new ConfigStore(undefined)
    assert.equal(store.available, false)
    await assert.rejects(store.save(defaultFlightStatusConfig()), /no storage available/)
    const c = configFromEnv({ OPENSKY_CLIENT_ID: 'id', OPENSKY_CLIENT_SECRET: 's', AVIATIONSTACK_KEY: 'as' })
    assert.deepEqual(c.opensky, { clientId: 'id', clientSecret: 's', dailyCredits: 0 })
    assert.deepEqual(c.aviationstack, { enabled: true, accessKey: 'as', monthlyRequests: 100 })
    assert.equal(c.aeroapi.enabled, false)
})
