import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { IInstanceConfig } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject } from '@kwirthmagnify/kwirth-common-back'
import { ChapeteChannel } from '../../src/back/index'
import { DEFAULT_SYSTEM_PROMPT, EChapeteCommand, EChapeteRole } from '../../src/common/ChapeteTypes'
import { aiStorage, command, instanceConfigFor, llm, makeBackObj, MockWs } from '../helpers'

const makeChannel = (common: Record<string, unknown> = aiStorage(), channelStorage: Record<string, unknown> = {}) => {
    const back = makeBackObj(common, channelStorage)
    const channel = new ChapeteChannel(undefined, back.obj as unknown as IBackChannelObject)
    return { channel, ...back }
}

const start = async (channel: ChapeteChannel, ws: MockWs, instance = 'i1', data = { llmId: 'fake-llm', temperature: 0.9 }) => {
    const config = instanceConfigFor(instance, data) as unknown as IInstanceConfig
    await channel.addObject(ws as unknown as WebSocket, config, '*all', '*all', '*all')
    return config
}

const asWs = (ws: MockWs) => ws as unknown as WebSocket

describe('channel contract', () => {
    test('declares itself as a cluster channel with no resources and storage', () => {
        const { channel } = makeChannel()
        const data = channel.getChannelData()
        assert.equal(data.id, 'chapete')
        assert.equal(data.cluster, true)
        assert.equal(data.resourced, false)
        assert.equal(data.pauseable, false)
        assert.equal(data.modifiable, false)
        assert.equal(channel.requirements.storage, true)
        assert.deepEqual(channel.requirements.providers, [])
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
    })

    test('starting the same instance twice does not duplicate it', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1')
        await start(channel, ws, 'i1')
        assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
    })

    test('stop removes the instance and says so', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        const config = await start(channel, ws)
        channel.stopInstance(asWs(ws), config)
        assert.equal(channel.containsInstance('i1'), false)
        assert.equal(ws.signals().at(-1)?.text, 'Chapete stopped')
    })
})

describe('system prompt', () => {
    test('the default one is sent on start when nothing is stored', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        assert.deepEqual(ws.systems(), [DEFAULT_SYSTEM_PROMPT])
    })

    test('the stored one is sent on start', async () => {
        const { channel } = makeChannel(aiStorage(), { 'chapete-system': 'Answer like a pirate.' })
        const ws = new MockWs()
        await start(channel, ws)
        assert.deepEqual(ws.systems(), ['Answer like a pirate.'])
    })

    test('SETSYSTEM stores it for the whole channel and reports it back', async () => {
        const { channel, channelStore } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        ws.clear()
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.SETSYSTEM, { system: 'Be terse.' }))
        assert.equal(channelStore['chapete-system'], 'Be terse.')
        assert.deepEqual(ws.systems(), ['Be terse.'])

        // another user, on another connection, gets the same one
        const other = new MockWs()
        await start(channel, other, 'i2')
        assert.deepEqual(other.systems(), ['Be terse.'])
    })

    test('an empty system prompt means the default one', async () => {
        const store: Record<string, unknown> = {}
        const { channel } = makeChannel(aiStorage(), store)
        const ws = new MockWs()
        await start(channel, ws)
        ws.clear()
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.SETSYSTEM, { system: '' }))
        assert.equal(store['chapete-system'], '')
        assert.deepEqual(ws.systems(), [DEFAULT_SYSTEM_PROMPT])
    })

    test('GETSYSTEM answers with the current one', async () => {
        const { channel } = makeChannel(aiStorage(), { 'chapete-system': 'X' })
        const ws = new MockWs()
        await start(channel, ws)
        ws.clear()
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.GETSYSTEM))
        assert.deepEqual(ws.systems(), ['X'])
    })

    test('SETSYSTEM without text is refused and stores nothing', async () => {
        const store: Record<string, unknown> = {}
        const { channel } = makeChannel(aiStorage(), store)
        const ws = new MockWs()
        await start(channel, ws)
        ws.clear()
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.SETSYSTEM))
        assert.equal('chapete-system' in store, false)
        assert.match(String(ws.signals().at(-1)?.text), /no text/)
    })
})

describe('ask', () => {
    const ask = (id: string) => ({ ask: { id, messages: [{ role: EChapeteRole.USER, content: 'hi' }] } })

    test('an LLM that is not configured answers with an error, on the same id', async () => {
        const { channel, warnings } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1', { llmId: 'gone', temperature: 0.5 })
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.ASK, ask('q1')))
        const answers = ws.answers()
        assert.equal(answers.length, 1)
        assert.equal(answers[0].id, 'q1')
        assert.match(answers[0].error!, /'gone' is no longer configured/)
        assert.equal(warnings.length, 1)
    })

    test('the LLMs are read on every turn: one added after the start is found', async () => {
        const common = aiStorage([])
        const { channel } = makeChannel(common)
        const ws = new MockWs()
        await start(channel, ws, 'i1', { llmId: 'late', temperature: 0.5 })
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.ASK, ask('q1')))
        assert.match(ws.answers()[0].error!, /no longer configured/)

        // added in the core's AI settings meanwhile, with no key: now it is FOUND, and fails one step later
        common['kwirth-ai-llms'] = [llm({ id: 'late', provider: 'nobody', useProviderKey: true })]
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.ASK, ask('q2')))
        assert.match(ws.answers()[1].error!, /could not be built/)
    })

    test('a storage that fails still answers, instead of leaving the bubble thinking', async () => {
        const { channel, obj } = makeChannel()
        obj.readStorageCommon = async () => { throw new Error('configmap unreachable') }
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.ASK, ask('q1')))
        assert.equal(ws.answers()[0].id, 'q1')
        assert.match(ws.answers()[0].error!, /configmap unreachable/)
    })

    test('ASK without payload is refused with a signal', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command('i1', EChapeteCommand.ASK))
        assert.equal(ws.answers().length, 0)
        assert.match(String(ws.signals().at(-1)?.text), /no payload/)
    })
})

describe('commands that cannot be served', () => {
    test('an unknown instance', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        const handled = await channel.processCommand(asWs(ws), command('nope', EChapeteCommand.GETSYSTEM))
        assert.equal(handled, false)
        assert.match(String(ws.signals().at(-1)?.text), /not found/)
    })

    test('an unknown command', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        const handled = await channel.processCommand(asWs(ws), command('i1', 'bogus' as EChapeteCommand))
        assert.equal(handled, false)
        assert.match(String(ws.signals().at(-1)?.text), /Unknown command 'bogus'/)
    })
})
