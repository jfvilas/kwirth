import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { IBackChannelObject, IInstanceConfig, IInstanceMessage } from '@kwirthmagnify/kwirth-common-back'
import PacmanBackChannel, { MSG_SCORES, MSG_SCORES_GET, MSG_SCORE_SUBMIT } from '../../src/back/index'

/*
    The back end only keeps the high-score table, so that is what is checked: what it stores, what it
    refuses, and who gets told. Storage and senders are fakes; nothing leaves the process.
*/

class MockWs {
    sent: Array<Record<string, unknown>> = []
    send(s: string): void { this.sent.push(JSON.parse(s)) }
    scores(): Array<Record<string, unknown>> | undefined {
        const last = this.sent.filter(m => m.msgtype === MSG_SCORES).at(-1)
        return last?.scores as Array<Record<string, unknown>> | undefined
    }
}

interface ISent { senderId: string, configName: string, message: { subject?: string, body: string } }

const makeChannel = (stored: unknown = undefined, failWrite = false) => {
    const store: Record<string, unknown> = { 'pacman-scores': stored }
    const sent: ISent[] = []
    const errors: string[] = []
    const warnings: string[] = []
    const obj = {
        readStorage: async (id: string) => store[id],
        writeStorage: async (id: string, _secret: boolean, value: unknown) => {
            if (failWrite) throw new Error('configmap is read-only')
            store[id] = value
        },
        logError: (t: string) => { errors.push(t) },
        logWarning: (t: string) => { warnings.push(t) },
        senders: { send: async (senderId: string, configName: string, message: ISent['message']) => { sent.push({ senderId, configName, message }) } }
    }
    const channel = new PacmanBackChannel(undefined, obj as unknown as IBackChannelObject)
    return { channel, store, sent, errors, warnings }
}

const start = async (channel: PacmanBackChannel, ws: MockWs, instance = 'i1', data: Record<string, unknown> = {}) =>
    channel.addObject(ws as unknown as WebSocket, { instance, data } as unknown as IInstanceConfig)

const command = (msgtype: string, extra: Record<string, unknown> = {}, instance = 'i1'): IInstanceMessage =>
    ({ msgtype, instance, ...extra }) as unknown as IInstanceMessage

// processCommand queues the work; this waits for the queue to drain
const settle = () => new Promise(r => setTimeout(r, 20))

const asWs = (ws: MockWs) => ws as unknown as WebSocket

describe('channel contract', () => {
    test('autonomous, pauseable, with storage and no providers', () => {
        const { channel } = makeChannel()
        const data = channel.getChannelData()
        assert.equal(data.id, 'pacman')
        assert.equal(data.cluster, false)
        assert.equal(data.resourced, false)
        assert.equal(data.pauseable, true)
        assert.deepEqual(channel.requirements, { storage: true, providers: [] })
        assert.equal(channel.getChannelScopeLevel('none'), 1)
    })

    test('counts instances and connections, and forgets them', async () => {
        const { channel } = makeChannel()
        const a = new MockWs()
        const b = new MockWs()
        await start(channel, a, 'i1')
        await start(channel, a, 'i2')
        await start(channel, b, 'i3')
        assert.deepEqual(channel.getInstances(), { instances: 3, connections: 2 })
        channel.stopInstance(asWs(a), { instance: 'i1' } as unknown as IInstanceConfig)
        channel.removeConnection(asWs(b))
        assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
        assert.equal(channel.containsInstance('i2'), true)
    })

    test('an unknown command is not handled', async () => {
        const { channel } = makeChannel()
        assert.equal(await channel.processCommand(asWs(new MockWs()), command('bogus')), false)
    })
})

describe('reading the table', () => {
    test('nothing stored is an empty table', async () => {
        const { channel } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORES_GET))
        await settle()
        assert.deepEqual(ws.scores(), [])
    })

    test('what is read is sanitised, sorted and trimmed to 10', async () => {
        const stored = Array.from({ length: 12 }, (_v, i) => ({ name: `p${i}`, score: (i + 1) * 100, level: 1, date: 'x' }))
        stored.push({ name: 'bad', score: -5, level: 1, date: 'x' })
        const { channel } = makeChannel(stored)
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORES_GET))
        await settle()
        const scores = ws.scores()!
        assert.equal(scores.length, 10)
        assert.equal(scores[0].score, 1200)
        assert.equal(scores[9].score, 300)
        assert.equal(scores.some(s => s.name === 'bad'), false)
    })

    test('an unreadable table starts empty and says so', async () => {
        const { channel, warnings } = makeChannel()
        ;(channel.backChannelObject as unknown as { readStorage: () => Promise<unknown> }).readStorage = async () => { throw new Error('boom') }
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORES_GET))
        await settle()
        assert.deepEqual(ws.scores(), [])
        assert.match(warnings[0], /unreadable high scores/)
    })
})

describe('submitting a score', () => {
    test('it is stored sanitised, and every open tab gets the new table', async () => {
        const { channel, store } = makeChannel()
        const a = new MockWs()
        const b = new MockWs()
        await start(channel, a, 'i1')
        await start(channel, b, 'i2')
        await channel.processCommand(asWs(a), command(MSG_SCORE_SUBMIT, { entry: { name: '  ana\u0007 ', score: 1234.9, level: 2.7, date: '1999-01-01' } }))
        await settle()
        const saved = store['pacman-scores'] as Array<Record<string, unknown>>
        assert.equal(saved.length, 1)
        assert.equal(saved[0].name, 'ana')
        assert.equal(saved[0].score, 1234)
        assert.equal(saved[0].level, 2)
        assert.notEqual(saved[0].date, '1999-01-01')
        assert.deepEqual(a.scores(), saved)
        assert.deepEqual(b.scores(), saved)
    })

    test('a score of zero or less is not stored', async () => {
        const { channel, store } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'x', score: 0, level: 1 } }))
        await settle()
        assert.equal(store['pacman-scores'], undefined)
        assert.deepEqual(ws.scores(), [])
    })

    test('a long or empty name is cut or replaced', async () => {
        const { channel, store } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'x'.repeat(40), score: 10, level: 1 } }))
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: '   ', score: 5, level: 1 } }))
        await settle()
        const saved = store['pacman-scores'] as Array<Record<string, unknown>>
        assert.equal((saved[0].name as string).length, 24)
        assert.equal(saved[1].name, 'anon')
    })

    test('two games ending at once are both kept: submissions are queued', async () => {
        const { channel, store } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await Promise.all([
            channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'a', score: 100, level: 1 } })),
            channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'b', score: 200, level: 1 } }))
        ])
        await settle()
        assert.deepEqual((store['pacman-scores'] as Array<Record<string, unknown>>).map(s => s.name), ['b', 'a'])
    })

    test('a storage that refuses the write keeps the old table and logs why', async () => {
        const previous = [{ name: 'old', score: 50, level: 1, date: 'x' }]
        const { channel, errors } = makeChannel(previous, true)
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'new', score: 900, level: 1 } }))
        await settle()
        assert.deepEqual(ws.scores()!.map(s => s.name), ['old'])
        assert.match(errors[0], /could not store the high scores: Error: configmap is read-only/)
    })
})

describe('the record notification', () => {
    const withSender = { senderId: 'mail', senderConfigName: 'team' }

    test('beating the first place notifies the configured sender, in English', async () => {
        const { channel, sent } = makeChannel([{ name: 'old', score: 500, level: 3, date: 'x' }])
        const ws = new MockWs()
        await start(channel, ws, 'i1', withSender)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'ana', score: 900, level: 4 } }))
        await settle()
        assert.equal(sent.length, 1)
        assert.equal(sent[0].senderId, 'mail')
        assert.equal(sent[0].configName, 'team')
        assert.equal(sent[0].message.subject, 'Pac-Man: new record by ana')
        assert.equal(sent[0].message.body, 'ana scored 900 points on level 4. The previous record was held by old (500).')
    })

    test('the first score ever is a record held before by nobody', async () => {
        const { channel, sent } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws, 'i1', withSender)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'ana', score: 10, level: 1 } }))
        await settle()
        assert.match(sent[0].message.body, /held by nobody\.$/)
    })

    test('a score that does not take the first place notifies nobody', async () => {
        const { channel, sent } = makeChannel([{ name: 'old', score: 500, level: 3, date: 'x' }])
        const ws = new MockWs()
        await start(channel, ws, 'i1', withSender)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'ana', score: 400, level: 1 } }))
        await settle()
        assert.equal(sent.length, 0)
    })

    test('without a sender in the setup, a record notifies nobody', async () => {
        const { channel, sent } = makeChannel()
        const ws = new MockWs()
        await start(channel, ws)
        await channel.processCommand(asWs(ws), command(MSG_SCORE_SUBMIT, { entry: { name: 'ana', score: 900, level: 1 } }))
        await settle()
        assert.equal(sent.length, 0)
    })
})
