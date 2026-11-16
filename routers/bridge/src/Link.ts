import { BRIDGE_PROTOCOL_VERSION, EFrameType, IHelloFrame, TFrame, parseFrame } from './Protocol'

/*
    One link to the sibling: a WebSocket (dialled by us, or accepted from the other one) that carries frames.
    Both kinds are 'ws' sockets underneath; this only needs what they share.
*/

// What the link needs of a socket: the 'ws' client and the socket the core hands over both have it
export interface ILinkSocket {
    readonly readyState: number
    send(data: string): void
    close(code?: number, reason?: string): void
    addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
    addEventListener(type: 'close', listener: (event: { code: number, reason: string }) => void): void
    addEventListener(type: 'error', listener: (event: unknown) => void): void
    addEventListener(type: 'open', listener: () => void): void
}

const OPEN = 1

export enum ELinkDirection {
    OUTGOING = 'outgoing',          // we dialled it
    INCOMING = 'incoming'           // the sibling dialled us
}

export interface ILinkHandlers {
    onHello: (link: Link, hello: IHelloFrame) => void
    onFrame: (link: Link, frame: TFrame) => void
    onClose: (link: Link, code: number, reason: string) => void
}

export class Link {
    peer?: IHelloFrame              // who is at the other end, once it said hello
    private closed = false

    constructor(readonly socket: ILinkSocket, readonly direction: ELinkDirection, private own: IHelloFrame, private handlers: ILinkHandlers) {
        socket.addEventListener('message', (event) => this.receive(event.data))
        socket.addEventListener('close', (event) => {
            if (this.closed) return
            this.closed = true
            this.handlers.onClose(this, event.code, event.reason)
        })
        socket.addEventListener('error', () => { /* a 'close' follows: that one reports it */ })
    }

    get alive(): boolean {
        return !this.closed && this.socket.readyState === OPEN
    }

    /*
        Whether the other end still answers: a WebSocket ping, which any 'ws' peer answers by itself (no protocol
        change, any bridge version). A socket that cannot ping is taken at its word: alive while it says it is open.
    */
    probe(timeoutMs: number): Promise<boolean> {
        const socket = this.socket as unknown as { ping?: () => void, once?: (event: 'pong', listener: () => void) => void }
        if (!this.alive) return Promise.resolve(false)
        if (typeof socket.ping !== 'function' || typeof socket.once !== 'function') return Promise.resolve(true)
        return new Promise(resolve => {
            let settled = false
            const settle = (answer: boolean): void => {
                if (settled) return
                settled = true
                clearTimeout(timer)
                resolve(answer)
            }
            const timer = setTimeout(() => settle(false), timeoutMs)
            socket.once!('pong', () => settle(true))
            try { socket.ping!() } catch { settle(false) }
        })
    }

    // Says who we are. Called when the socket is open (at once for an incoming one)
    hello(): void {
        this.send({ ...this.own, t: EFrameType.HELLO, v: BRIDGE_PROTOCOL_VERSION })
    }

    send(frame: TFrame): boolean {
        if (!this.alive) return false
        try {
            this.socket.send(JSON.stringify(frame))
            return true
        }
        catch {
            return false
        }
    }

    // Leaves the link saying why (the other end logs it)
    bye(reason: string, code = 1000): void {
        this.send({ t: EFrameType.BYE, reason })
        this.close(code, reason)
    }

    close(code = 1000, reason = ''): void {
        if (this.closed) return
        this.closed = true
        try { this.socket.close(code, reason.slice(0, 123)) } catch { /* already gone */ }
        this.handlers.onClose(this, code, reason)
    }

    private receive(data: unknown): void {
        const text = typeof data === 'string' ? data : Buffer.isBuffer(data) ? data.toString('utf8') : Array.isArray(data) ? Buffer.concat(data as Buffer[]).toString('utf8') : undefined
        if (text === undefined) return
        const frame = parseFrame(text)
        if (!frame) return
        if (frame.t === EFrameType.HELLO) {
            if (frame.v !== BRIDGE_PROTOCOL_VERSION) {
                this.bye(`this bridge speaks protocol ${BRIDGE_PROTOCOL_VERSION}, not ${frame.v}`, 4400)
                return
            }
            this.peer = frame
            this.handlers.onHello(this, frame)
            return
        }
        if (!this.peer) return          // nothing counts before the hello
        this.handlers.onFrame(this, frame)
    }
}
