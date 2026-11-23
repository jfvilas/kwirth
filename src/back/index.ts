import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements, IExtensionScope, keyAllows
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, keyMatchesResource } from '@kwirthmagnify/kwirth-common-back'
import type { IProviderHandle } from '@kwirthmagnify/kwirth-common-back'
import type { CoreV1Api } from '@kubernetes/client-node'
import { Request, Response } from 'express'
import {
    EWrkCommand, EWrkError, EWrkMetricsState, EWrkScope, IWrkactjobMessage, IWrkactjobMessageResponse,
    WRK_SCOPES, WRK_SCOPE_LADDER
} from '../common/WrkactjobTypes'
import { isActive, mapJob } from './JobMapper'
import { mapEvent, sortEvents } from './EventMapper'
import { usageOf } from './PodMetrics'
import { IMetricsCluster } from './MetricsProviderTypes'

/*
    The slice of the core's ClusterInfo this channel reads. Structural, since a plugin cannot import it — and
    type-only on the client: the API objects are the CORE's, never a client of WRKACTJOB's own in the bundle.
*/
export interface IWrkClusterInfo {
    coreApi: Pick<CoreV1Api, 'listPodForAllNamespaces' | 'readNamespacedPodLog' | 'deleteNamespacedPod' | 'listNamespacedEvent'>
    getProvider(providerId: string, consumer: unknown): IProviderHandle | undefined
}

export interface IWrkInstance {
    instanceId: string
    /*
        🔴 The key the instance was opened with, and the only thing this channel authorises from. It comes from
        the instanceConfig the CORE validated, never from a later message: a message is composed by the browser.
    */
    accessKey: AccessKey
}

const METRICS_PROVIDER = 'metrics'
// A spooled file is read once, in full; this caps what one DSPSPLF can pull out of a chatty container.
export const DEFAULT_TAIL_LINES = 5000
export const MAX_TAIL_LINES = 20000
// ENDJOB's DELAY, in seconds: what a controlled end gives the job, and the most it accepts.
export const DEFAULT_DELAY = 30
export const MAX_DELAY = 999999

const errorText = (err: unknown): string => {
    const body = (err as { body?: unknown })?.body
    if (typeof body === 'string') {
        try { return (JSON.parse(body) as { message?: string }).message ?? body } catch { return body }
    }
    return err instanceof Error ? err.message : String(err)
}

const errorCode = (err: unknown): EWrkError => (err as { code?: number })?.code === 404 ? EWrkError.NOT_FOUND : EWrkError.FAILED

// 'implements IChannel' is what makes the compiler hold this class to the contract.
export class WrkactjobChannel implements IChannel {
    readonly channelId = 'wrkactjob'
    /*
        The metrics provider is a SOFT dependency: the core instantiates it if it is installed and only warns if
        it is not, and WRKACTJOB works without it (no CPU figures, and every running job is RUN). Never a
        'requires': Kwirth does not always run on Kubernetes.
    */
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [METRICS_PROVIDER] }

    clusterInfo: IWrkClusterInfo
    backChannelObject: IBackChannelObject
    private webSockets: { ws: WebSocket; lastRefresh: number; instances: IWrkInstance[] }[] = []
    // the provider's last two readings: CPU is a counter and needs a delta
    private readings: IMetricsCluster[] = []
    private metricsHandle?: IProviderHandle

    constructor(clusterInfo: IWrkClusterInfo, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'wrkactjob',
        routable: false,
        pauseable: false,
        modifiable: false,
        reconnectable: false,
        // false: this flag asks the FRONT to load the metrics list for the cluster, which WRKACTJOB does not use
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        // a cluster channel: the core calls addObject once with '*all', on the cluster picked in the cluster list
        cluster: true,
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => WRK_SCOPE_LADDER.indexOf(scope)
    getScopeCatalog = (): IExtensionScope[] => WRK_SCOPES

    private allows = (accessKey: AccessKey, scope: EWrkScope): boolean => keyAllows(accessKey, scope, this.getChannelScopeLevel)

    startChannel = async (): Promise<void> => {}

    // Called by the core before replacing this instance (hot reload) or uninstalling the plugin.
    cleanup = (): void => {
        this.unsubscribeMetrics()
        this.webSockets = []
    }

    processProviderEvent = (providerId: string, obj: unknown): void => {
        if (providerId !== METRICS_PROVIDER) return
        this.readings.push(obj as IMetricsCluster)
        if (this.readings.length > 2) this.readings.shift()
    }

    // Subscribed while somebody has WRKACTJOB open, and only then: with no tab there is nobody to show a figure to.
    private subscribeMetrics = (): void => {
        if (this.metricsHandle) return
        this.metricsHandle = this.clusterInfo.getProvider(METRICS_PROVIDER, this)
        if (!this.metricsHandle) return
        Promise.resolve(this.metricsHandle.subscribe(this, {})).catch(err => {
            this.backChannelObject.logError?.(`Cannot subscribe to the metrics provider: ${errorText(err)}`)
        })
    }

    private unsubscribeMetrics = (): void => {
        if (!this.metricsHandle) return
        try {
            Promise.resolve(this.metricsHandle.unsubscribe(this)).catch(() => { /* provider already gone */ })
        }
        catch { /* provider already gone */ }
        this.metricsHandle = undefined
        this.readings = []
    }

    private instanceCount = (): number => this.webSockets.reduce((n, s) => n + s.instances.length, 0)

    endpointRequest = async (_endpoint: string, _req: Request, _res: Response): Promise<void> => {}
    websocketRequest = async (_ws: WebSocket): Promise<void> => {}

    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, _podNamespace: string, _podName: string, _containerName: string): Promise<boolean> => {
        /*
            🔴 The door, checked BEFORE anything is registered. The core does not guard it: WRKACTJOB is a
            cluster channel, so the core never checks the scope and hands the key over for the channel to read.
        */
        const accessKey = accessKeyDeserialize(instanceConfig.accessKey)
        if (!this.allows(accessKey, EWrkScope.READ)) {
            this.backChannelObject.logWarning?.(`Denied instance ${instanceConfig.instance}: '${EWrkScope.READ}' required`)
            this.sendSignal(webSocket, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance,
                `You don't have permission to use WRKACTJOB. Opening it requires the '${EWrkScope.READ}' scope — ask an administrator.`)
            return false
        }

        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) {
            socket = { ws: webSocket, lastRefresh: Date.now(), instances: [] }
            this.webSockets.push(socket)
        }
        if (!socket.instances.some(i => i.instanceId === instanceConfig.instance)) {
            socket.instances.push({ instanceId: instanceConfig.instance, accessKey })
        }
        this.subscribeMetrics()
        return true
    }

    deleteObject = async (_ws: WebSocket, _cfg: IInstanceConfig, _ns: string, _pod: string, _ctr: string): Promise<boolean> => true

    pauseContinueInstance = (_ws: WebSocket, _cfg: IInstanceConfig, _action: EInstanceMessageAction): void => {}

    modifyInstance = (_ws: WebSocket, _cfg: IInstanceConfig): void => {}

    stopInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        this.removeInstance(webSocket, instanceConfig.instance)
        this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'WRKACTJOB stopped')
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) socket.instances = socket.instances.filter(i => i.instanceId !== instanceId)
        if (this.instanceCount() === 0) this.unsubscribeMetrics()
    }

    processCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage): Promise<boolean> => {
        const instance = this.getInstance(webSocket, instanceMessage.instance)
        if (!instance) {
            this.sendSignal(webSocket, EInstanceMessageAction.NONE, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceMessage.instance, 'Instance not found')
            return false
        }
        const message = instanceMessage as IWrkactjobMessage
        if (message.msgtype !== 'wrkactjobmessage') return false
        const response = await this.execute(instance, message)
        webSocket.send(JSON.stringify(response))
        return true
    }

    // Runs one command and builds its answer. Public so the tests can drive it without a socket.
    execute = async (instance: IWrkInstance, message: IWrkactjobMessage): Promise<IWrkactjobMessageResponse> => {
        const response: IWrkactjobMessageResponse = {
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.RESPONSE,
            type: EInstanceMessageType.DATA,
            channel: 'wrkactjob',
            instance: instance.instanceId,
            msgtype: 'wrkactjobmessageresponse',
            id: message.id,
            command: message.command,
            ok: false
        }
        const fail = (error: EWrkError, detail: string): IWrkactjobMessageResponse => ({ ...response, ok: false, error, detail })
        const namespace = message.targetNamespace ?? ''
        const name = message.targetName ?? ''
        const container = message.containerName ?? ''

        // Everything but the list names one pod, and the key has to reach it.
        if (message.command !== EWrkCommand.LIST) {
            if (!namespace || !name) return fail(EWrkError.BAD_REQUEST, 'No job given')
            if (!keyMatchesResource(instance.accessKey, { namespace, pod: name, container: container || undefined })) {
                return fail(EWrkError.NOT_AUTHORIZED, `Your key does not reach ${namespace}/${name}`)
            }
        }

        try {
            switch (message.command) {
                case EWrkCommand.LIST:
                    return { ...response, ...(await this.list(instance)), ok: true }

                case EWrkCommand.LOG: {
                    if (!container) return fail(EWrkError.BAD_REQUEST, 'No spooled file (container) given')
                    const tailLines = Math.min(Math.max(1, Math.floor(message.tailLines ?? DEFAULT_TAIL_LINES)), MAX_TAIL_LINES)
                    const log = await this.clusterInfo.coreApi.readNamespacedPodLog({ name, namespace, container, tailLines })
                    const lines = String(log ?? '').split('\n')
                    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
                    return { ...response, ok: true, lines }
                }

                case EWrkCommand.EVENTS: {
                    const list = await this.clusterInfo.coreApi.listNamespacedEvent({ namespace, fieldSelector: `involvedObject.kind=Pod,involvedObject.name=${name}` })
                    return { ...response, ok: true, events: sortEvents(list.items.map(mapEvent)) }
                }

                case EWrkCommand.END: {
                    if (!this.allows(instance.accessKey, EWrkScope.END)) {
                        this.backChannelObject.logWarning?.(`Denied end of ${namespace}/${name}: '${EWrkScope.END}' required`)
                        return fail(EWrkError.NOT_AUTHORIZED, `Ending a job requires the '${EWrkScope.END}' scope`)
                    }
                    /*
                        ENDJOB OPTION(*CNTRLD) DELAY(n): the job is told to end and given n seconds — exactly what a
                        grace period is. OPTION(*IMMED) gives it none.
                    */
                    const delay = message.immediate ? 0 : Math.floor(message.delay ?? DEFAULT_DELAY)
                    if (!(delay >= 0 && delay <= MAX_DELAY)) return fail(EWrkError.BAD_REQUEST, `DELAY must be 0 to ${MAX_DELAY}`)
                    await this.clusterInfo.coreApi.deleteNamespacedPod({ name, namespace, gracePeriodSeconds: delay })
                    this.backChannelObject.logInfo?.(`Ended job ${namespace}/${name} (${message.immediate ? '*IMMED' : `*CNTRLD, delay ${delay}`})`)
                    return { ...response, ok: true }
                }

                default:
                    return fail(EWrkError.BAD_REQUEST, `Unknown command '${String(message.command)}'`)
            }
        }
        catch (err) {
            return fail(errorCode(err), errorText(err))
        }
    }

    // Every active job the key reaches, with its usage when the provider has it.
    private list = async (instance: IWrkInstance): Promise<Pick<IWrkactjobMessageResponse, 'jobs' | 'metrics' | 'clusterCpu'>> => {
        const podList = await this.clusterInfo.coreApi.listPodForAllNamespaces()
        const usage = usageOf(this.readings)
        const jobs = podList.items
            .filter(isActive)
            .filter(p => keyMatchesResource(instance.accessKey, { namespace: p.metadata?.namespace ?? '', pod: p.metadata?.name ?? '' }))
            .map(p => mapJob(p, usage.jobs.get((p.metadata?.namespace ?? '') + '/' + (p.metadata?.name ?? ''))))
        const metrics = !this.metricsHandle
            ? EWrkMetricsState.UNAVAILABLE
            : this.readings.length < 2 ? EWrkMetricsState.WARMING : EWrkMetricsState.AVAILABLE
        return { jobs, metrics, clusterCpu: usage.clusterCpu }
    }

    containsAsset = (_ws: WebSocket, _ns: string, _pod: string, _ctr: string): boolean => false

    containsInstance = (instanceId: string): boolean =>
        this.webSockets.some(s => s.instances.some(i => i.instanceId === instanceId))

    getInstances = (): IChannelInstances => {
        const carrying = this.webSockets.filter(s => s.instances.length > 0)
        return { instances: carrying.reduce((n, s) => n + s.instances.length, 0), connections: carrying.length }
    }

    containsConnection = (webSocket: WebSocket): boolean =>
        Boolean(this.webSockets.find(s => s.ws === webSocket))

    removeConnection = (webSocket: WebSocket): void => {
        this.webSockets = this.webSockets.filter(s => s.ws !== webSocket)
        if (this.instanceCount() === 0) this.unsubscribeMetrics()
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) { socket.lastRefresh = Date.now(); return true }
        return false
    }

    updateConnection = (newWebSocket: WebSocket, instanceId: string): boolean => {
        for (const entry of this.webSockets) {
            if (entry.instances.some(i => i.instanceId === instanceId)) {
                entry.ws = newWebSocket
                return true
            }
        }
        return false
    }

    private sendSignal = (ws: WebSocket, action: EInstanceMessageAction, flow: EInstanceMessageFlow, level: ESignalMessageLevel, instanceId: string, text: string): void => {
        const msg: ISignalMessage = { action, flow, channel: 'wrkactjob', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IWrkInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
