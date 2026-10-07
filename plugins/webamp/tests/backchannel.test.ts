import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { IBackChannelObject, IInstanceConfig, IInstanceMessage } from '@kwirthmagnify/kwirth-common-back'
import WebampBackChannel from '../src/back/index'

/*
    The back channel exists only to fulfil the channel contract: the player runs in the browser. What is
    worth checking is that contract against the REAL class — the instance bookkeeping the core and the
    Status channel rely on — and not constants restated here, which pass whatever the code does.
*/

const ws = (): WebSocket => ({}) as unknown as WebSocket
const config = (instance: string): IInstanceConfig => ({ instance }) as unknown as IInstanceConfig
const makeChannel = () => new WebampBackChannel(undefined, {} as unknown as IBackChannelObject)

describe('WebampBackChannel contract', () => {
    it('is an autonomous, pauseable channel with no storage, providers nor endpoints', () => {
        const channel = makeChannel()
        const data = channel.getChannelData()
        assert.equal(channel.channelId, 'webamp')
        assert.equal(data.id, 'webamp')
        assert.equal(data.pauseable, true)
        assert.equal(data.cluster, false)
        assert.equal(data.resourced, false)
        assert.equal(data.routable, false)
        assert.deepEqual(data.endpoints, [])
        assert.deepEqual(channel.requirements, { storage: false, providers: [] })
    })

    it('knows only the none scope', () => {
        const channel = makeChannel()
        assert.equal(channel.getChannelScopeLevel('none'), 1)
        assert.equal(channel.getChannelScopeLevel('cluster'), -1)
        assert.equal(channel.getChannelScopeLevel(''), 0)
    })
})

describe('WebampBackChannel instances', () => {
    it('counts instances and distinct connections', async () => {
        const channel = makeChannel()
        const a = ws()
        const b = ws()
        await channel.addObject(a, config('i1'))
        await channel.addObject(a, config('i2'))
        await channel.addObject(b, config('i3'))
        assert.deepEqual(channel.getInstances(), { instances: 3, connections: 2 })
        assert.equal(channel.containsInstance('i2'), true)
        assert.equal(channel.containsInstance('nope'), false)
        assert.equal(channel.containsConnection(b), true)
    })

    it('stop and remove forget the instance', async () => {
        const channel = makeChannel()
        const a = ws()
        await channel.addObject(a, config('i1'))
        await channel.addObject(a, config('i2'))
        channel.stopInstance(a, config('i1'))
        assert.equal(channel.containsInstance('i1'), false)
        channel.removeInstance(a, 'i2')
        assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
        assert.equal(channel.containsConnection(a), false)
    })

    it('removing a connection drops every instance it carried, and only those', async () => {
        const channel = makeChannel()
        const a = ws()
        const b = ws()
        await channel.addObject(a, config('i1'))
        await channel.addObject(a, config('i2'))
        await channel.addObject(b, config('i3'))
        channel.removeConnection(a)
        assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
        assert.equal(channel.containsInstance('i3'), true)
    })

    it('handles no commands, assets nor objects: everything happens in the browser', async () => {
        const channel = makeChannel()
        assert.equal(await channel.processCommand(ws(), {} as IInstanceMessage), false)
        assert.equal(channel.containsAsset(), false)
        assert.equal(await channel.deleteObject(), false)
        assert.equal(channel.refreshConnection(), true)
    })
})
