import express, { Request, Response } from 'express'
import { IExtensionLogger, IProvider, IProviderFieldDef, IProviderStats, IProviderStorage, IProviderSubscriber, IProviderSubscriptionHelp, KwirthData } from '@kwirthmagnify/kwirth-common-back'
import { IExtensionExportOptions, IExtensionImportResult } from '@kwirthmagnify/kwirth-common'
import {
    EV16EventType, EV16StorageKey, IV16Config, IV16Event, IV16KnownSituation, IV16State, IV16Subscription, TV16Situation,
    V16_DEFAULT_CONFIG, V16_FETCH_TIMEOUT_MS, V16_MIN_INTERVAL_SECONDS
} from '../common/V16Types'
import { diffSituations, hashText, parseDatex2Situations } from './Datex2'

export * from '../common/V16Types'
export * from './Datex2'

const PROVIDER_ID = 'v16'

/*
    Provider 'v16'

    Polls the DGT DATEX2 traffic feed every N seconds and, instead of forwarding the whole document on
    every poll, dispatches only what really changed. A subscriber first gets an 'initial' event with every
    situation in force, and from then on 'update' events carrying new, modified and cleared situations,
    each one identified by its DATEX2 'id'. A poll where nothing changed dispatches nothing.

    The feed carries every traffic incident in Spain; V16 emergency beacons are the situations whose
    records were created from a 'V16_' reference. A subscriber asks for those alone with 'v16Only'.
*/

/**
 * Configuration fields kwirth renders in the generic provider dialog. IProviderFieldDef is the
 * contract every extension shares — senders, webhooks, idps and logins describe their fields
 * with exactly this type.
 *
 * The same array is published twice on purpose:
 *   - getConfigSchema() on the class below is the STANDARD way, identical to ISender.getConfigSchema.
 *     The core asks the live provider instance for it.
 *   - this module-level 'schema' export is the fallback the core reads at install time, without
 *     instantiating anything.
 */
export const schema: IProviderFieldDef[] = [
    { name: 'url', label: 'DATEX2 feed URL', type: 'text', required: false, default: V16_DEFAULT_CONFIG.url },
    { name: 'intervalSeconds', label: `Poll interval (seconds, min ${V16_MIN_INTERVAL_SECONDS})`, type: 'number', required: true, default: V16_DEFAULT_CONFIG.intervalSeconds },
]

/** Keeps only the fields that are valid, so a form or an imported file can never break the poll loop. */
export const sanitizeConfig = (base: IV16Config, incoming: Record<string, unknown>): IV16Config => {
    const next: IV16Config = { ...base }
    const url = incoming['url']
    if (typeof url === 'string' && url.trim()) next.url = url.trim()
    const interval = Number(incoming['intervalSeconds'])
    if (Number.isFinite(interval) && interval >= V16_MIN_INTERVAL_SECONDS) next.intervalSeconds = interval
    return next
}

/** What one subscriber should receive of a diff. Undefined when there is nothing for it. */
export const eventFor = (subscription: IV16Subscription, type: EV16EventType, added: IV16KnownSituation[], updated: IV16KnownSituation[], removed: IV16KnownSituation[]): IV16Event | undefined => {
    const wanted = (entry: IV16KnownSituation) => !subscription.v16Only || entry.v16
    const event: IV16Event = {
        type,
        added: added.filter(wanted).map(entry => entry.data),
        updated: updated.filter(wanted).map(entry => entry.data),
        removed: removed.filter(wanted).map(entry => entry.id)
    }
    // An INITIAL is always delivered, even empty: it is what tells the subscriber "this is the whole picture".
    if (type === EV16EventType.UPDATE && event.added.length === 0 && event.updated.length === 0 && event.removed.length === 0) return undefined
    return event
}

export class V16Provider implements IProvider {
    public readonly id = PROVIDER_ID
    public readonly providesRouter = false
    public router = undefined
    public routerAlias = undefined
    public readonly requiresApiKeyApi = false
    public apiKeyApi = undefined
    // configRouter makes the core auto-instantiate the provider even with no consumer, and serves a read-only view.
    public configRouter = express.Router()

    /*
        Starts writing to the console and the core swaps it right after construction for one that already
        knows whose line this is.
    */
    private log: IExtensionLogger = {
        info: (message: unknown) => console.log(`[${PROVIDER_ID}] ${message}`),
        warning: (message: unknown) => console.warn(`[${PROVIDER_ID}] ${message}`),
        error: (message: unknown) => console.error(`[${PROVIDER_ID}] ${message}`)
    }

    private subscribers = new Map<IProviderSubscriber, IV16Subscription>()
    private storage: IProviderStorage | undefined
    private config: IV16Config = { ...V16_DEFAULT_CONFIG }
    private timer: NodeJS.Timeout | undefined
    // A poll in flight when the provider stops must not schedule the next one.
    private stopped = true

    // Not to reprocess the XML when the whole document did not change.
    private lastEtag: string | undefined
    private lastHash: string | undefined
    // Last known snapshot, by situation id, to compute the next diff.
    private known = new Map<string, IV16KnownSituation>()
    private didInitialPush = false

    private lastPoll = 0
    private lastError = ''
    private eventCount = 0
    private errorCount = 0

    constructor(_clusterInfo: unknown, _kwirthData: KwirthData, storage?: IProviderStorage) {
        this.storage = storage
        this.buildConfigRouter()
    }

    setLogger = (logger: IExtensionLogger): void => { this.log = logger }

    /**
     * A subscriber arriving after the first poll has not seen the current picture: it gets an INITIAL with
     * the snapshot in force, to it ALONE. One arriving before gets it with the first poll.
     */
    addSubscriber = async (subscriber: IProviderSubscriber, data: IV16Subscription): Promise<void> => {
        const subscription: IV16Subscription = { v16Only: data?.v16Only === true }
        this.subscribers.set(subscriber, subscription)
        if (this.didInitialPush) {
            const event = eventFor(subscription, EV16EventType.INITIAL, [...this.known.values()], [], [])
            if (event) this.deliver(subscriber, event)
        }
    }

    removeSubscriber = async (subscriber: IProviderSubscriber): Promise<void> => {
        this.subscribers.delete(subscriber)
    }

    getSubscriptionHelp = (): IProviderSubscriptionHelp => ({
        usage: 'Subscribe with no payload to receive every situation of the DGT traffic feed, or with ' +
            '{ "v16Only": true } to receive only V16 emergency beacons. The first event has type "initial" and ' +
            'carries every situation in force in "added" ("updated" and "removed" empty). From then on, only when ' +
            'the feed really changes, events have type "update" and carry just the changes: new situations in ' +
            '"added", modified ones in "updated" and the ids of cleared ones in "removed". A poll with no changes ' +
            'sends nothing. Situations are full DATEX2 objects with namespace prefixes stripped, attributes ' +
            'prefixed with "@_" (the id is "@_id") and every value as a string.',
        example: { v16Only: true },
        fields: [
            { name: 'v16Only', type: 'boolean', required: false, description: 'Only V16 beacon situations. Absent or false means every situation in the feed.' }
        ]
    })

    getConfigSchema = (): IProviderFieldDef[] => schema

    getConfigNames = (): string[] => ['default']

    /** Called by the core at instantiation with whatever the generic dialog saved. Never trust the shape. */
    configure = (config: Record<string, unknown>): void => {
        this.config = sanitizeConfig(this.config, config)
    }

    getStats = (): IProviderStats => ({
        subscribers: this.subscribers.size,
        events: this.eventCount,
        errors: this.errorCount
    })

    startProvider = async (): Promise<void> => {
        await this.loadConfig()
        this.stopped = false
        this.log.info(`started, url=${this.config.url}, interval=${this.config.intervalSeconds}s`)
        // First poll right away; the next ones schedule themselves when each one ends.
        void this.poll()
    }

    stopProvider = async (): Promise<void> => {
        this.stopped = true
        if (this.timer) clearTimeout(this.timer)
        this.timer = undefined
        this.subscribers.clear()
        this.log.info('stopped')
    }

    // ── PRIVATE ─────────────────────────────────────────────────────────────────

    /**
     * Management route, mounted by the core BEHIND accessKey validation at '/core/providerconfig/v16'.
     * Read-only: the configuration is edited in the generic dialog.
     */
    private buildConfigRouter = (): void => {
        this.configRouter.route('/state').get((_req: Request, res: Response) => res.status(200).json(this.state()))
        this.configRouter.route('/situations').get((req: Request, res: Response) => {
            const v16Only = req.query['v16Only'] === 'true'
            res.status(200).json([...this.known.values()].filter(entry => !v16Only || entry.v16).map(entry => entry.data))
        })
    }

    private state = (): IV16State => {
        let v16Situations = 0
        for (const entry of this.known.values()) if (entry.v16) v16Situations++
        return {
            url: this.config.url,
            intervalSeconds: this.config.intervalSeconds,
            lastPoll: this.lastPoll,
            lastError: this.lastError,
            situations: this.known.size,
            v16Situations,
            subscribers: this.subscribers.size
        }
    }

    private scheduleNext = (): void => {
        if (this.stopped) return
        // Never overwrite a pending handle: stopProvider() could no longer cancel the orphaned one.
        if (this.timer) clearTimeout(this.timer)
        this.timer = setTimeout(() => { void this.poll() }, Math.max(this.config.intervalSeconds, V16_MIN_INTERVAL_SECONDS) * 1000)
    }

    private poll = async (): Promise<void> => {
        try {
            const headers: Record<string, string> = {}
            if (this.lastEtag) headers['If-None-Match'] = this.lastEtag
            const res = await fetch(this.config.url, { headers, signal: AbortSignal.timeout(V16_FETCH_TIMEOUT_MS) })
            if (this.stopped) return

            if (res.status === 304) {
                // Nothing changed since the last poll: nothing to dispatch.
                this.lastPoll = Date.now()
                this.lastError = ''
            }
            else if (res.ok) {
                this.lastEtag = res.headers.get('etag') ?? undefined
                const xml = await res.text()
                this.lastPoll = Date.now()
                this.lastError = ''
                const hash = hashText(xml)
                if (hash !== this.lastHash) {
                    this.lastHash = hash
                    this.apply(parseDatex2Situations(xml))
                }
            }
            else {
                this.fail(`HTTP ${res.status} downloading the DATEX2 feed`)
            }
        }
        catch (err) {
            this.fail(`DATEX2 feed poll failed: ${err}`)
        }
        finally {
            this.scheduleNext()
        }
    }

    private fail = (message: string): void => {
        this.errorCount++
        this.lastError = message
        this.log.error(message)
    }

    /** Computes the diff against the previous poll and dispatches, per subscriber, only what it wants. */
    private apply = (situations: TV16Situation[]): void => {
        const diff = diffSituations(this.known, situations)
        const type = this.didInitialPush ? EV16EventType.UPDATE : EV16EventType.INITIAL
        this.didInitialPush = true
        for (const [subscriber, subscription] of this.subscribers) {
            const event = type === EV16EventType.INITIAL
                ? eventFor(subscription, type, [...this.known.values()], [], [])
                : eventFor(subscription, type, diff.added, diff.updated, diff.removed)
            if (event) this.deliver(subscriber, event)
        }
    }

    private deliver = (subscriber: IProviderSubscriber, event: IV16Event): void => {
        try {
            subscriber.processProviderEvent(PROVIDER_ID, event)
            this.eventCount++
        }
        catch (err) {
            // A subscriber that throws cannot take the fan-out to the rest down with it.
            this.errorCount++
            this.log.error(`subscriber threw while processing an event: ${err}`)
        }
    }

    private loadConfig = async (): Promise<void> => {
        if (!this.storage) return
        try {
            const stored: unknown = await this.storage.readStorage(EV16StorageKey.CONFIG, false)
            if (stored && typeof stored === 'object') this.config = sanitizeConfig(this.config, stored as Record<string, unknown>)
        }
        catch (err) {
            // Nothing stored yet: the defaults (or what configure() set) stand.
            this.log.info(`no stored config: ${err}`)
        }
    }

    private saveConfig = async (): Promise<void> => {
        if (!this.storage) return
        // 'secret' decides the target: true -> Kubernetes Secret, false -> ConfigMap. Nothing secret here.
        await this.storage.writeStorage(EV16StorageKey.CONFIG, false, this.config)
    }

    /*
        ── Configuration portability (IExtension) ──────────────────────────────────────────────
        Only configuration travels: the feed URL and the interval. The snapshot of situations is runtime
        state and stays here. There are no secrets. Importing what was exported changes nothing.
    */
    exportConfig = async (options: IExtensionExportOptions): Promise<unknown> => {
        void options
        return { config: this.config }
    }

    importConfig = async (data: unknown): Promise<IExtensionImportResult> => {
        const incoming = (data as { config?: unknown })?.config
        if (!incoming || typeof incoming !== 'object') {
            return { applied: 0, skipped: 0, warnings: ['no v16 configuration found in the imported data'] }
        }
        const record = incoming as Record<string, unknown>
        const previousUrl = this.config.url
        this.config = sanitizeConfig(V16_DEFAULT_CONFIG, record)
        if (this.config.url !== previousUrl) {
            // Another feed: its ETag and hash say nothing about the new one.
            this.lastEtag = undefined
            this.lastHash = undefined
        }
        await this.saveConfig()
        const warnings: string[] = []
        if (record['intervalSeconds'] !== undefined && this.config.intervalSeconds !== Number(record['intervalSeconds'])) {
            warnings.push(`intervalSeconds below ${V16_MIN_INTERVAL_SECONDS} or not a number: kept ${this.config.intervalSeconds}`)
        }
        // Applied live: the next poll already uses the new interval and URL.
        return { applied: 1, skipped: 0, warnings }
    }
}

export default V16Provider
