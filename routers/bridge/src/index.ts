import WebSocket from 'ws'
import { IConfigFieldDef, IExtensionScope, IRouterData } from '@kwirthmagnify/kwirth-common'
import { ERouteCallerVia, IRouteCaller, IRouter, IRouterContext, IRouterStatus, TRouterConfig } from '@kwirthmagnify/kwirth-common-back'
import { Request, Response } from 'express'
import { IncomingMessage } from 'http'
import { EFrameType, IHelloFrame, TFrame, carriedHeaders } from './Protocol'
import { ELinkDirection, ILinkSocket, Link } from './Link'
import { Tunnel } from './Tunnel'

/*
    BRIDGE — two Kwirths that reach each other (docs/plan/PRD.md, PLAN.md).

    One of them (or both) dials the other's /router/bridge/link with an access key OF THE OTHER carrying
    'bridge$peer'; the core there validates it before handing the socket over. Over that single link the
    traffic goes both ways: what arrives for the sibling's cluster is sent across, and what the sibling sends
    is delivered to THIS core over loopback — which authenticates and authorizes it as always. The bridge
    never decides what a user may do.

    Exactly ONE sibling. If both dial, the link opened by the lower cluster uid stays.
*/

declare const __BRIDGE_VERSION__: string

const ROUTER_ID = 'bridge'
const SCOPE_PEER = `${ROUTER_ID}$peer`
const LINK_PATH = '/link'
const HEARTBEAT_MS = 30_000
export const PROBE_MS = 5_000           // how long a link has to answer a ping before a new one from its side replaces it
const DEFAULT_RECONNECT_SECONDS = 10

const SCHEMA: IConfigFieldDef[] = [
    { name: 'peerUrl', label: 'Sibling URL (empty: only accept links)', type: 'text' },
    { name: 'peerAccessKey', label: 'Access key created in the sibling (bridge$peer)', type: 'password' },
    { name: 'reconnectSeconds', label: 'Reconnect every (seconds)', type: 'number', default: DEFAULT_RECONNECT_SECONDS }
]

interface IBridgeConfig {
    peerUrl: string
    peerAccessKey: string
    reconnectSeconds: number
}

// What is read from the saved config, made whole: whatever is missing or wrong takes its default
export const bridgeConfigOf = (config: TRouterConfig): IBridgeConfig => {
    const seconds = Number(config.reconnectSeconds)
    return {
        peerUrl: typeof config.peerUrl === 'string' ? config.peerUrl.trim() : '',
        peerAccessKey: typeof config.peerAccessKey === 'string' ? config.peerAccessKey.trim() : '',
        reconnectSeconds: Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds : DEFAULT_RECONNECT_SECONDS
    }
}

// The sibling's link endpoint: 'https://b.example/kwirth' → 'wss://b.example/kwirth/router/bridge/link'
export const linkUrlOf = (peerUrl: string): string =>
    `${peerUrl.replace(/\/+$/, '').replace(/^http/i, 'ws')}/router/${ROUTER_ID}${LINK_PATH}`

// Whether a key carries a scope, in any of its resources ('scopes:ns:groups:pods:containers;...')
export const keyHasScope = (resources: string | undefined, scope: string): boolean =>
    (resources ?? '').split(';').some(r => (r.split(':')[0] ?? '').split(',').map(s => s.trim()).includes(scope))

// '/<uid>/rest?q' → ['<uid>', '/rest?q']
export const splitClusterPath = (path: string): [string, string] => {
    const tail = path.startsWith('/') ? path.slice(1) : path
    const cut = tail.search(/[/?#]/)
    let uid = cut < 0 ? tail : tail.slice(0, cut)
    try { uid = decodeURIComponent(uid) } catch { /* left as it came: it will not match the sibling */ }
    const rest = cut < 0 ? '/' : tail.slice(cut)
    return [uid, rest.startsWith('/') ? rest : `/${rest}`]
}

const readBody = (req: Request): Promise<Buffer> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
})

export default class BridgeRouter implements IRouter {
    private config: IBridgeConfig = bridgeConfigOf({})
    private link?: Link                         // THE link, once both said hello
    private tunnel?: Tunnel
    private dialing?: { socket: WebSocket, link: Link }
    private dialTimer?: ReturnType<typeof setTimeout>
    private heartbeat?: ReturnType<typeof setInterval>
    private awaitingPong = false
    private lastError?: string
    private stopped = false

    constructor(private context: IRouterContext) {}

    getRouterData = (): IRouterData => ({ id: ROUTER_ID, pathTemplate: '/{routeTicket}/{clusterUid}', needsTicket: true })

    getConfigSchema = (): IConfigFieldDef[] => SCHEMA

    getScopeCatalog = (): IExtensionScope[] => [
        { scope: SCOPE_PEER, label: 'Bridge · Peer link', description: 'A sibling Kwirth links to this one with a key carrying it (its traffic then goes both ways)' }
    ]

    startRouter = async (config: TRouterConfig): Promise<void> => {
        this.config = bridgeConfigOf(config)
        this.stopped = false
        this.heartbeat = setInterval(() => this.beat(), HEARTBEAT_MS)
        if (typeof this.heartbeat.unref === 'function') this.heartbeat.unref()
        this.context.logger.info(this.config.peerUrl ? `started: linking to ${this.config.peerUrl}` : 'started: waiting for the sibling to link')
        this.dial()
    }

    applyConfig = async (config: TRouterConfig): Promise<void> => {
        const next = bridgeConfigOf(config)
        const peerChanged = next.peerUrl !== this.config.peerUrl || next.peerAccessKey !== this.config.peerAccessKey
        this.config = next
        if (!peerChanged) return
        this.context.logger.info(next.peerUrl ? `config applied: linking to ${next.peerUrl}` : 'config applied: only accepting links')
        // what we dialled with the old settings goes; a link the sibling opened stays
        this.cancelDial()
        if (this.link?.direction === ELinkDirection.OUTGOING) this.link.bye('the sibling settings changed')
        this.lastError = undefined
        this.dial()
    }

    stopRouter = async (): Promise<void> => {
        this.stopped = true
        if (this.heartbeat) clearInterval(this.heartbeat)
        this.cancelDial()
        this.link?.bye('the bridge is stopping', 1001)
        this.context.logger.info('stopped')
    }

    getStatus = (): IRouterStatus => {
        const peer = this.link?.peer
        if (peer) return { started: true, detail: `linked to '${peer.name}' (${peer.uid}), ${this.link!.direction}` }
        if (this.config.peerUrl) return { started: true, detail: `linking to ${this.config.peerUrl}`, ...(this.lastError ? { lastError: this.lastError } : {}) }
        return { started: true, detail: 'waiting for the sibling to link' }
    }

    // ── traffic for the sibling's cluster (only callers the core vouched for as a session) ─────────────

    routerRequest = (req: Request, res: Response, caller: IRouteCaller): void => {
        void this.relayRequest(req, res, caller)
    }

    private async relayRequest(req: Request, res: Response, caller: IRouteCaller): Promise<void> {
        if (caller.via === ERouteCallerVia.ACCESS_KEY) {
            res.status(403).json({ error: 'the bridge carries traffic for a session (a route ticket), not for an access key' })
            return
        }
        const [uid, rest] = splitClusterPath(req.url)
        const target = this.targetFor(uid)
        if (typeof target === 'string') {
            res.status(this.link ? 502 : 503).json({ error: target })
            return
        }
        const body = await readBody(req)
        const answer = await target.request(req.method, rest, carriedHeaders(req.headers), body)
        for (const [name, value] of Object.entries(answer.headers)) res.setHeader(name, value)
        res.status(answer.status).end(answer.body ? Buffer.from(answer.body, 'base64') : undefined)
    }

    routerWebsocket = (webSocket: globalThis.WebSocket, req: IncomingMessage, caller: IRouteCaller): void => {
        const path = req.url ?? '/'
        if (path === LINK_PATH || path.startsWith(`${LINK_PATH}?`) || path.startsWith(`${LINK_PATH}/`)) {
            this.acceptLink(webSocket as unknown as ILinkSocket, caller)
            return
        }
        if (caller.via === ERouteCallerVia.ACCESS_KEY) {
            webSocket.close(4403, 'the bridge carries traffic for a session (a route ticket), not for an access key')
            return
        }
        const [uid, rest] = splitClusterPath(path)
        const target = this.targetFor(uid)
        if (typeof target === 'string') {
            webSocket.close(this.link ? 4502 : 4503, target.slice(0, 123))
            return
        }
        target.openWebsocket(webSocket as unknown as Parameters<Tunnel['openWebsocket']>[0], rest, carriedHeaders(req.headers))
    }

    // The tunnel to use for a cluster uid, or why there is none
    private targetFor(uid: string): Tunnel | string {
        if (!this.link?.alive || !this.tunnel || !this.link.peer) return 'the bridge is not linked to its sibling right now'
        if (uid !== this.link.peer.uid) return `cluster '${uid}' is not the sibling this bridge is linked to ('${this.link.peer.name}', ${this.link.peer.uid})`
        return this.tunnel
    }

    // ── the link ────────────────────────────────────────────────────────────────

    private own(): IHelloFrame {
        return { t: EFrameType.HELLO, v: 1, uid: this.context.clusterUid, name: this.context.clusterName, kwirthVersion: this.context.kwirthVersion, bridgeVersion: typeof __BRIDGE_VERSION__ === 'string' ? __BRIDGE_VERSION__ : 'dev' }
    }

    private handlers = {
        onHello: (link: Link, hello: IHelloFrame) => this.onHello(link, hello),
        onFrame: (link: Link, frame: TFrame) => this.onFrame(link, frame),
        onClose: (link: Link, code: number, reason: string) => this.onClose(link, code, reason)
    }

    private acceptLink(socket: ILinkSocket, caller: IRouteCaller): void {
        if (caller.via !== ERouteCallerVia.ACCESS_KEY || !keyHasScope(caller.accessKey?.resources, SCOPE_PEER)) {
            this.context.logger.warning(`a link was refused: its key does not carry ${SCOPE_PEER}`)
            socket.close(4403, `the key must carry ${SCOPE_PEER}`)
            return
        }
        const link = new Link(socket, ELinkDirection.INCOMING, this.own(), this.handlers)
        link.hello()
    }

    private dial(): void {
        if (this.stopped || this.dialing || this.link?.alive) return
        if (!this.config.peerUrl || !this.config.peerAccessKey) return
        const url = linkUrlOf(this.config.peerUrl)
        let socket: WebSocket
        try {
            socket = new WebSocket(url, { headers: { Authorization: `Bearer ${this.config.peerAccessKey}` } })
        }
        catch (err) {
            this.lastError = `cannot dial ${url}: ${err instanceof Error ? err.message : String(err)}`
            this.scheduleDial()
            return
        }
        const link = new Link(socket as unknown as ILinkSocket, ELinkDirection.OUTGOING, this.own(), this.handlers)
        this.dialing = { socket, link }
        socket.on('open', () => link.hello())
        socket.on('pong', () => { this.awaitingPong = false })
        socket.on('unexpected-response', (_req, response) => {
            this.lastError = `the sibling answered HTTP ${response.statusCode} on ${url} (is bridge installed there, and is the key valid?)`
            try { socket.terminate() } catch { /* already gone */ }
        })
        socket.on('error', (err: Error) => {
            if (!this.lastError) this.lastError = `${url}: ${err.message}`
        })
    }

    private scheduleDial(): void {
        if (this.stopped || this.dialTimer || !this.config.peerUrl) return
        this.dialTimer = setTimeout(() => {
            this.dialTimer = undefined
            this.lastError = undefined
            this.dial()
        }, this.config.reconnectSeconds * 1000)
        if (typeof this.dialTimer.unref === 'function') this.dialTimer.unref()
    }

    private cancelDial(): void {
        if (this.dialTimer) clearTimeout(this.dialTimer)
        this.dialTimer = undefined
        const dialing = this.dialing
        this.dialing = undefined
        dialing?.link.close(1000, 'cancelled')
    }

    // Who opened a link: we did (outgoing) or the sibling did (incoming)
    private openerOf(link: Link): string {
        return link.direction === ELinkDirection.OUTGOING ? this.context.clusterUid : link.peer!.uid
    }

    private onHello(link: Link, hello: IHelloFrame): void {
        if (hello.uid === this.context.clusterUid) {
            link.bye('both ends are the same Kwirth (same cluster uid)', 4409)
            return
        }
        const current = this.link?.alive ? this.link : undefined
        if (current && current !== link) {
            if (current.peer?.uid !== hello.uid) {
                this.context.logger.warning(`a link from '${hello.name}' (${hello.uid}) was refused: this bridge is already linked to '${current.peer?.name}'`)
                link.bye(`this bridge is already linked to another Kwirth ('${current.peer?.name}')`, 4409)
                return
            }
            /*
                Both opened by the SAME side: either that side is coming back (its old link died without a close —
                a restart, a network cut — and only this end still thinks it alive), or it is ANOTHER INSTANCE of the
                same Kwirth (same config and cluster uid: replicas, or a dev back sharing the store of the pod in its
                cluster). Only asking the current link tells them apart: if it answers, it stays and the new one is
                refused — whichever came first keeps it, and they no longer take it from each other (0.1.1 did, every
                few seconds); if it does not, it was dead and the new one replaces it.
            */
            if (this.openerOf(link) === this.openerOf(current)) {
                void this.replaceIfDead(current, link, hello)
                return
            }
            // both sides dialled: the link opened by the LOWER uid stays, the other one goes
            if (this.openerOf(link) > this.openerOf(current)) {
                link.bye('duplicate link: the one opened by the lower cluster uid stays', 4409)
                return
            }
            // the current one goes, quietly: it is not a link down, it is replaced
            this.link = undefined
            this.tunnel?.closeAll('replaced by the link opened by the lower cluster uid')
            this.tunnel = undefined
            current.bye('duplicate link: the one opened by the lower cluster uid stays', 4409)
        }
        this.adopt(link, hello)
    }

    // A new link from the side that opened the current one: it replaces the current one only if that one is dead
    private async replaceIfDead(current: Link, link: Link, hello: IHelloFrame): Promise<void> {
        const answers = await current.probe(PROBE_MS)
        if (!link.alive) return
        if (answers && this.link === current && current.alive) {
            this.context.logger.info(`a link from '${hello.name}' (${hello.uid}) was refused: another instance of that Kwirth already holds the link, and it answers`)
            link.bye('another instance of the same Kwirth already holds the link', 4409)
            return
        }
        if (this.link === current) {
            this.link = undefined
            this.tunnel?.closeAll('replaced by a new link from the same Kwirth')
            this.tunnel = undefined
            current.bye('replaced by a new link from the same Kwirth: this one did not answer', 4409)
            this.context.logger.info(`'${hello.name}' (${hello.uid}) linked again: its old link did not answer, it is replaced`)
        }
        if (this.link?.alive && this.link !== link) {
            link.bye('another instance of the same Kwirth already holds the link', 4409)
            return
        }
        this.adopt(link, hello)
    }

    private adopt(link: Link, hello: IHelloFrame): void {
        if (this.dialing?.link === link) this.dialing = undefined
        this.link = link
        this.tunnel = new Tunnel(link, this.context.loopbackUrl, (m) => this.context.logger.warning(m))
        this.lastError = undefined
        this.context.logger.info(`linked to '${hello.name}' (${hello.uid}, Kwirth ${hello.kwirthVersion ?? '?'}, bridge ${hello.bridgeVersion ?? '?'}), ${link.direction}`)
    }

    private onFrame(link: Link, frame: TFrame): void {
        if (frame.t === EFrameType.BYE) {
            this.context.logger.info(`the sibling left the link: ${frame.reason}`)
            return
        }
        if (link !== this.link) return
        this.tunnel?.handle(frame)
    }

    private onClose(link: Link, code: number, reason: string): void {
        if (this.dialing?.link === link) this.dialing = undefined
        if (link === this.link) {
            const peer = link.peer
            this.tunnel?.closeAll('the link to the sibling Kwirth went down')
            this.link = undefined
            this.tunnel = undefined
            this.context.logger.warning(`link to '${peer?.name}' (${peer?.uid}) down: ${code}${reason ? ` ${reason}` : ''}`)
        }
        else if (link.direction === ELinkDirection.OUTGOING && !link.peer && !this.lastError) {
            this.lastError = `the link closed before the sibling said hello (${code}${reason ? ` ${reason}` : ''})`
        }
        if (link.direction === ELinkDirection.OUTGOING && !this.link?.alive && !this.stopped) {
            if (this.lastError) this.context.logger.warning(`${this.lastError} — retrying in ${this.config.reconnectSeconds} s`)
            this.scheduleDial()
        }
    }

    // The link we dialled is pinged: no pong by the next beat and it is given up for dead (and dialled again)
    private beat(): void {
        const link = this.link
        if (!link?.alive || link.direction !== ELinkDirection.OUTGOING) return
        const socket = link.socket as unknown as WebSocket
        if (this.awaitingPong) {
            this.context.logger.warning('no answer from the sibling in 30 s: the link is given up')
            this.awaitingPong = false
            try { socket.terminate() } catch { /* already gone */ }
            return
        }
        this.awaitingPong = true
        try { socket.ping() } catch { /* the close that follows reports it */ }
    }
}
