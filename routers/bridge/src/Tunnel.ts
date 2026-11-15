import WebSocket from 'ws'
import { EFrameType, IResponseFrame, THeaders, TFrame, carriedHeaders } from './Protocol'
import { ELinkDirection, Link } from './Link'

/*
    What travels over a link (docs/plan/PLAN.md, B3/B4), in both directions:

      · ORIGIN side: a request or a WebSocket that arrived here for the sibling's cluster is sent across as
        frames, and its answer comes back the same way;
      · TARGET side: what the sibling sends is delivered to THIS core over loopback, as if a browser had made
        it — so this core authenticates and authorizes it with the credential it carries, as always.

    Ids are unique on the link without asking: the side that dialled uses even ids, the other odd ones. A
    frame about a WebSocket can come from either end, and the parity says who opened it.
*/

export const REQUEST_TIMEOUT_MS = 60_000

// The headers a CORS layer sets: the origin core already answers them; the target's must not be added on top
const isCorsHeader = (name: string): boolean => name.startsWith('access-control-')

// What a WebSocket over the tunnel needs of a local socket: the one the core hands over, or one we opened
interface IStreamSocket {
    readonly readyState: number
    send(data: string | Buffer): void
    close(code?: number, reason?: string): void
}

interface IStream {
    socket: IStreamSocket
    accepted: boolean
    queue: TFrame[]                     // what the local end sent before the other end accepted it
}

interface IPending {
    resolve: (frame: IResponseFrame) => void
    timer: ReturnType<typeof setTimeout>
}

const OPEN = 1

// A close code a socket accepts: 1000, or 3000–4999 (1005/1006 and the like cannot be sent)
const sendableCode = (code: number | undefined): number => code !== undefined && (code === 1000 || (code >= 3000 && code <= 4999)) ? code : 1000

export class Tunnel {
    private nextId: number
    private pending = new Map<number, IPending>()
    private streams = new Map<number, IStream>()

    constructor(private link: Link, private loopbackUrl: string, private log: (message: string) => void, private timeoutMs = REQUEST_TIMEOUT_MS) {
        this.nextId = link.direction === ELinkDirection.OUTGOING ? 2 : 1
    }

    private id(): number {
        const id = this.nextId
        this.nextId += 2
        return id
    }

    // ── origin side ─────────────────────────────────────────────────────────────

    // Sends a request to the sibling; always resolves (a 503 when the link drops, a 504 on timeout)
    request(method: string, path: string, headers: THeaders, body?: Buffer): Promise<IResponseFrame> {
        const id = this.id()
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                resolve({ t: EFrameType.RESPONSE, id, status: 504, headers: { 'content-type': 'text/plain' }, body: Buffer.from('the sibling Kwirth did not answer in time').toString('base64') })
            }, this.timeoutMs)
            this.pending.set(id, { resolve, timer })
            const sent = this.link.send({ t: EFrameType.REQUEST, id, method, path, headers, ...(body && body.length ? { body: body.toString('base64') } : {}) })
            if (!sent) this.settle(id, 503, 'the link to the sibling Kwirth is down')
        })
    }

    // A local WebSocket (from the core) that goes to the sibling: opened there, then relayed both ways
    openWebsocket(local: IStreamSocket & { addEventListener: (type: string, listener: (event: { data?: unknown, code?: number, reason?: string }) => void) => void }, path: string, headers: THeaders): void {
        const id = this.id()
        const stream: IStream = { socket: local, accepted: false, queue: [] }
        this.streams.set(id, stream)
        local.addEventListener('message', (event) => {
            const frame = toMessageFrame(id, event.data)
            if (!frame) return
            if (stream.accepted) this.link.send(frame)
            else stream.queue.push(frame)
        })
        local.addEventListener('close', (event) => {
            if (!this.streams.delete(id)) return
            this.link.send({ t: EFrameType.WS_CLOSE, id, code: event.code, ...(event.reason ? { reason: event.reason } : {}) })
        })
        if (!this.link.send({ t: EFrameType.WS_OPEN, id, path, headers })) {
            this.streams.delete(id)
            local.close(1011, 'the link to the sibling Kwirth is down')
        }
    }

    // ── what arrives ────────────────────────────────────────────────────────────

    handle(frame: TFrame): void {
        switch (frame.t) {
            case EFrameType.REQUEST:
                void this.serveRequest(frame.id, frame.method, frame.path, frame.headers, frame.body)
                return
            case EFrameType.RESPONSE: {
                const waiting = this.pending.get(frame.id)
                if (!waiting) return
                this.pending.delete(frame.id)
                clearTimeout(waiting.timer)
                waiting.resolve(frame)
                return
            }
            case EFrameType.WS_OPEN:
                this.serveWebsocket(frame.id, frame.path, frame.headers)
                return
            case EFrameType.WS_ACCEPTED: {
                const stream = this.streams.get(frame.id)
                if (!stream) return
                stream.accepted = true
                for (const queued of stream.queue) this.link.send(queued)
                stream.queue = []
                return
            }
            case EFrameType.WS_MESSAGE: {
                const stream = this.streams.get(frame.id)
                if (!stream || stream.socket.readyState !== OPEN) return
                stream.socket.send(frame.binary ? Buffer.from(frame.data, 'base64') : frame.data)
                return
            }
            case EFrameType.WS_CLOSE: {
                const stream = this.streams.get(frame.id)
                if (!stream) return
                this.streams.delete(frame.id)
                try { stream.socket.close(sendableCode(frame.code), frame.reason ?? '') } catch { /* already gone */ }
                return
            }
            default:
                return
        }
    }

    // The link is gone: every request waiting gets a 503 and every WebSocket it carried is closed
    closeAll(reason: string): void {
        for (const id of [...this.pending.keys()]) this.settle(id, 503, reason)
        for (const [id, stream] of this.streams) {
            this.streams.delete(id)
            try { stream.socket.close(1011, reason.slice(0, 123)) } catch { /* already gone */ }
        }
    }

    get openStreams(): number {
        return this.streams.size
    }

    private settle(id: number, status: number, message: string): void {
        const waiting = this.pending.get(id)
        if (!waiting) return
        this.pending.delete(id)
        clearTimeout(waiting.timer)
        waiting.resolve({ t: EFrameType.RESPONSE, id, status, headers: { 'content-type': 'text/plain' }, body: Buffer.from(message).toString('base64') })
    }

    // ── target side: delivered to THIS core over loopback ───────────────────────

    private async serveRequest(id: number, method: string, path: string, headers: THeaders, body?: string): Promise<void> {
        try {
            const response = await fetch(`${this.loopbackUrl}${path}`, {
                method,
                headers,
                redirect: 'manual',
                ...(body && method !== 'GET' && method !== 'HEAD' ? { body: Buffer.from(body, 'base64') } : {})
            })
            const received: Record<string, string> = {}
            response.headers.forEach((value, name) => { received[name] = value })
            const out: THeaders = {}
            for (const [name, value] of Object.entries(carriedHeaders(received))) {
                if (!isCorsHeader(name)) out[name] = value
            }
            const bytes = Buffer.from(await response.arrayBuffer())
            this.link.send({ t: EFrameType.RESPONSE, id, status: response.status, headers: out, ...(bytes.length ? { body: bytes.toString('base64') } : {}) })
        }
        catch (err) {
            this.log(`request ${method} ${path.split('?')[0]} could not be delivered to this Kwirth: ${err instanceof Error ? err.message : String(err)}`)
            this.link.send({ t: EFrameType.RESPONSE, id, status: 502, headers: { 'content-type': 'text/plain' }, body: Buffer.from('the sibling Kwirth could not deliver the request to its core').toString('base64') })
        }
    }

    private serveWebsocket(id: number, path: string, headers: THeaders): void {
        const url = `${this.loopbackUrl.replace(/^http/i, 'ws')}${path}`
        const protocols = headers['sec-websocket-protocol']?.split(',').map(p => p.trim()).filter(Boolean)
        const forwarded = { ...headers }
        delete forwarded['sec-websocket-protocol']
        let socket: WebSocket
        try {
            socket = new WebSocket(url, protocols, { headers: forwarded })
        }
        catch (err) {
            this.link.send({ t: EFrameType.WS_CLOSE, id, code: 1011, reason: 'could not open it on the sibling' })
            return
        }
        const stream: IStream = { socket, accepted: true, queue: [] }
        this.streams.set(id, stream)
        socket.on('open', () => this.link.send({ t: EFrameType.WS_ACCEPTED, id }))
        socket.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
            const buffer = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer)
            this.link.send({ t: EFrameType.WS_MESSAGE, id, data: isBinary ? buffer.toString('base64') : buffer.toString('utf8'), binary: isBinary })
        })
        socket.on('close', (code: number, reason: Buffer) => {
            if (!this.streams.delete(id)) return
            this.link.send({ t: EFrameType.WS_CLOSE, id, code, reason: reason.toString('utf8').slice(0, 123) })
        })
        socket.on('error', (err: Error) => {
            this.log(`WebSocket ${path.split('?')[0]} on this Kwirth failed: ${err.message}`)
        })
    }
}

// A local WebSocket message as a frame: text stays text, anything else travels in base64
const toMessageFrame = (id: number, data: unknown): TFrame | undefined => {
    if (typeof data === 'string') return { t: EFrameType.WS_MESSAGE, id, data, binary: false }
    if (Buffer.isBuffer(data)) return { t: EFrameType.WS_MESSAGE, id, data: data.toString('base64'), binary: true }
    if (data instanceof ArrayBuffer) return { t: EFrameType.WS_MESSAGE, id, data: Buffer.from(data).toString('base64'), binary: true }
    if (Array.isArray(data)) return { t: EFrameType.WS_MESSAGE, id, data: Buffer.concat(data as Buffer[]).toString('base64'), binary: true }
    return undefined
}
