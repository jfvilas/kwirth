import { BackChannelData, EClusterType, IBackChannelObject, IChannel, IInstanceConfig, IInstanceMessage, EInstanceMessageType, EInstanceMessageFlow, EInstanceMessageAction } from '@kwirthmagnify/kwirth-common-back'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'

/**
 * Back end of the Asteroids channel.
 *
 * The game runs entirely in the browser; the back end only keeps the scoreboard.
 *
 * It is persisted with `writeStorage`, which the core always injects into the
 * backChannelObject (it does not depend on the requirements) and which ends up in a
 * ConfigMap called `kwirth-store-channel-asteroids-scores`. That makes the table
 * belong to the cluster and not to the browser: every user of that Kwirth sees it.
 *
 * The transport is the tab's websocket, not an HTTP endpoint. An endpoint
 * would have forced us to request the `ri` at startup in order to build the
 * URL; over the socket that is not needed.
 *
 * The accessKey IS needed all the same: the core requires it on EVERY command that
 * comes in through the socket and drops the message without it, before looking at the channel.
 *
 * For a COMMAND to reach this point, the core requires the channel to have the
 * instance registered (`containsInstance`). That is why `addObject` records it:
 * without that, messages are silently dropped.
 */

const STORAGE_KEY = 'asteroids-scores'
const MAX_SCORES = 10
/** Name length cap. The name is the logged-in user, and 12 characters cut real identities in half. */
const MAX_NAME = 24

export const MSG_SCORES_GET = 'asteroids-scores-get'
export const MSG_SCORE_SUBMIT = 'asteroids-score-submit'
export const MSG_SCORES = 'asteroids-scores'

interface IScoreEntry {
    name: string
    score: number
    level: number
    date: string
}

interface IInstance {
    instanceId: string
    webSocket: WebSocket
    /*
        Sender to notify when the record is beaten, chosen in the channel setup. It is stored per
        INSTANCE because that is where the user configures it: each tab can have its own, or
        none, which is the usual case.
    */
    senderId?: string
    senderConfigName?: string
}

/** Sanitising: never trust what the front end sends. */
const sanitize = (raw: any): IScoreEntry | undefined => {
    if (!raw || typeof raw !== 'object') return undefined
    const score = Number(raw.score)
    if (!Number.isFinite(score) || score <= 0) return undefined
    const level = Number(raw.level)
    return {
        name: String(raw.name ?? 'anon').replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_NAME) || 'anon',
        score: Math.floor(score),
        level: Number.isFinite(level) ? Math.floor(level) : 0,
        date: new Date().toISOString(),
    }
}

const sortAndTrim = (entries: IScoreEntry[]): IScoreEntry[] =>
    [...entries].sort((a, b) => b.score - a.score).slice(0, MAX_SCORES)

class AsteroidsBackChannel implements IChannel {
    readonly channelId = 'asteroids'
    readonly requirements = { storage: true, providers: [] as string[] }
    clusterInfo: any
    backChannelObject: IBackChannelObject

    private instances: IInstance[] = []

    /**
     * Write queue. Reading, inserting and writing on a ConfigMap is not
     * atomic: two games ending at the same time could overwrite each other. Chaining
     * the operations prevents that WITHIN this process.
     *
     * Known limitation: with several kwirth-back replicas there is still a
     * race. For a scoreboard that is an acceptable loss; if it stopped being so,
     * we would have to re-read and retry on a ConfigMap version conflict.
     */
    private queue: Promise<any> = Promise.resolve()

    constructor(clusterInfo: any, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'asteroids',
        routable: false,
        pauseable: true,
        modifiable: false,
        reconnectable: false,
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        cluster: false,
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => ['', 'none'].indexOf(scope)

    startChannel = async (): Promise<void> => { }

    endpointRequest = (): void => { }
    websocketRequest = (): void => { }
    processProviderEvent = (): void => { }

    /**
     * The core calls this with the three selectors empty, since this is a standalone channel.
     * Registering the instance is what enables processCommand.
     */
    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig): Promise<boolean> => {
        // The channel configuration travels in instanceConfig.data.
        const data = (instanceConfig.data ?? {}) as { senderId?: string, senderConfigName?: string }
        this.instances.push({
            instanceId: instanceConfig.instance,
            webSocket,
            senderId: data.senderId,
            senderConfigName: data.senderConfigName,
        })
        return true
    }

    deleteObject = async (): Promise<boolean> => false

    pauseContinueInstance = (): void => { }
    modifyInstance = (): void => { }

    containsInstance = (instanceId: string): boolean =>
        this.instances.some(i => i.instanceId === instanceId)

    /*
        What the core shows as the channel's activity. The two figures are NOT the same: each open
        tab is an instance, but a single browser carries all of them over ONE websocket, so
        connections are counted over distinct sockets, not over entries in the list.
    */
    getInstances = (): IChannelInstances => ({
        instances: this.instances.length,
        connections: new Set(this.instances.map(i => i.webSocket)).size,
    })

    containsAsset = (): boolean => false

    stopInstance = (_webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        this.instances = this.instances.filter(i => i.instanceId !== instanceConfig.instance)
    }

    removeInstance = (_webSocket: WebSocket, instanceId: string): void => {
        this.instances = this.instances.filter(i => i.instanceId !== instanceId)
    }

    containsConnection = (webSocket: WebSocket): boolean =>
        this.instances.some(i => i.webSocket === webSocket)

    removeConnection = (webSocket: WebSocket): void => {
        this.instances = this.instances.filter(i => i.webSocket !== webSocket)
    }

    refreshConnection = (): boolean => true
    updateConnection = (): boolean => true

    processCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage): Promise<boolean> => {
        const msg = instanceMessage as any

        switch (msg.msgtype) {
            case MSG_SCORES_GET:
                this.queue = this.queue.then(async () => {
                    const scores = await this.read()
                    this.reply(webSocket, instanceMessage, scores)
                })
                return true

            case MSG_SCORE_SUBMIT:
                this.queue = this.queue.then(async () => {
                    const entry = sanitize(msg.entry)
                    const current = await this.read()
                    const updated = entry ? sortAndTrim([...current, entry]) : current
                    if (entry) {
                        try {
                            await this.backChannelObject.writeStorage!(STORAGE_KEY, false, updated)
                        }
                        catch (err) {
                            this.backChannelObject.logError?.(`asteroids: could not save the scoreboard: ${err}`)
                            // Reply anyway with what there is, so that the
                            // front end is not left hanging while it waits.
                            this.reply(webSocket, instanceMessage, current)
                            return
                        }
                        /*
                            Here, and not earlier, is where we know whether the record has been BEATEN:
                            the number one before has to be compared with the one after. It is done after
                            writing so as not to announce a record that never got saved.
                        */
                        this.notifyRecord(instanceMessage.instance, current, updated, entry)
                    }
                    // Every open tab is notified, not only the one that
                    // sent it: that way the rest see the new table without reloading.
                    this.broadcast(instanceMessage, updated)
                })
                return true

            default:
                return false
        }
    }

    /*
        Notifies through the configured sender ONLY when the number one is beaten, which is what people
        understand by "record". Entering the table at any other position does not notify: with ten
        slots, almost any game would get in at the beginning and the notification would lose all its value.

        The send is NOT awaited and does NOT break the save: the scoreboard is already written and the
        score is what matters. If the sender fails, the trace is left and we carry on.
    */
    private notifyRecord = (instanceId: string, before: IScoreEntry[], after: IScoreEntry[], entry: IScoreEntry): void => {
        const instance = this.instances.find(i => i.instanceId === instanceId)
        if (!instance?.senderId || !instance.senderConfigName) return
        if (after[0] !== entry) return                          // did not end up first
        if (before.length > 0 && entry.score <= before[0].score) return   // a tie is not beating it

        const previous = before.length > 0 ? `${before[0].name} (${before[0].score})` : 'nobody'
        this.backChannelObject.senders?.send(instance.senderId, instance.senderConfigName, {
            subject: `Asteroids: new record by ${entry.name}`,
            body: `${entry.name} scored ${entry.score} points on level ${entry.level}. `
                + `The previous record was held by ${previous}.`,
        })?.catch?.((err: unknown) => {
            this.backChannelObject.logWarning?.(`asteroids: could not send the record notification: ${err}`)
        })
    }

    private read = async (): Promise<IScoreEntry[]> => {
        try {
            const stored = await this.backChannelObject.readStorage!(STORAGE_KEY, false)
            if (!Array.isArray(stored)) return []
            return sortAndTrim(stored.map(sanitize).filter((e): e is IScoreEntry => e !== undefined))
        }
        catch (err) {
            this.backChannelObject.logWarning?.(`asteroids: unreadable scoreboard, starting empty: ${err}`)
            return []
        }
    }

    private reply = (webSocket: WebSocket, source: IInstanceMessage, scores: IScoreEntry[]): void => {
        const response = {
            msgtype: MSG_SCORES,
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.RESPONSE,
            type: EInstanceMessageType.DATA,
            channel: 'asteroids',
            instance: source.instance,
            scores,
        }
        try { webSocket.send(JSON.stringify(response)) }
        catch { /* socket down: it will be cleaned up in removeConnection */ }
    }

    private broadcast = (source: IInstanceMessage, scores: IScoreEntry[]): void => {
        for (const instance of this.instances) {
            const response = {
                msgtype: MSG_SCORES,
                action: EInstanceMessageAction.COMMAND,
                flow: EInstanceMessageFlow.RESPONSE,
                type: EInstanceMessageType.DATA,
                channel: 'asteroids',
                instance: instance.instanceId,
                scores,
            }
            try { instance.webSocket.send(JSON.stringify(response)) }
            catch { /* same as above */ }
        }
        void source
    }
}

export default AsteroidsBackChannel
