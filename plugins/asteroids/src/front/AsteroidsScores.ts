import { EInstanceMessageType, EInstanceMessageFlow, EInstanceMessageAction } from '@kwirthmagnify/kwirth-common'

/**
 * Scoreboard.
 *
 * It lives in the back end, in a cluster ConfigMap (`writeStorage`), so that
 * the table is shared by every user of that Kwirth and is not lost
 * when switching browsers.
 *
 * The transport is the tab's websocket, which the Kwirth front end opens and
 * hands over already open in `channelObject.webSocket`. The HTTP endpoint was
 * discarded because it would have forced us to request the `ri` at startup, which arrives in a
 * separate signal that has to be requested.
 *
 * WATCH OUT: the accessKey IS needed, over the socket too. The core rejects every
 * COMMAND without it ('No access key received') before even looking at the channel,
 * so the channel declares accessString:true and injects it into every request.
 *
 * `LocalScoreStore` is kept as a safety net for when there is no
 * socket: a local scoreboard is preferable to the game blowing up.
 */

export interface IScoreEntry {
    name: string
    score: number
    level: number
    /** ISO 8601. The authoritative date is set by the back end when saving. */
    date: string
}

export interface IScoreStore {
    load(): Promise<IScoreEntry[]>
    /**
     * Sends ONE entry and returns the resulting table.
     *
     * The whole table is deliberately not sent: with a shared scoreboard, the
     * front end's copy may be stale and overwriting it would erase other people's
     * games. The one that inserts and trims is the back end.
     */
    submit(entry: IScoreEntry): Promise<IScoreEntry[]>
}

export const MAX_SCORES = 10

/*
    Name length cap. It is 24 and not 12 because, since the name became the LOGGED-IN USER and not a
    typed alias, cutting at 12 split real identities in half.
*/
export const MAX_NAME = 24

export const MSG_SCORES_GET = 'asteroids-scores-get'
export const MSG_SCORE_SUBMIT = 'asteroids-score-submit'
export const MSG_SCORES = 'asteroids-scores'

/** Maximum time to wait for the back end to answer. */
const TIMEOUT_MS = 5000

export const sortAndTrim = (entries: IScoreEntry[]): IScoreEntry[] =>
    [...entries].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES)

/** A score gets into the table if there is a free slot or it beats the last one. */
export const qualifies = (entries: IScoreEntry[], score: number): boolean => {
    if (score <= 0) return false
    if (entries.length < MAX_SCORES) return true
    return score > entries[entries.length - 1].score
}

export const sanitizeEntries = (raw: any): IScoreEntry[] => {
    if (!Array.isArray(raw)) return []
    return sortAndTrim(raw
        .filter((e: any) => e && typeof e.score === 'number' && typeof e.name === 'string')
        .map((e: any): IScoreEntry => ({
            name: String(e.name).slice(0, MAX_NAME),
            score: e.score,
            level: typeof e.level === 'number' ? e.level : 0,
            date: typeof e.date === 'string' ? e.date : '',
        })))
}

// ── Cluster scoreboard, against the back end ──────────────────────────────

export type TSend = (message: unknown) => boolean

/**
 * Builds the BackScoreStore `send` from a socket that is requested ON EVERY SEND.
 *
 * It exists as a function of its own, and not as a closure inside the channel, because a bug lived here that
 * bit twice: capturing `channelObject.webSocket` when creating the store. Stopping and starting the channel
 * opens a NEW socket, and the store kept sending to the old one, already closed. The score was lost, and
 * it happened right after the action people use to fix things: restarting the channel.
 */
export const socketSender = (getWebSocket: () => WebSocket | undefined): TSend =>
    (message: unknown): boolean => {
        try {
            const webSocket = getWebSocket()
            if (!webSocket || webSocket.readyState !== WebSocket.OPEN) return false
            webSocket.send(JSON.stringify(message))
            return true
        }
        catch {
            return false
        }
    }

/**
 * Why the last send failed. They are two DIFFERENT faults and until now they gave the same message:
 *
 * - `not-connected`: the socket was not open. It fails instantly.
 * - `timeout`: the socket swallowed the message but the back end did not answer within 5s. Typical of a command that
 *   the core drops before it reaches the plugin (instance not registered, or no accessKey).
 */
export type TSendFailure = 'not-connected' | 'timeout'

export class BackScoreStore implements IScoreStore {
    private waiters: ((entries: IScoreEntry[]) => void)[] = []
    private timers: ReturnType<typeof setTimeout>[] = []

    /** Reason for the last failure, so the user can be told what really happened. */
    lastFailure?: TSendFailure

    constructor(private readonly send: TSend, private readonly instanceId: () => string, private readonly accessKey: () => string) { }

    private request(msgtype: string, extra: Record<string, unknown> = {}): Promise<IScoreEntry[]> {
        const sent = this.send({
            msgtype,
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.REQUEST,
            type: EInstanceMessageType.DATA,
            channel: 'asteroids',
            instance: this.instanceId(),
            accessKey: this.accessKey(),
            ...extra,
        })
        if (!sent) {
            this.lastFailure = 'not-connected'
            return Promise.resolve([])
        }
        this.lastFailure = undefined

        return new Promise<IScoreEntry[]>((resolve) => {
            const timer = setTimeout(() => {
                this.lastFailure = 'timeout'
                this.waiters = this.waiters.filter(w => w !== resolve)
                resolve([])
            }, TIMEOUT_MS)
            this.timers.push(timer)
            this.waiters.push(resolve)
        })
    }

    load(): Promise<IScoreEntry[]> {
        return this.request(MSG_SCORES_GET)
    }

    submit(entry: IScoreEntry): Promise<IScoreEntry[]> {
        return this.request(MSG_SCORE_SUBMIT, { entry })
    }

    /** Called by the channel when it receives the back end's response. */
    resolve(entries: IScoreEntry[]): void {
        for (const timer of this.timers) clearTimeout(timer)
        this.timers = []
        const waiters = this.waiters
        this.waiters = []
        for (const waiter of waiters) waiter(entries)
    }
}

// ── Safety net: no socket, local scoreboard ───────────────────────────────

const STORAGE_KEY = 'kwirth.asteroids.scores'

export class LocalScoreStore implements IScoreStore {
    async load(): Promise<IScoreEntry[]> {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            return raw ? sanitizeEntries(JSON.parse(raw)) : []
        }
        catch {
            return []
        }
    }

    async submit(entry: IScoreEntry): Promise<IScoreEntry[]> {
        const updated = sortAndTrim([...(await this.load()), entry])
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) }
        catch { /* disabled or full: it is lost and that is that */ }
        return updated
    }
}
