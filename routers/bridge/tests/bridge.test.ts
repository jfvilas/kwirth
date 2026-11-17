// Two bridges in one process, each behind a fake core: its /router/bridge dispatcher (what the real core does
// after authenticating) and its loopback, which echoes what reaches it. The link between them is a real
// WebSocket. What is checked is what the PRD promises: one link, traffic both ways, the destination's
// credential carried untouched, one sibling only, and coming back on its own.

import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import http from 'http'
import express from 'express'
import WebSocket, { WebSocketServer } from 'ws'
import { AddressInfo } from 'net'
import { ERouteCallerVia, IRouteCaller, IRouterContext } from '@kwirthmagnify/kwirth-common-back'
import BridgeRouter, { DEFAULT_HEARTBEAT_SECONDS, PROBE_MS, bridgeConfigOf, keyHasScope, linkUrlOf, splitClusterPath } from '../src/index'
import { EFrameType, parseFrame } from '../src/Protocol'

const PEER_KEY = 'peer-key|permanent|bridge$peer::::'

interface IFakeCore {
    url: string
    bridge: BridgeRouter
    seen: { method: string, path: string, authorization?: string, body: string }[]
    logs: string[]
    close: () => Promise<void>
}

/*
    A fake core: '/router/bridge/...' goes to the bridge with the caller the real core would have built (a
    ticket for a session; an access key for the link, its scope from the key), and anything else is its
    LOOPBACK, which echoes the request (HTTP) or the messages (WS).
*/
const fakeCore = async (uid: string, name: string): Promise<IFakeCore> => {
    const seen: IFakeCore['seen'] = []
    const logs: string[] = []
    const app = express()
    let bridge!: BridgeRouter
    app.use('/router/bridge', (req, res) => bridge.routerRequest(req, res, { via: ERouteCallerVia.TICKET }))
    app.use((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
            seen.push({ method: req.method, path: req.url, authorization: req.headers.authorization, body: Buffer.concat(chunks).toString() })
            res.json({ from: name, method: req.method, path: req.url })
        })
    })
    const server = http.createServer(app)
    const wss = new WebSocketServer({ server })
    wss.on('connection', (ws, req) => {
        const url = req.url ?? '/'
        if (url.startsWith('/router/bridge/')) {
            const authorization = req.headers.authorization ?? ''
            const caller: IRouteCaller = authorization
                ? { via: ERouteCallerVia.ACCESS_KEY, accessKey: { id: 'k', type: 'permanent', resources: authorization.replace('Bearer ', '').split('|')[2] ?? '' } as never }
                : { via: ERouteCallerVia.TICKET }
            req.url = url.slice('/router/bridge'.length)
            bridge.routerWebsocket(ws as unknown as globalThis.WebSocket, req, caller)
            return
        }
        // loopback WebSocket: says where it is, then echoes
        ws.send(`${name}${url}`)
        ws.on('message', (data, isBinary) => ws.send(isBinary ? data : `${name}: ${data.toString()}`, { binary: isBinary }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const context: IRouterContext = {
        clusterUid: uid, clusterName: name, kwirthVersion: '0.6.117', loopbackUrl: url,
        logger: { info: (m) => logs.push(`I ${m}`), trace: () => {}, warning: (m) => logs.push(`W ${m}`), error: (m) => logs.push(`E ${m}`) }
    }
    bridge = new BridgeRouter(context)
    return {
        url, bridge, seen, logs,
        close: async () => {
            await bridge.stopRouter()
            for (const client of wss.clients) client.terminate()
            await new Promise<void>(resolve => { wss.close(() => resolve()) })
            server.closeAllConnections()
            await new Promise<void>(resolve => server.close(() => resolve()))
        }
    }
}

const until = async (check: () => boolean, ms = 5000): Promise<void> => {
    const end = Date.now() + ms
    while (!check()) {
        if (Date.now() > end) throw new Error('timed out waiting')
        await new Promise(r => setTimeout(r, 20))
    }
}

const linked = (core: IFakeCore) => (core.bridge.getStatus().detail ?? '').startsWith('linked')

// A linked pair: A dials B
const pair = async (aUid = 'aaa', bUid = 'bbb') => {
    const a = await fakeCore(aUid, 'kwirth-a')
    const b = await fakeCore(bUid, 'kwirth-b')
    await b.bridge.startRouter({})
    await a.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
    await until(() => linked(a) && linked(b))
    return { a, b, close: async () => { await a.close(); await b.close() } }
}

test('🔴 A dials B: both are linked, each knows the other', async () => {
    const { a, b, close } = await pair()
    assert.match(a.bridge.getStatus().detail!, /linked to 'kwirth-b' \(bbb\), outgoing/)
    assert.match(b.bridge.getStatus().detail!, /linked to 'kwirth-a' \(aaa\), incoming/)
    assert.ok(a.logs.some(l => l.includes("linked to 'kwirth-b' (bbb, Kwirth 0.6.117, bridge test)")))
    await close()
})

test('🔴 HTTP both ways over the one link: delivered to the OTHER core over loopback, its credential untouched', async () => {
    const { a, b, close } = await pair()
    // a session on A uses B's cluster (its entry carries B's key, which only B validates)
    let r = await fetch(`${a.url}/router/bridge/bbb/config/info?x=1`, { headers: { Authorization: 'Bearer key-of-B' } })
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { from: 'kwirth-b', method: 'GET', path: '/config/info?x=1' })
    assert.equal(b.seen.at(-1)?.authorization, 'Bearer key-of-B')
    // and a session on B uses A's cluster through the SAME link (A is behind NAT: B never dialled it)
    r = await fetch(`${b.url}/router/bridge/aaa/core/x`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"hi":1}' })
    assert.deepEqual(await r.json(), { from: 'kwirth-a', method: 'POST', path: '/core/x' })
    assert.equal(a.seen.at(-1)?.body, '{"hi":1}')
    await close()
})

test('a cluster that is not the sibling is 502; without a link, 503', async () => {
    const { a, close } = await pair()
    assert.equal((await fetch(`${a.url}/router/bridge/zzz/config/info`)).status, 502)
    await close()
    const lonely = await fakeCore('ccc', 'lonely')
    await lonely.bridge.startRouter({})
    assert.equal((await fetch(`${lonely.url}/router/bridge/bbb/x`)).status, 503)
    await lonely.close()
})

test('🔴 a WebSocket through the bridge: opened on the other core, messages both ways, closed together', async () => {
    const { a, close } = await pair()
    const ws = new WebSocket(`${a.url.replace('http', 'ws')}/router/bridge/bbb/channel?k=1`)
    const got: string[] = []
    ws.on('message', (d) => got.push(d.toString()))
    await new Promise<void>(resolve => ws.on('open', () => resolve()))
    ws.send('ping')
    await until(() => got.length === 2)
    assert.deepEqual(got, ['kwirth-b/channel?k=1', 'kwirth-b: ping'])
    // binary goes as binary
    const binary = new Promise<Buffer>(resolve => ws.once('message', (d, isBinary) => { assert.equal(isBinary, true); resolve(d as Buffer) }))
    ws.send(Buffer.from([1, 2, 3]))
    assert.deepEqual([...await binary], [1, 2, 3])
    ws.close()
    await close()
})

test('🔴 a link with a key WITHOUT bridge$peer is refused', async () => {
    const a = await fakeCore('aaa', 'kwirth-a')
    const b = await fakeCore('bbb', 'kwirth-b')
    await b.bridge.startRouter({})
    await a.bridge.startRouter({ peerUrl: b.url, peerAccessKey: 'k|permanent|admin::::', reconnectSeconds: 60 })
    await until(() => b.logs.some(l => l.includes('does not carry bridge$peer')))
    assert.equal(linked(a), false)
    await until(() => a.bridge.getStatus().lastError !== undefined)
    await a.close(); await b.close()
})

test('🔴 one sibling only: a third Kwirth is refused while the link lives', async () => {
    const { b, close } = await pair()
    const c = await fakeCore('ccc', 'kwirth-c')
    await c.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 60 })
    await until(() => b.logs.some(l => l.includes("a link from 'kwirth-c' (ccc) was refused")))
    assert.match(b.bridge.getStatus().detail!, /linked to 'kwirth-a'/)
    await c.close(); await close()
})

test('🔴 both configured to each other: ONE link stays, the one opened by the lower uid', async () => {
    const a = await fakeCore('aaa', 'kwirth-a')
    const b = await fakeCore('bbb', 'kwirth-b')
    await b.bridge.startRouter({ peerUrl: a.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
    await a.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
    await until(() => linked(a) && linked(b))
    await new Promise(r => setTimeout(r, 1500))     // past a reconnect period: nothing flaps
    assert.match(a.bridge.getStatus().detail!, /outgoing/, 'aaa < bbb: the link A opened stays')
    assert.match(b.bridge.getStatus().detail!, /incoming/)
    await a.close(); await b.close()
})

/*
    🔴 A comes back while B still holds A's OLD link, which died without a close (A restarted; B saw nothing). Both
    links were opened by A, so the lower-uid rule cannot choose. B asks the old one: it does not answer, so the new
    one replaces it. The "old A" here is a bare socket that said hello and answers no ping (autoPong off): dead.
*/
test('🔴 the same sibling coming back replaces its old link when that one does not answer', async () => {
    const b = await fakeCore('bbb', 'kwirth-b')
    const newA = await fakeCore('aaa', 'kwirth-a')
    let dead: WebSocket | undefined
    // closed whatever happens: a failure left the cores listening and the run never ended
    try {
        await b.bridge.startRouter({})
        dead = new WebSocket(linkUrlOf(b.url), { headers: { Authorization: `Bearer ${PEER_KEY}` }, autoPong: false })
        await new Promise<void>(resolve => dead!.on('open', () => resolve()))
        dead.send(JSON.stringify({ t: EFrameType.HELLO, v: 1, uid: 'aaa', name: 'kwirth-a' }))
        await until(() => linked(b))
        // the "new" A: same cluster uid, a new socket — while B still holds the dead one
        await newA.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 60 })
        // A takes the link as soon as B says hello; B decides after the ping to the old one goes unanswered
        await until(() => b.logs.some(l => l.includes('its old link did not answer, it is replaced')), PROBE_MS + 3000)
        assert.ok(linked(newA))
        assert.match(b.bridge.getStatus().detail!, /linked to 'kwirth-a'/)
        // and what travels now goes over the new link
        const answer = await fetch(`${newA.url}/router/bridge/bbb/config/info`)
        assert.equal(answer.status, 200)
        assert.deepEqual(await answer.json(), { from: 'kwirth-b', method: 'GET', path: '/config/info' })
    }
    finally {
        dead?.terminate(); await newA.close(); await b.close()
    }
})

/*
    🔴 Two LIVE instances of the same Kwirth (same config and cluster uid: replicas, or a dev back sharing its store
    with the pod of its cluster) both dial B. With 0.1.1 each one took the link from the other every few seconds.
    Now the current one answers the ping and stays; the other is refused, says why, and keeps trying without
    taking anything — the link is stable, whichever came first.
*/
test('🔴 two live instances of the same Kwirth: the first keeps the link, the second is refused and does not take it', async () => {
    const b = await fakeCore('bbb', 'kwirth-b')
    const first = await fakeCore('aaa', 'kwirth-a')
    const second = await fakeCore('aaa', 'kwirth-a')
    try {
        await b.bridge.startRouter({})
        await first.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
        await until(() => linked(first) && linked(b))
        await second.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
        await until(() => b.logs.some(l => l.includes('another instance of that Kwirth already holds the link')), 5000)
        // a few of the second one's retries later, the first still holds it: nobody took it from anybody
        await new Promise(r => setTimeout(r, 3500))
        assert.ok(linked(first), 'the first instance keeps the link')
        assert.ok(!first.logs.some(l => l.includes('down')), 'its link never went down')
        assert.ok(!b.logs.some(l => l.includes('it is replaced')), 'B never replaced it')
        assert.ok(second.logs.some(l => l.includes('the sibling left the link: another instance of the same Kwirth already holds the link')))
        const answer = await fetch(`${first.url}/router/bridge/bbb/config/info`)
        assert.equal(answer.status, 200)
    }
    finally {
        await first.close(); await second.close(); await b.close()
    }
})

// A bare socket linked to 'core' as sibling 'aaa' that answers no ping (autoPong off): a link dead without a close
const deadSiblingOf = async (core: IFakeCore): Promise<WebSocket> => {
    const dead = new WebSocket(linkUrlOf(core.url), { headers: { Authorization: `Bearer ${PEER_KEY}` }, autoPong: false })
    await new Promise<void>(resolve => dead.on('open', () => resolve()))
    dead.send(JSON.stringify({ t: EFrameType.HELLO, v: 1, uid: 'aaa', name: 'kwirth-a' }))
    await until(() => linked(core))
    return dead
}

/*
    🔴 The RECEIVING side watches its link too. Only the dialler used to ping, so an incoming link that died without
    a close (the sibling's machine or network went away) stayed 'linked' on B, and its cluster answered nothing,
    until the sibling came back. The "A" here is a bare socket that said hello and answers no ping (autoPong off).
    The heartbeat's setInterval is mocked so two beats take no time; the sockets stay real. B runs with a heartbeat
    of 5 s from its config: the period that counts is the configured one.
*/
test('🔴 the receiving side gives up an incoming link that stops answering pings', async () => {
    mock.timers.enable({ apis: ['setInterval'] })
    const b = await fakeCore('bbb', 'kwirth-b')
    let dead: WebSocket | undefined
    try {
        await b.bridge.startRouter({ heartbeatSeconds: 5 })
        dead = await deadSiblingOf(b)
        // a beat of the DEFAULT period would be two of the configured one: one tick of 5 s only sends the ping
        mock.timers.tick(5_000)
        assert.ok(linked(b), 'one beat sends the ping; the link is not given up yet')
        // second beat: no pong came, the link is given up
        mock.timers.tick(5_000)
        await until(() => !linked(b))
        assert.ok(b.logs.some(l => l.includes('no answer from the sibling in 5 s: the incoming link is given up')))
    }
    finally {
        mock.timers.reset()
        dead?.terminate(); await b.close()
    }
})

// The heartbeat changes with the config, at once and without dropping the link there is (e.g. an ALB cuts at 60 s)
test('a new heartbeat applies at once to the live link, without dropping it', async () => {
    mock.timers.enable({ apis: ['setInterval'] })
    const b = await fakeCore('bbb', 'kwirth-b')
    let dead: WebSocket | undefined
    try {
        await b.bridge.startRouter({})
        dead = await deadSiblingOf(b)
        await b.bridge.applyConfig({ heartbeatSeconds: 10 })
        assert.ok(b.logs.some(l => l.includes('config applied: heartbeat every 10 s')))
        assert.ok(linked(b), 'changing the heartbeat does not drop the link')
        mock.timers.tick(10_000)
        mock.timers.tick(10_000)
        await until(() => !linked(b))
        assert.ok(b.logs.some(l => l.includes('no answer from the sibling in 10 s')))
    }
    finally {
        mock.timers.reset()
        dead?.terminate(); await b.close()
    }
})

// And an incoming link that DOES answer stays, beat after beat: the receiving side gives up only dead ones
test('an incoming link that answers its pings stays linked across beats', async () => {
    mock.timers.enable({ apis: ['setInterval'] })
    const { a, b, close } = await pair()
    try {
        for (let beat = 0; beat < 4; beat++) {
            mock.timers.tick(DEFAULT_HEARTBEAT_SECONDS * 1000)
            // the pong travels over a real socket: give it time to come back before the next beat
            await new Promise(r => setTimeout(r, 150))
        }
        assert.ok(linked(a) && linked(b))
        assert.ok(!b.logs.some(l => l.includes('is given up')))
        assert.ok(!a.logs.some(l => l.includes('is given up')))
    }
    finally {
        mock.timers.reset()
        await close()
    }
})

test('🔴 the link drops: A says so and links again on its own', async () => {
    const a = await fakeCore('aaa', 'kwirth-a')
    let b = await fakeCore('bbb', 'kwirth-b')
    await b.bridge.startRouter({})
    await a.bridge.startRouter({ peerUrl: b.url, peerAccessKey: PEER_KEY, reconnectSeconds: 1 })
    await until(() => linked(a))
    // B goes away and comes back on the same address
    const port = new URL(b.url).port
    await b.close()
    await until(() => !linked(a))
    assert.ok(a.logs.some(l => l.startsWith('W link to') && l.includes('down')))
    const app = http.createServer()
    const wss = new WebSocketServer({ server: app })
    const reborn = new BridgeRouter({ clusterUid: 'bbb', clusterName: 'kwirth-b', kwirthVersion: '0.6.117', loopbackUrl: b.url, logger: { info: () => {}, trace: () => {}, warning: () => {}, error: () => {} } })
    await reborn.startRouter({})
    wss.on('connection', (ws, req) => {
        req.url = (req.url ?? '').slice('/router/bridge'.length)
        reborn.routerWebsocket(ws as unknown as globalThis.WebSocket, req, { via: ERouteCallerVia.ACCESS_KEY, accessKey: { id: 'k', type: 'permanent', resources: 'bridge$peer::::' } as never })
    })
    await new Promise<void>(resolve => app.listen(Number(port), '127.0.0.1', resolve))
    await until(() => linked(a), 8000)
    await reborn.stopRouter()
    for (const client of wss.clients) client.terminate()
    app.closeAllConnections(); app.close()
    await a.close()
})

test('the protocol trusts nothing: junk, unknown types and paths climbing out are not frames', () => {
    for (const raw of ['', 'x', '[]', '{"t":"nope"}', '{"t":"req","id":1,"method":"GET","path":"/../x","headers":{}}', '{"t":"req","id":1,"method":"GET","path":"x","headers":{}}', '{"t":"hello","v":1,"uid":"","name":"a"}', '{"t":"res","id":1,"status":99,"headers":{}}'])
        assert.equal(parseFrame(raw), undefined, raw)
    assert.deepEqual(parseFrame('{"t":"req","id":2,"method":"post","path":"/a","headers":{"X-A":"1","n":2}}'), { t: EFrameType.REQUEST, id: 2, method: 'POST', path: '/a', headers: { 'x-a': '1' } })
})

test('helpers: config defaults, the link url, scopes and cluster paths', () => {
    assert.deepEqual(bridgeConfigOf({}), { peerUrl: '', peerAccessKey: '', reconnectSeconds: 10, heartbeatSeconds: 30 })
    assert.equal(bridgeConfigOf({ reconnectSeconds: 0 }).reconnectSeconds, 10)
    assert.equal(bridgeConfigOf({ reconnectSeconds: '5' }).reconnectSeconds, 5)
    // the heartbeat: 5..300 whole seconds, anything else is the default
    for (const [given, expected] of [[5, 5], [300, 300], ['45', 45], [4, 30], [301, 30], [12.5, 30], ['x', 30], [undefined, 30]] as const)
        assert.equal(bridgeConfigOf({ heartbeatSeconds: given }).heartbeatSeconds, expected, String(given))
    assert.equal(linkUrlOf('https://b.example/kwirth/'), 'wss://b.example/kwirth/router/bridge/link')
    assert.equal(linkUrlOf('http://b:3883'), 'ws://b:3883/router/bridge/link')
    assert.equal(keyHasScope('admin,bridge$peer:::: ;x::::', 'bridge$peer'), true)
    assert.equal(keyHasScope('admin::::', 'bridge$peer'), false)
    assert.deepEqual(splitClusterPath('/u1/config/info?x=1'), ['u1', '/config/info?x=1'])
    assert.deepEqual(splitClusterPath('/u1'), ['u1', '/'])
    assert.deepEqual(splitClusterPath('/u1?x'), ['u1', '/?x'])
})
