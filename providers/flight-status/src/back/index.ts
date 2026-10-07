import express, { Request, Response } from 'express'
import {
    IExtensionLogger, IProvider, IProviderStats, IProviderStorage, IProviderSubscriber, IProviderSubscriptionHelp, KwirthData
} from '@kwirthmagnify/kwirth-common-back'
import {
    EFlightPriority, EFlightStatusEventType, IFlightStatusConfig, IFlightStatusSubscription, IWatchedAircraft, PROVIDER_ID,
    TFlightStatusEvent, defaultFlightStatusConfig
} from '../common/FlightStatus'
import { normalizeConfig, parseSubscription, validateConfig } from '../common/Validation'
import { ConfigStore } from './ConfigStore'
import { buildFlightProvider } from './lib/build'
import { FlightProvider } from './lib/flightProvider'
import { MemoryQuotaManager } from './lib/quota'

/*
    Provider 'flight-status'

    Live ADS-B positions (OpenSky), enriched on demand with AviationStack and FlightAware AeroAPI.

    The API quota is kept IN MEMORY ONLY, in this instance. It survives configuration changes (the
    FlightProvider is rebuilt, the MemoryQuotaManager is not), but not a pod restart; for that it assumes
    on start that it was going at the planned pace, and OpenSky resyncs with its headers on the first call.

    Every subscriber asks for a bbox and an interval. Subscribers with nearby bboxes share calls: the
    FlightProvider snaps the bbox to a grid and caches with coalescing.

    It owns its configuration and serves it through its 'configRouter', which the core mounts behind
    accessKey validation at '/core/providerconfig/flight-status'. Credentials travel like any other
    field: GET returns them real and PUT stores what arrives.
*/

interface ISubscriberEntry {
    sub?: IFlightStatusSubscription
    timer?: NodeJS.Timeout
    busy: boolean
    lastError?: string
}

export class FlightStatusProvider implements IProvider {
    public readonly id = PROVIDER_ID
    public readonly providesRouter = false
    public router = undefined
    public routerAlias = undefined
    public readonly requiresApiKeyApi = false
    public apiKeyApi = undefined
    // configRouter also makes the core instantiate the provider with no consumer, so the dialog always works.
    public configRouter = express.Router()

    /*
        Starts writing to the console and the core swaps it right after construction for one that already
        knows whose line this is.
    */
    private log: IExtensionLogger = {
        info: (message: unknown) => console.log(`[${PROVIDER_ID}] ${message}`),
        trace: (message: unknown) => console.log(`[${PROVIDER_ID}] ${message}`),
        warning: (message: unknown) => console.warn(`[${PROVIDER_ID}] ${message}`),
        error: (message: unknown) => console.error(`[${PROVIDER_ID}] ${message}`)
    }

    private store: ConfigStore
    private config: IFlightStatusConfig = defaultFlightStatusConfig()
    private readonly quota = new MemoryQuotaManager({ assumeOnSchedule: true })
    private flights: FlightProvider
    private subscribers = new Map<IProviderSubscriber, ISubscriberEntry>()

    private deliveries = 0
    private errors = 0

    constructor(_clusterInfo: unknown, _kwirthData: KwirthData, storage?: IProviderStorage) {
        this.store = new ConfigStore(storage)
        this.flights = buildFlightProvider(this.config, this.quota)
        this.buildConfigRouter()
    }

    setLogger = (logger: IExtensionLogger): void => { this.log = logger }

    getStats = (): IProviderStats => ({ subscribers: this.subscribers.size, events: this.deliveries, errors: this.errors })

    // ── IProvider ───────────────────────────────────────────────────────────────

    startProvider = async (): Promise<void> => {
        try {
            this.config = await this.store.load()
        }
        catch (err) {
            this.log.error(`Could not load configuration, running with defaults (anonymous OpenSky only): ${err}`)
        }
        this.flights = buildFlightProvider(this.config, this.quota)
        this.log.info(`Sources: ${this.flights.sourceIds().join(', ')}`)
    }

    stopProvider = async (): Promise<void> => {
        for (const entry of this.subscribers.values()) clearInterval(entry.timer)
        this.subscribers.clear()
    }

    addSubscriber = async (c: IProviderSubscriber, data: unknown): Promise<void> => {
        this.stop(c)
        const entry: ISubscriberEntry = { busy: false }
        this.subscribers.set(c, entry)
        this.apply(c, entry, data)
    }

    removeSubscriber = async (c: IProviderSubscriber): Promise<void> => {
        this.stop(c)
        this.subscribers.delete(c)
    }

    updateSubscription = async (c: IProviderSubscriber, data: unknown): Promise<void> => {
        const entry = this.subscribers.get(c)
        if (!entry) return
        this.stop(c)
        entry.lastError = undefined
        this.apply(c, entry, data)
    }

    getSubscriptionHelp = (): IProviderSubscriptionHelp => ({
        usage:
            'Subscribe with a bounding box. Positions are polled every intervalSec seconds and delivered as:\n' +
            '  { type: "positions", timestamp, bbox, aircraft: [...] }\n' +
            'Aircraft whose callsign is listed in "watch" carry a "details" field (origin, destination, times, ' +
            'delays) — null when no source knows that flight.\n\n' +
            'Failures arrive as { type: "error", timestamp, message }, only when the message changes, so a ' +
            'paused source does not flood you.\n\n' +
            'Gotchas:\n' +
            '  - The free APIs have monthly/daily quotas. Background polling is paced across the period: if you ' +
            'poll faster than the budget allows, ticks are skipped and you get one "no sources available" error.\n' +
            '  - intervalSec below 10 is raised to 10. Bigger bboxes cost more OpenSky credits (1 to 4 per call).\n' +
            '  - Only watched callsigns are enriched: enrichment is the scarce resource (about 100 requests a ' +
            'month on AviationStack free).\n' +
            '  - watch uses ICAO callsigns as broadcast by the aircraft (IBE3171), not IATA flight numbers.\n\n' +
            'The example covers the Iberian peninsula (a box cannot leave the Balearic Islands out). It is about 100 ' +
            'square degrees, so every call costs 3 OpenSky credits: with credentials (4000 a day) intervalSec 120 is ' +
            'comfortable; anonymous (400 a day) only holds one call every 12 minutes, so raise intervalSec to 720. ' +
            'The watched callsigns are Iberia, Vueling, Air Europa, Iberia Express and Air Nostrum examples: flights ' +
            'change every day, replace them with the ones you want to follow.',
        example: {
            bbox: { lamin: 36.0, lomin: -9.5, lamax: 43.8, lomax: 3.3 },
            intervalSec: 120,
            watch: ['IBE3171', 'VLG1001', 'AEA5023', 'IBS3902', 'ANE8410']
        },
    })

    // ── Subscribers ─────────────────────────────────────────────────────────────

    private apply(c: IProviderSubscriber, entry: ISubscriberEntry, data: unknown): void {
        const { sub, errors } = parseSubscription(data)
        entry.sub = sub
        if (!sub) {
            this.log.warning(`Invalid subscription: ${errors.join('; ')}`)
            this.deliver(c, { type: EFlightStatusEventType.ERROR, timestamp: new Date().toISOString(), message: `Invalid subscription: ${errors.join('; ')}` })
            return
        }
        void this.tick(c, entry)
        entry.timer = setInterval(() => void this.tick(c, entry), sub.intervalSec * 1000)
    }

    private stop(c: IProviderSubscriber): void {
        const entry = this.subscribers.get(c)
        if (!entry) return
        clearInterval(entry.timer)
        entry.timer = undefined
    }

    private async tick(c: IProviderSubscriber, entry: ISubscriberEntry): Promise<void> {
        const sub = entry.sub
        if (!sub || entry.busy) return
        entry.busy = true
        try {
            const aircraft = await this.flights.getPositions(sub.bbox, EFlightPriority.BACKGROUND)
            const watch = new Set(sub.watch)
            const enriched: IWatchedAircraft[] = await Promise.all(aircraft.map(async a => {
                if (!a.callsign || !watch.has(a.callsign.toUpperCase())) return a
                try {
                    return { ...a, details: await this.flights.getDetails(a.callsign, EFlightPriority.BACKGROUND) }
                }
                catch {
                    return a // no budget to enrich right now: retried on the next tick
                }
            }))
            // If the subscription changed or went away while querying, this result belongs to nobody
            if (this.subscribers.get(c) !== entry || entry.sub !== sub) return
            entry.lastError = undefined
            this.deliver(c, { type: EFlightStatusEventType.POSITIONS, timestamp: new Date().toISOString(), bbox: sub.bbox, aircraft: enriched })
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            if (message !== entry.lastError && this.subscribers.get(c) === entry) {
                entry.lastError = message
                this.deliver(c, { type: EFlightStatusEventType.ERROR, timestamp: new Date().toISOString(), message })
            }
        }
        finally {
            entry.busy = false
        }
    }

    private deliver(c: IProviderSubscriber, event: TFlightStatusEvent): void {
        this.deliveries++
        try {
            c.processProviderEvent(this.id, event)
        }
        catch (err) {
            this.errors++
            this.log.error(`Subscriber failed to process event: ${err}`)
        }
    }

    // ── Configuration ───────────────────────────────────────────────────────────

    private buildConfigRouter(): void {
        this.configRouter.route('/config')
            .get((_req: Request, res: Response) => {
                res.status(200).json(this.config)
            })
            .put(async (req: Request, res: Response) => {
                const next = normalizeConfig(req.body)
                const errors = validateConfig(next)
                if (errors.length > 0) {
                    res.status(400).json({ errors })
                    return
                }
                try {
                    await this.store.save(next)
                }
                catch (err) {
                    res.status(500).json({ errors: [String(err)] })
                    return
                }
                // Rebuilt with the SAME quota: running ticks pick up the new one on their next round
                this.config = next
                this.flights = buildFlightProvider(next, this.quota)
                this.log.info(`Configuration updated. Sources: ${this.flights.sourceIds().join(', ')}`)
                res.status(200).json({ ok: true })
            })

        this.configRouter.get('/status', (_req: Request, res: Response) => {
            res.status(200).json(this.flights.status())
        })
    }
}

export default FlightStatusProvider
