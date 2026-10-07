import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IBackChannelObject, IInstanceConfig } from '@kwirthmagnify/kwirth-common-back'
import AsteroidsBackChannel, { MSG_SCORES, MSG_SCORES_GET, MSG_SCORE_SUBMIT } from '../src/back/index'

/*
    The back end only does one thing, but it is the only one that survives closing the browser: saving the
    scoreboard in a cluster ConfigMap. What is tested here are the three real pitfalls:

    - registering the instance (without that the core drops the commands),
    - sanitising what arrives (the front end is user code, not a trusted source),
    - and not losing the turn when the write fails, which would leave the player hanging for 5s.
*/

interface IFakeSocket {
    sent: Record<string, unknown>[]
    send: (text: string) => void
}

const fakeSocket = (): IFakeSocket => {
    const sent: Record<string, unknown>[] = []
    return { sent, send: (text: string) => { sent.push(JSON.parse(text)) } }
}

interface IFakeStorage {
    written: unknown[]
    object: IBackChannelObject
    errors: string[]
}

interface ISentNotification {
    senderId: string
    configName: string
    subject: string
    body: string
}

const notifications: ISentNotification[] = []

const fakeStorage = (initial?: unknown, failWrite = false): IFakeStorage => {
    let stored: unknown = initial
    const written: unknown[] = []
    const errors: string[] = []
    const object = {
        senders: {
            send: async (senderId: string, configName: string, message: { subject: string, body: string }) => {
                notifications.push({ senderId, configName, subject: message.subject, body: message.body })
            },
        },
        logInfo: () => { },
        logTrace: () => { },
        logWarning: (message: unknown) => { errors.push(String(message)) },
        logError: (message: unknown) => { errors.push(String(message)) },
        readStorage: async () => stored,
        writeStorage: async (_id: string, _secret: boolean, data: unknown) => {
            if (failWrite) throw new Error('configmap down')
            written.push(data)
            stored = data
        },
    } as unknown as IBackChannelObject
    return { written, object, errors }
}

const instanceConfig = (instance: string): IInstanceConfig =>
    ({ instance } as unknown as IInstanceConfig)

const submitMessage = (instance: string, entry: unknown) =>
    ({ msgtype: MSG_SCORE_SUBMIT, instance, entry }) as never

const getMessage = (instance: string) =>
    ({ msgtype: MSG_SCORES_GET, instance }) as never

/** processCommand queues the work: the queue has to drain before looking at the result. */
const drain = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10))

// ── Instance registration ─────────────────────────────────────────────────

test('addObject registers the instance: without that the core drops the commands', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    assert.equal(channel.containsInstance('i1'), false)
    await channel.addObject(socket as never, instanceConfig('i1'))
    assert.equal(channel.containsInstance('i1'), true)
})

test('each tab is a different instance', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    await channel.addObject(fakeSocket() as never, instanceConfig('i1'))
    await channel.addObject(fakeSocket() as never, instanceConfig('i2'))
    assert.equal(channel.containsInstance('i1'), true)
    assert.equal(channel.containsInstance('i2'), true)
    assert.equal(channel.containsInstance('i3'), false)
})

test('stopInstance unregisters only its own', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    await channel.addObject(fakeSocket() as never, instanceConfig('i1'))
    await channel.addObject(fakeSocket() as never, instanceConfig('i2'))
    channel.stopInstance(fakeSocket() as never, instanceConfig('i1'))
    assert.equal(channel.containsInstance('i1'), false)
    assert.equal(channel.containsInstance('i2'), true)
})

test('removeConnection cleans up by socket, not by instance', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    const doomed = fakeSocket()
    const survivor = fakeSocket()
    await channel.addObject(doomed as never, instanceConfig('i1'))
    await channel.addObject(survivor as never, instanceConfig('i2'))
    assert.equal(channel.containsConnection(doomed as never), true)
    channel.removeConnection(doomed as never)
    assert.equal(channel.containsInstance('i1'), false)
    assert.equal(channel.containsInstance('i2'), true)
})

// ── Reading the table ─────────────────────────────────────────────────────

test('MSG_SCORES_GET returns the stored table, sorted', async () => {
    const storage = fakeStorage([
        { name: 'low', score: 10, level: 1, date: 'd' },
        { name: 'high', score: 90, level: 3, date: 'd' },
    ])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, getMessage('i1'))
    await drain()
    assert.equal(socket.sent.length, 1)
    assert.equal(socket.sent[0].msgtype, MSG_SCORES)
    const scores = socket.sent[0].scores as { name: string }[]
    assert.deepEqual(scores.map(s => s.name), ['high', 'low'])
})

test('an empty or unreadable store gives an empty table, not an error', async () => {
    for (const initial of [undefined, null, 'i am not an array', 42]) {
        const storage = fakeStorage(initial)
        const channel = new AsteroidsBackChannel({}, storage.object)
        const socket = fakeSocket()
        await channel.addObject(socket as never, instanceConfig('i1'))
        await channel.processCommand(socket as never, getMessage('i1'))
        await drain()
        assert.deepEqual(socket.sent[0].scores, [])
    }
})

// ── Saving ────────────────────────────────────────────────────────────────

test('MSG_SCORE_SUBMIT persists the entry and broadcasts it', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: 'me', score: 100, level: 2 }))
    await drain()
    assert.equal(storage.written.length, 1)
    const saved = storage.written[0] as { name: string, score: number }[]
    assert.equal(saved[0].name, 'me')
    assert.equal(saved[0].score, 100)
    assert.equal(socket.sent[0].msgtype, MSG_SCORES)
})

test('the broadcast reaches ALL tabs, not only the one that scored', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const player = fakeSocket()
    const spectator = fakeSocket()
    await channel.addObject(player as never, instanceConfig('i1'))
    await channel.addObject(spectator as never, instanceConfig('i2'))
    await channel.processCommand(player as never, submitMessage('i1', { name: 'me', score: 100 }))
    await drain()
    assert.equal(player.sent.length, 1)
    assert.equal(spectator.sent.length, 1, 'the spectator sees the new table without reloading')
    assert.equal(spectator.sent[0].instance, 'i2', 'each one receives its own instanceId')
})

test('the table stays sorted and trimmed to 10 when inserting', async () => {
    const initial = Array.from({ length: 10 }, (_, i) => ({ name: `p${i}`, score: (i + 1) * 100, level: 1, date: 'd' }))
    const storage = fakeStorage(initial)
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: 'champion', score: 99999 }))
    await drain()
    const saved = storage.written[0] as { name: string }[]
    assert.equal(saved.length, 10)
    assert.equal(saved[0].name, 'champion')
})

// ── Sanitising: the front end is not to be trusted ────────────────────────

test('a zero or negative score is not saved', async () => {
    for (const score of [0, -100]) {
        const storage = fakeStorage([])
        const channel = new AsteroidsBackChannel({}, storage.object)
        const socket = fakeSocket()
        await channel.addObject(socket as never, instanceConfig('i1'))
        await channel.processCommand(socket as never, submitMessage('i1', { name: 'cheater', score }))
        await drain()
        assert.equal(storage.written.length, 0, `score ${score} must not be persisted`)
    }
})

test('the name is stripped of control characters and trimmed to the cap', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: '  a bc-really-long-names  ', score: 10 }))
    await drain()
    const saved = storage.written[0] as { name: string }[]
    assert.equal(saved[0].name.length <= 24, true)
    assert.equal(/[ -]/.test(saved[0].name), false)
})

test('without a name it is saved as anon', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { score: 10 }))
    await drain()
    const saved = storage.written[0] as { name: string }[]
    assert.equal(saved[0].name, 'anon')
})

test('the date is set by the back end, not by the front end', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: 'me', score: 10, date: 'next year' }))
    await drain()
    const saved = storage.written[0] as { date: string }[]
    assert.notEqual(saved[0].date, 'next year')
    assert.equal(Number.isNaN(Date.parse(saved[0].date)), false)
})

test('a text score does not get through', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: 'me', score: 'a whole lot' }))
    await drain()
    assert.equal(storage.written.length, 0)
})

// ── Failures and unknown messages ─────────────────────────────────────────

test('if the write fails a reply is sent anyway: the front end is not left hanging', async () => {
    const storage = fakeStorage([], true)
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    await channel.processCommand(socket as never, submitMessage('i1', { name: 'me', score: 10 }))
    await drain()
    assert.equal(socket.sent.length, 1, 'there is a reply despite the failure')
    assert.equal(socket.sent[0].msgtype, MSG_SCORES)
    assert.equal(storage.errors.length > 0, true, 'and the failure leaves a trace')
})

test('an unknown msgtype is declined, not swallowed', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))
    const handled = await channel.processCommand(socket as never, { msgtype: 'does-not-exist', instance: 'i1' } as never)
    assert.equal(handled, false)
})

test('a dead socket while broadcasting does not bring the channel down', async () => {
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const broken = { send: () => { throw new Error('socket closed') } }
    const healthy = fakeSocket()
    await channel.addObject(broken as never, instanceConfig('i1'))
    await channel.addObject(healthy as never, instanceConfig('i2'))
    await channel.processCommand(healthy as never, submitMessage('i2', { name: 'me', score: 10 }))
    await drain()
    assert.equal(healthy.sent.length, 1, 'the healthy one receives even if the other blows up')
})

// ── Channel metadata ──────────────────────────────────────────────────────

test('the channel declares itself standalone: neither cluster nor resources', () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    const data = channel.getChannelData()
    assert.equal(data.id, 'asteroids')
    assert.equal(data.cluster, false)
    assert.equal(data.resourced, false)
    assert.equal(data.pauseable, true)
})

test('it only accepts the none scope', () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    assert.equal(channel.getChannelScopeLevel('none') >= 0, true)
    assert.equal(channel.getChannelScopeLevel('cluster'), -1)
    assert.equal(channel.getChannelScopeLevel('namespace'), -1)
})

// ── Record notification through a sender ──────────────────────────────────

const instanceConfigWithSender = (instance: string): IInstanceConfig =>
    ({ instance, data: { senderId: 'teams', senderConfigName: 'default' } } as unknown as IInstanceConfig)

const submitFrom = async (channel: AsteroidsBackChannel, socket: IFakeSocket, instance: string, entry: unknown): Promise<void> => {
    await channel.processCommand(socket as never, submitMessage(instance, entry))
    await drain()
}

test('beating the number one notifies through the configured sender', async () => {
    notifications.length = 0
    const storage = fakeStorage([{ name: 'champion', score: 100, level: 2, date: 'd' }])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 500, level: 3 })
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].senderId, 'teams')
    assert.equal(notifications[0].configName, 'default')
    assert.equal(notifications[0].subject.includes('me'), true)
    assert.equal(notifications[0].body.includes('500'), true)
    assert.equal(notifications[0].body.includes('champion'), true, 'whoever held the record is named')
})

test('getting into the table WITHOUT ending up first does not notify', async () => {
    notifications.length = 0
    const storage = fakeStorage([{ name: 'champion', score: 1000, level: 5, date: 'd' }])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 10, level: 1 })
    assert.equal(notifications.length, 0)
})

test('tying the record is NOT beating it', async () => {
    notifications.length = 0
    const storage = fakeStorage([{ name: 'champion', score: 100, level: 2, date: 'd' }])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 100, level: 2 })
    assert.equal(notifications.length, 0)
})

test('the first record of an empty table also notifies', async () => {
    notifications.length = 0
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 42, level: 1 })
    assert.equal(notifications.length, 1)
    assert.equal(notifications[0].body.includes('nobody'), true)
})

test('with no sender configured nothing is notified', async () => {
    notifications.length = 0
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfig('i1'))   // no data.senderId
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 999, level: 9 })
    assert.equal(notifications.length, 0)
})

test('a score that fails sanitising does not notify even if there is a sender', async () => {
    notifications.length = 0
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'cheater', score: 0 })
    assert.equal(notifications.length, 0)
})

test('if writing the scoreboard fails the record is NOT announced', async () => {
    notifications.length = 0
    const storage = fakeStorage([], true)
    const channel = new AsteroidsBackChannel({}, storage.object)
    const socket = fakeSocket()
    await channel.addObject(socket as never, instanceConfigWithSender('i1'))
    await submitFrom(channel, socket, 'i1', { name: 'me', score: 999, level: 9 })
    assert.equal(notifications.length, 0, 'announcing a record that has not been saved would be lying')
})

test('the sender belongs to the instance that scores, not to the channel', async () => {
    notifications.length = 0
    const storage = fakeStorage([])
    const channel = new AsteroidsBackChannel({}, storage.object)
    const withSender = fakeSocket()
    const without = fakeSocket()
    await channel.addObject(withSender as never, instanceConfigWithSender('i1'))
    await channel.addObject(without as never, instanceConfig('i2'))
    await submitFrom(channel, without, 'i2', { name: 'other', score: 300, level: 2 })
    assert.equal(notifications.length, 0, 'the tab that scored has no sender')
})

// ── getInstances: what the core shows as the channel's activity ───────────

test('a freshly created channel reports neither instances nor connections', () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    assert.deepEqual(channel.getInstances(), { instances: 0, connections: 0 })
})

test('each tab adds one instance and its connection', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    await channel.addObject(fakeSocket() as never, instanceConfig('i1'))
    await channel.addObject(fakeSocket() as never, instanceConfig('i2'))
    assert.deepEqual(channel.getInstances(), { instances: 2, connections: 2 })
})

test('several tabs of the SAME browser are a single connection', async () => {
    /*
        This is the reason the two figures exist separately: a browser carries all its tabs
        over a single websocket. Counting list entries would give two connections where there is only one.
    */
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    const shared = fakeSocket()
    await channel.addObject(shared as never, instanceConfig('i1'))
    await channel.addObject(shared as never, instanceConfig('i2'))
    assert.deepEqual(channel.getInstances(), { instances: 2, connections: 1 })
})

test('closing the connection subtracts its instances', async () => {
    const storage = fakeStorage()
    const channel = new AsteroidsBackChannel({}, storage.object)
    const doomed = fakeSocket()
    const survivor = fakeSocket()
    await channel.addObject(doomed as never, instanceConfig('i1'))
    await channel.addObject(doomed as never, instanceConfig('i2'))
    await channel.addObject(survivor as never, instanceConfig('i3'))
    channel.removeConnection(doomed as never)
    assert.deepEqual(channel.getInstances(), { instances: 1, connections: 1 })
})
