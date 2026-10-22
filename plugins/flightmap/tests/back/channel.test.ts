import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { IInstanceConfig } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject } from '@kwirthmagnify/kwirth-common-back'
import { FlightMapChannel } from '../../src/back/index'
import { EFlightMapPayload, IFlightMapInstanceConfig } from '../../src/common/FlightMapTypes'
import { aircraft, clusterInfoWith, FakeFlightStatusProvider, instanceConfigFor, MADRID, makeBackObj, MockWs, positions } from '../helpers'

// null stands for 'the provider is not installed': undefined would pick the default
const makeChannel = (provider: FakeFlightStatusProvider | null = new FakeFlightStatusProvider()) => {
    const back = makeBackObj()
    const info = clusterInfoWith(provider ?? undefined)
    const channel = new FlightMapChannel(info.clusterInfo, back.obj as unknown as IBackChannelObject)
    return { channel, provider, asked: info.asked, ...back }
}

const start = async (channel: FlightMapChannel, ws: MockWs, instance = 'i1', data: IFlightMapInstanceConfig = MADRID) => {
    const config = instanceConfigFor(instance, data) as unknown as IInstanceConfig
    await channel.addObject(ws as unknown as WebSocket, config, '', '', '')
    return config
}

const asWs = (ws: MockWs) => ws as unknown as WebSocket

// let the promise the channel does not await settle
const settle = () => new Promise(resolve => setImmediate(resolve))

describe('channel contract', () => {
    test('is a standalone channel that requires the flight-status provider', () => {
        const { channel } = makeChannel()
        const data = channel.getChannelData()
        assert.equal(data.id, 'flightmap')
        assert.equal(data.cluster, false)
        assert.equal(data.resourced, false)
        assert.deepEqual(channel.requirements.providers, ['flight-status'])
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
    })
})

describe('subscription', () => {
    test('the instance setup is the subscription payload, as is', async () => {
        const { channel, provider, asked } = makeChannel()
        const canarias: IFlightMapInstanceConfig = { bbox: { lamin: 27.4, lomin: -18.4, lamax: 29.5, lomax: -13.3 }, intervalSec: 720, watch: [] }
        await start(channel, new MockWs(), 'i1', canarias)
        await settle()
        assert.deepEqual(asked, ['flight-status'])
        assert.deepEqual([...provider!.subscriptions.values()], [canarias])
    })

    test('two tabs are two subscriptions, each with its own box', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1')
        await start(channel, ws, 'i2', { ...MADRID, intervalSec: 120 })
        await settle()
        assert.deepEqual([...provider!.subscriptions.values()].map(s => (s as IFlightMapInstanceConfig).intervalSec), [60, 120])
    })

    test('without the provider, the tab is told how to fix it', async () => {
        const { channel } = makeChannel(null)
        const ws = new MockWs()
        await start(channel, ws)
        assert.match(String(ws.signals()[0].text), /'flight-status' provider is not installed/)
    })

    test('a provider that rejects the subscription is reported to the tab', async () => {
        const provider = new FakeFlightStatusProvider()
        provider.failSubscribe = true
        const { channel } = makeChannel(provider)
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        assert.match(String(ws.signals()[0].text), /failed while adding the subscriber: Error: invalid bbox/)
    })
})

describe('delivery', () => {
    test('positions reach the tab with their aircraft and timestamp', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        provider!.emit(positions([aircraft('34718e', { callsign: 'IBE3171', trackDeg: 180 })]))
        const [msg] = ws.data()
        assert.equal(msg.msgtype, 'flightmapmessageresponse')
        assert.equal(msg.channel, 'flightmap')
        assert.equal(msg.payloadType, EFlightMapPayload.POSITIONS)
        assert.equal(msg.timestamp, '2026-09-26T10:00:00.000Z')
        assert.equal(msg.aircraft?.[0].callsign, 'IBE3171')
        assert.equal(msg.error, undefined)
    })

    test('an error event carries its message', async () => {
        const { channel, provider } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        provider!.emit({ type: 'error', timestamp: '2026-09-26T10:00:00.000Z', message: 'opensky: no budget left' })
        const [msg] = ws.data()
        assert.equal(msg.payloadType, EFlightMapPayload.ERROR)
        assert.equal(msg.error, 'opensky: no budget left')
    })

    test('a socket that fails to send is logged, not thrown', async () => {
        const { channel, provider, warnings } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await settle()
        ws.failing = true
        assert.doesNotThrow(() => provider!.emit(positions([])))
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
        assert.equal(ws.signals()[0].text, 'Flight Map stopped')
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
    })

    test('updateConnection moves the instance to the new socket', async () => {
        const { channel, provider } = makeChannel()
        const old = new MockWs()
        const fresh = new MockWs()
        await start(channel, old)
        await settle()
        assert.equal(channel.updateConnection(asWs(fresh), 'i1'), true)
        provider!.emit(positions([]))
        assert.equal(old.data().length, 0)
        assert.equal(fresh.data().length, 1)
    })
})
