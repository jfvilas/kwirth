import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { IInstanceConfig } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject } from '@kwirthmagnify/kwirth-common-back'
import { V16MapChannel } from '../../src/back/index'
import { EV16MapPayload } from '../../src/common/V16MapTypes'
import { clusterInfoWith, FakeV16Provider, fixtureSituations, instanceConfigFor, makeBackObj, MockWs } from '../helpers'

// null stands for 'the provider is not installed': undefined would pick the default
const makeChannel = (provider: FakeV16Provider | null = new FakeV16Provider()) => {
    const back = makeBackObj()
    const info = clusterInfoWith(provider ?? undefined)
    const channel = new V16MapChannel(info.clusterInfo, back.obj as unknown as IBackChannelObject)
    return { channel, provider, asked: info.asked, ...back }
}

const start = async (channel: V16MapChannel, ws: MockWs, instance = 'i1', v16Only = false) => {
    const config = instanceConfigFor(instance, { v16Only }) as unknown as IInstanceConfig
    await channel.addObject(ws as unknown as WebSocket, config, '', '', '')
    return config
}

const asWs = (ws: MockWs) => ws as unknown as WebSocket

// let the promise the channel does not await settle
const settle = () => new Promise(resolve => setImmediate(resolve))

describe('channel contract', () => {
    test('is a standalone channel that requires the v16 provider', () => {
        const { channel } = makeChannel()
        const data = channel.getChannelData()
        assert.equal(data.id, 'v16map')
        assert.equal(data.cluster, false)
        assert.equal(data.resourced, false)
        assert.equal(data.pauseable, false)
        assert.deepEqual(channel.requirements.providers, ['v16'])
        assert.equal(channel.requirements.storage, false)
    })

    test('only the none scope is accepted', () => {
        const { channel } = makeChannel()
        assert.equal(channel.getChannelScopeLevel('none'), 1)
        assert.equal(channel.getChannelScopeLevel('cluster'), -1)
    })

    test('counts instances and connections', async () => {
        const { channel } = makeChannel()
        const a = new MockWs()
        const b = new MockWs()
        await start(channel, a, 'i1')
        await start(channel, a, 'i2')
        await start(channel, b, 'i3')
        assert.deepEqual(channel.getInstances(), { instances: 3, connections: 2 })
        assert.equal(channel.containsInstance('i2'), true)
        assert.equal(channel.containsConnection(asWs(b)), true)
    })

    test('nothing to command: the tab only listens', async () => {
        const { channel } = makeChannel()
        assert.equal(await channel.processCommand(asWs(new MockWs()), {} as never), false)
    })
})

describe('subscription', () => {
    test('each instance subscribes on its own, with its own filter', async () => {
        const { channel, provider, asked } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1', true)
        await start(channel, ws, 'i2', false)
        await settle()
        assert.deepEqual(asked, ['v16', 'v16'])
        assert.deepEqual([...provider!.subscriptions.values()], [{ v16Only: true }, { v16Only: false }])
    })

    test('starting the same instance twice does not subscribe twice', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1')
        await start(channel, ws, 'i1')
        await settle()
        assert.equal(provider!.subscriptions.size, 1)
    })

    test('without the provider, the tab is told how to fix it', async () => {
        const { channel } = makeChannel(null)
        const ws = new MockWs()
        await start(channel, ws)
        const [signal] = ws.signals()
        assert.equal(signal.level, 'error')
        assert.match(String(signal.text), /'v16' provider is not installed/)
    })

    test('a provider that fails to subscribe is reported to the tab', async () => {
        const provider = new FakeV16Provider()
        provider.failSubscribe = true
        const { channel } = makeChannel(provider)
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        assert.match(String(ws.signals()[0].text), /failed while adding the subscriber: Error: feed unreachable/)
    })
})

describe('delivery', () => {
    test('the initial event becomes a snapshot of reduced points', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        provider!.emit({ type: 'initial', added: fixtureSituations(), updated: [], removed: [] })
        const [msg] = ws.data()
        assert.equal(msg.msgtype, 'v16mapmessageresponse')
        assert.equal(msg.channel, 'v16map')
        assert.equal(msg.instance, 'i1')
        assert.equal(msg.payloadType, EV16MapPayload.SNAPSHOT)
        assert.equal(msg.added.length, 2)
        assert.equal(msg.added.find(p => p.id === '24048680')?.v16, true)
        assert.equal(typeof msg.at, 'number')
    })

    test('an update becomes a set of changes', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        const [beacon] = fixtureSituations()
        provider!.emit({ type: 'update', added: [], updated: [beacon], removed: ['99'] })
        const [msg] = ws.data()
        assert.equal(msg.payloadType, EV16MapPayload.CHANGES)
        assert.deepEqual(msg.added, [])
        assert.equal(msg.updated.length, 1)
        assert.deepEqual(msg.removed, ['99'])
    })

    test('each instance only receives its own events', async () => {
        const { channel, provider } = makeChannel()
        const a = new MockWs()
        const b = new MockWs()
        await start(channel, a, 'i1')
        await start(channel, b, 'i2')
        await settle()
        const [subscriberA] = provider!.subscriptions.keys()
        subscriberA.processProviderEvent('v16', { type: 'initial', added: [], updated: [], removed: [] })
        assert.equal(a.data().length, 1)
        assert.equal(b.data().length, 0)
    })

    test('a socket that fails to send is logged, not thrown', async () => {
        const { channel, provider, warnings } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        ws.failing = true
        assert.doesNotThrow(() => provider!.emit({ type: 'update', added: [], updated: [], removed: ['1'] }))
        assert.match(warnings[0], /could not send to instance i1/)
    })
})

describe('unsubscription', () => {
    test('stop unsubscribes and says so', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        const config = await start(channel, ws)
        await settle()
        channel.stopInstance(asWs(ws), config)
        assert.equal(provider!.subscriptions.size, 0)
        assert.equal(channel.containsInstance('i1'), false)
        assert.equal(ws.signals()[0].text, 'V16 Map stopped')
    })

    test('stopping an unknown instance is an error', () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        channel.stopInstance(asWs(ws), instanceConfigFor('nope') as unknown as IInstanceConfig)
        assert.equal(ws.signals()[0].level, 'error')
    })

    test('a connection that goes away takes its subscriptions with it', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1')
        await start(channel, ws, 'i2')
        await settle()
        channel.removeConnection(asWs(ws))
        assert.equal(provider!.subscriptions.size, 0)
        assert.equal(provider!.unsubscribed.length, 2)
        assert.equal(channel.containsConnection(asWs(ws)), false)
    })

    test('deleteObject unsubscribes too', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        const config = await start(channel, ws)
        await settle()
        await channel.deleteObject(asWs(ws), config, '', '', '')
        assert.equal(provider!.subscriptions.size, 0)
    })
})

describe('reconnection', () => {
    test('updateConnection moves the instance to the new socket', async () => {
        const { channel, provider } = makeChannel()
        const old = new MockWs()
        const fresh = new MockWs()
        await start(channel, old)
        await settle()
        assert.equal(channel.updateConnection(asWs(fresh), 'i1'), true)
        provider!.emit({ type: 'update', added: [], updated: [], removed: ['1'] })
        assert.equal(old.data().length, 0)
        assert.equal(fresh.data().length, 1)
    })

    test('refreshConnection only knows its own sockets', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        assert.equal(channel.refreshConnection(asWs(ws)), true)
        assert.equal(channel.refreshConnection(asWs(new MockWs())), false)
    })
})
