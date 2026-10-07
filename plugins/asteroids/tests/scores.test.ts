import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    BackScoreStore, LocalScoreStore, IScoreEntry, MAX_SCORES,
    MAX_NAME, MSG_SCORES_GET, MSG_SCORE_SUBMIT, qualifies, sanitizeEntries, socketSender, sortAndTrim
} from '../src/front/AsteroidsScores'

/*
    The scoreboard is the only part of the plugin with SHARED state: the game runs entirely in the
    browser and is lost, but the table lives in a cluster ConfigMap and everybody sees it. That is why
    what is tested here is the contract with the back end, not the game.

    The most important test in this file is the accessKey one: the core SILENTLY drops every
    command that does not carry it, without a single visible error, and the front end only sees a 5s timeout. That failure
    cost a whole diagnosis session and has bitten several plugins over the months.
*/

const entry = (name: string, score: number, level = 1): IScoreEntry =>
    ({ name, score, level, date: '2026-01-01T00:00:00.000Z' })

// ── sortAndTrim ───────────────────────────────────────────────────────────

test('sortAndTrim sorts from highest to lowest', () => {
    const sorted = sortAndTrim([entry('a', 10), entry('b', 30), entry('c', 20)])
    assert.deepEqual(sorted.map(e => e.name), ['b', 'c', 'a'])
})

test('sortAndTrim trims to MAX_SCORES and keeps the best ones', () => {
    const many = Array.from({ length: 25 }, (_, i) => entry(`p${i}`, i + 1))
    const sorted = sortAndTrim(many)
    assert.equal(sorted.length, MAX_SCORES)
    assert.equal(sorted[0].score, 25)
    assert.equal(sorted[MAX_SCORES - 1].score, 25 - MAX_SCORES + 1)
})

test('sortAndTrim does not mutate its input', () => {
    const original = [entry('a', 10), entry('b', 30)]
    sortAndTrim(original)
    assert.deepEqual(original.map(e => e.name), ['a', 'b'])
})

// ── qualifies ─────────────────────────────────────────────────────────────

test('qualifies rejects a zero: no name is asked for not having played', () => {
    assert.equal(qualifies([], 0), false)
    assert.equal(qualifies([], -5), false)
})

test('qualifies accepts any positive score while there is a free slot', () => {
    assert.equal(qualifies([], 1), true)
    assert.equal(qualifies([entry('a', 9999)], 1), true)
})

test('qualifies with a full table compares against the LAST one', () => {
    const full = Array.from({ length: MAX_SCORES }, (_, i) => entry(`p${i}`, (i + 1) * 100))
    const table = sortAndTrim(full)     // last = 100
    assert.equal(qualifies(table, 101), true)
    assert.equal(qualifies(table, 100), false, 'tying with the last one does NOT get in')
    assert.equal(qualifies(table, 99), false)
})

// ── sanitizeEntries ───────────────────────────────────────────────────────

test('sanitizeEntries discards anything that is not a table', () => {
    assert.deepEqual(sanitizeEntries(undefined), [])
    assert.deepEqual(sanitizeEntries(null), [])
    assert.deepEqual(sanitizeEntries('i am not an array'), [])
    assert.deepEqual(sanitizeEntries({ score: 10 }), [])
})

test('sanitizeEntries filters out entries without a numeric score or without a name', () => {
    const clean = sanitizeEntries([
        { name: 'ok', score: 10, level: 2, date: 'd' },
        { name: 'no score' },
        { score: 50 },
        { name: 'text score', score: '50' },
        null,
    ])
    assert.equal(clean.length, 1)
    assert.equal(clean[0].name, 'ok')
})

test('sanitizeEntries trims the name to the cap', () => {
    const clean = sanitizeEntries([{ name: 'x'.repeat(80), score: 10 }])
    assert.equal(clean[0].name.length, MAX_NAME)
})

test('the name cap leaves room for a real Kwirth user', () => {
    // Since the name became the logged-in user, cutting at 12 split identities in half.
    const clean = sanitizeEntries([{ name: 'julio.fernandezvila', score: 10 }])
    assert.equal(clean[0].name, 'julio.fernandezvila')
})

test('sanitizeEntries sets level 0 and an empty date when they are missing', () => {
    const clean = sanitizeEntries([{ name: 'x', score: 10 }])
    assert.equal(clean[0].level, 0)
    assert.equal(clean[0].date, '')
})

test('sanitizeEntries also sorts and trims', () => {
    const raw = Array.from({ length: 15 }, (_, i) => ({ name: `p${i}`, score: i + 1 }))
    const clean = sanitizeEntries(raw)
    assert.equal(clean.length, MAX_SCORES)
    assert.equal(clean[0].score, 15)
})

// ── BackScoreStore: contract with the back end ────────────────────────────

interface ISentMessage {
    msgtype: string
    channel: string
    instance: string
    accessKey: string
    entry?: IScoreEntry
    [key: string]: unknown
}

const storeWith = (accessKey = 'ak-123', instance = 'inst-1') => {
    const sent: ISentMessage[] = []
    const store = new BackScoreStore(
        (message) => { sent.push(message as ISentMessage); return true },
        () => instance,
        () => accessKey,
    )
    return { sent, store }
}

test('REGRESSION: every command carries accessKey — without it, the core silently drops it', () => {
    const { sent, store } = storeWith('my-access-key')
    void store.load()
    void store.submit(entry('me', 100))
    assert.equal(sent.length, 2)
    for (const message of sent) {
        assert.equal(message.accessKey, 'my-access-key', `${message.msgtype} travels without accessKey`)
    }
})

test('load sends MSG_SCORES_GET with channel and instance', () => {
    const { sent, store } = storeWith('ak', 'the-instance')
    void store.load()
    assert.equal(sent[0].msgtype, MSG_SCORES_GET)
    assert.equal(sent[0].channel, 'asteroids')
    assert.equal(sent[0].instance, 'the-instance')
    assert.equal(sent[0].entry, undefined)
})

test('submit sends MSG_SCORE_SUBMIT with ONE entry, never the whole table', () => {
    const { sent, store } = storeWith()
    const mine = entry('me', 420, 3)
    void store.submit(mine)
    assert.equal(sent[0].msgtype, MSG_SCORE_SUBMIT)
    assert.deepEqual(sent[0].entry, mine)
    assert.equal((sent[0] as Record<string, unknown>).scores, undefined, 'the table is not sent: the front end copy may be stale')
})

test('the accessKey is read on EVERY send, it is not frozen in the constructor', () => {
    const sent: ISentMessage[] = []
    let current = 'first'
    const store = new BackScoreStore(
        (message) => { sent.push(message as ISentMessage); return true },
        () => 'i',
        () => current,
    )
    void store.load()
    current = 'renewed'
    void store.load()
    assert.equal(sent[0].accessKey, 'first')
    assert.equal(sent[1].accessKey, 'renewed')
})

test('if the socket does not take it, it resolves empty without leaving the player hanging', async () => {
    const store = new BackScoreStore(() => false, () => 'i', () => 'ak')
    assert.deepEqual(await store.load(), [])
    assert.deepEqual(await store.submit(entry('me', 10)), [])
})

test('resolve hands the table to whoever was waiting', async () => {
    const { store } = storeWith()
    const pending = store.submit(entry('me', 10))
    const table = [entry('me', 10)]
    store.resolve(table)
    assert.deepEqual(await pending, table)
})

test('resolve wakes up ALL the waiters at once', async () => {
    const { store } = storeWith()
    const first = store.load()
    const second = store.submit(entry('me', 10))
    store.resolve([entry('me', 10)])
    const [a, b] = await Promise.all([first, second])
    assert.equal(a.length, 1)
    assert.equal(b.length, 1)
})

test('a later resolve with nobody waiting does not blow up', () => {
    const { store } = storeWith()
    assert.doesNotThrow(() => store.resolve([entry('x', 1)]))
})

// ── LocalScoreStore: safety net without a socket ──────────────────────────

const withLocalStorage = (): void => {
    const data = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
        getItem: (k: string) => data.has(k) ? data.get(k)! : null,
        setItem: (k: string, v: string) => { data.set(k, v) },
        removeItem: (k: string) => { data.delete(k) },
        clear: () => { data.clear() },
    }
}

test('LocalScoreStore starts empty and persists what it is sent', async () => {
    withLocalStorage()
    const store = new LocalScoreStore()
    assert.deepEqual(await store.load(), [])
    await store.submit(entry('me', 10))
    const reloaded = await new LocalScoreStore().load()
    assert.equal(reloaded.length, 1)
    assert.equal(reloaded[0].name, 'me')
})

test('LocalScoreStore sorts and trims the same way as the back end', async () => {
    withLocalStorage()
    const store = new LocalScoreStore()
    for (let i = 1; i <= 15; i++) await store.submit(entry(`p${i}`, i * 10))
    const table = await store.load()
    assert.equal(table.length, MAX_SCORES)
    assert.equal(table[0].score, 150)
})

test('LocalScoreStore tolerates garbage in localStorage without bringing the game down', async () => {
    withLocalStorage()
    localStorage.setItem('kwirth.asteroids.scores', '{not json')
    assert.deepEqual(await new LocalScoreStore().load(), [])
})

// ── socketSender: the socket is requested on EVERY send ───────────────────

interface IFakeWebSocket {
    readyState: number
    sent: string[]
    send: (text: string) => void
}

const fakeWebSocket = (readyState = WebSocket.OPEN): IFakeWebSocket => {
    const sent: string[] = []
    return { readyState, sent, send: (text: string) => { sent.push(text) } }
}

test('REGRESSION: after restarting the channel the NEW socket is used, not the captured one', () => {
    /*
        This is the bug that silently lost scores: the store captured the socket when it was
        created, and stopping and starting the channel opens a new one. The old one is left closed, the send fails and
        the score is lost right after the action with which the user tries to fix it.
    */
    const oldSocket = fakeWebSocket()
    const newSocket = fakeWebSocket()
    let current: IFakeWebSocket = oldSocket
    const send = socketSender(() => current as unknown as WebSocket)

    assert.equal(send({ a: 1 }), true)
    assert.equal(oldSocket.sent.length, 1)

    // Channel restart: old socket closed, new socket in its place.
    oldSocket.readyState = WebSocket.CLOSED
    current = newSocket

    assert.equal(send({ b: 2 }), true, 'it should send through the new socket')
    assert.equal(newSocket.sent.length, 1)
    assert.equal(oldSocket.sent.length, 1, 'the old socket is not used again')
})

test('socketSender does not send through a socket that is not open', () => {
    for (const state of [WebSocket.CONNECTING, WebSocket.CLOSING, WebSocket.CLOSED]) {
        const socket = fakeWebSocket(state)
        const send = socketSender(() => socket as unknown as WebSocket)
        assert.equal(send({ a: 1 }), false)
        assert.equal(socket.sent.length, 0)
    }
})

test('socketSender without a socket returns false instead of blowing up', () => {
    assert.equal(socketSender(() => undefined)({ a: 1 }), false)
})

test('socketSender serialises the message to JSON', () => {
    const socket = fakeWebSocket()
    socketSender(() => socket as unknown as WebSocket)({ msgtype: 'x', n: 2 })
    assert.deepEqual(JSON.parse(socket.sent[0]), { msgtype: 'x', n: 2 })
})

test('if the socket blows up while sending, false is returned and the error does not propagate', () => {
    const socket = { readyState: WebSocket.OPEN, send: () => { throw new Error('broken socket') } }
    assert.equal(socketSender(() => socket as unknown as WebSocket)({ a: 1 }), false)
})
