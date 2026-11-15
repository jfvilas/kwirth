/*
    The link's protocol (docs/plan/PLAN.md): JSON messages over ONE WebSocket, carrying HTTP requests and
    WebSockets in both directions. Everything the other end sends is DATA, checked here before it is used.
*/

export const BRIDGE_PROTOCOL_VERSION = 1

export enum EFrameType {
    HELLO = 'hello',
    REQUEST = 'req',
    RESPONSE = 'res',
    WS_OPEN = 'wso',
    WS_ACCEPTED = 'wsa',
    WS_MESSAGE = 'wsm',
    WS_CLOSE = 'wsc',
    BYE = 'bye'
}

export type THeaders = Record<string, string>

export interface IHelloFrame {
    t: EFrameType.HELLO
    v: number
    uid: string
    name: string
    kwirthVersion?: string
    bridgeVersion?: string
}

export interface IRequestFrame {
    t: EFrameType.REQUEST
    id: number
    method: string
    path: string                // below the other core's root: '/config/info?x=1'
    headers: THeaders
    body?: string               // base64
}

export interface IResponseFrame {
    t: EFrameType.RESPONSE
    id: number
    status: number
    headers: THeaders
    body?: string               // base64
}

export interface IWsOpenFrame {
    t: EFrameType.WS_OPEN
    id: number
    path: string
    headers: THeaders
}

export interface IWsAcceptedFrame {
    t: EFrameType.WS_ACCEPTED
    id: number
}

export interface IWsMessageFrame {
    t: EFrameType.WS_MESSAGE
    id: number
    data: string                // text as it is, binary in base64
    binary: boolean
}

export interface IWsCloseFrame {
    t: EFrameType.WS_CLOSE
    id: number
    code?: number
    reason?: string
}

export interface IByeFrame {
    t: EFrameType.BYE
    reason: string
}

export type TFrame = IHelloFrame | IRequestFrame | IResponseFrame | IWsOpenFrame | IWsAcceptedFrame | IWsMessageFrame | IWsCloseFrame | IByeFrame

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isText = (v: unknown, max = 4096): v is string => typeof v === 'string' && v.length <= max
const MAX_BODY_BASE64 = 64 * 1024 * 1024

const headersOf = (v: unknown): THeaders | undefined => {
    if (!isRecord(v)) return undefined
    const out: THeaders = {}
    for (const [k, value] of Object.entries(v)) {
        if (typeof value === 'string') out[k.toLowerCase()] = value
    }
    return out
}

// A path below the other core's root: it must start with '/', and never climb out of it
const pathOk = (v: unknown): v is string => isText(v, 8192) && v.startsWith('/') && !v.includes('..') && !/[\r\n]/.test(v)

/*
    The frame in a message from the other end, or undefined when it is not one this version understands. A
    peer is another Kwirth, possibly of another version or a different build: nothing it sends is trusted.
*/
export const parseFrame = (raw: string): TFrame | undefined => {
    let v: unknown
    try { v = JSON.parse(raw) } catch { return undefined }
    if (!isRecord(v)) return undefined
    switch (v.t) {
        case EFrameType.HELLO:
            return isInt(v.v) && isText(v.uid, 256) && v.uid !== '' && isText(v.name, 256)
                ? { t: EFrameType.HELLO, v: v.v, uid: v.uid, name: v.name, ...(isText(v.kwirthVersion, 40) ? { kwirthVersion: v.kwirthVersion } : {}), ...(isText(v.bridgeVersion, 40) ? { bridgeVersion: v.bridgeVersion } : {}) }
                : undefined
        case EFrameType.REQUEST: {
            const headers = headersOf(v.headers)
            if (!isInt(v.id) || !isText(v.method, 16) || !pathOk(v.path) || !headers) return undefined
            if (v.body !== undefined && !(typeof v.body === 'string' && v.body.length <= MAX_BODY_BASE64)) return undefined
            return { t: EFrameType.REQUEST, id: v.id, method: v.method.toUpperCase(), path: v.path, headers, ...(typeof v.body === 'string' ? { body: v.body } : {}) }
        }
        case EFrameType.RESPONSE: {
            const headers = headersOf(v.headers)
            if (!isInt(v.id) || !isInt(v.status) || v.status < 100 || v.status > 599 || !headers) return undefined
            if (v.body !== undefined && !(typeof v.body === 'string' && v.body.length <= MAX_BODY_BASE64)) return undefined
            return { t: EFrameType.RESPONSE, id: v.id, status: v.status, headers, ...(typeof v.body === 'string' ? { body: v.body } : {}) }
        }
        case EFrameType.WS_OPEN: {
            const headers = headersOf(v.headers)
            return isInt(v.id) && pathOk(v.path) && headers ? { t: EFrameType.WS_OPEN, id: v.id, path: v.path, headers } : undefined
        }
        case EFrameType.WS_ACCEPTED:
            return isInt(v.id) ? { t: EFrameType.WS_ACCEPTED, id: v.id } : undefined
        case EFrameType.WS_MESSAGE:
            return isInt(v.id) && typeof v.data === 'string' && v.data.length <= MAX_BODY_BASE64 && typeof v.binary === 'boolean'
                ? { t: EFrameType.WS_MESSAGE, id: v.id, data: v.data, binary: v.binary }
                : undefined
        case EFrameType.WS_CLOSE:
            return isInt(v.id)
                ? { t: EFrameType.WS_CLOSE, id: v.id, ...(isInt(v.code) ? { code: v.code } : {}), ...(isText(v.reason, 123) ? { reason: v.reason } : {}) }
                : undefined
        case EFrameType.BYE:
            return isText(v.reason, 512) ? { t: EFrameType.BYE, reason: v.reason } : undefined
        default:
            return undefined
    }
}

// Hop-by-hop headers (and those the transport recomputes): never carried across
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host', 'content-length', 'content-encoding',
    'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-accept'])

export const carriedHeaders = (headers: Record<string, string | string[] | undefined>): THeaders => {
    const out: THeaders = {}
    for (const [k, v] of Object.entries(headers)) {
        const key = k.toLowerCase()
        if (HOP_BY_HOP.has(key) || v === undefined) continue
        out[key] = Array.isArray(v) ? v.join(', ') : v
    }
    return out
}
