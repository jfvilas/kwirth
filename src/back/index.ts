import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements, IExtensionScope, keyAllows
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, keyMatchesResource } from '@kwirthmagnify/kwirth-common-back'
import type { IProviderHandle } from '@kwirthmagnify/kwirth-common-back'
import type { BatchV1Api, CoreV1Api, V1Pod } from '@kubernetes/client-node'
import { Request, Response } from 'express'
import {
    EWrkCommand, EWrkError, EWrkMetricsState, EWrkScope, IWrkactjobMessage, IWrkactjobMessageResponse, IWrkSystem,
    WRK_SCOPES, WRK_SCOPE_LADDER
} from '../common/WrkactjobTypes'
import { isActive, mapJob } from './JobMapper'
import { mapEvent, mapMessage, sortEvents, sortMessages } from './EventMapper'
import { IUsage, usageOf } from './PodMetrics'
import { cpuOf, IPodJob, mapDescription, mapPools, mapSubsystem, storageOf } from './SystemMapper'
import { mapSchedule, submittedJobOf } from './ScheduleMapper'
import { IMetricsCluster } from './MetricsProviderTypes'

/*
    The slice of the core's ClusterInfo this channel reads. Structural, since a plugin cannot import it — and
    type-only on the client: the API objects are the CORE's, never a client of WRKACTJOB's own in the bundle.
*/
export interface IWrkClusterInfo {
    coreApi: Pick<CoreV1Api, 'listPodForAllNamespaces' | 'readNamespacedPodLog' | 'deleteNamespacedPod' | 'listNamespacedEvent'
        | 'listNode' | 'listPersistentVolume' | 'listNamespace' | 'readNamespace' | 'listNamespacedPod'
        | 'listNamespacedResourceQuota' | 'listNamespacedLimitRange' | 'listEventForAllNamespaces'>
    batchApi: Pick<BatchV1Api, 'listCronJobForAllNamespaces' | 'listJobForAllNamespaces' | 'readNamespacedCronJob'
        | 'patchNamespacedCronJob' | 'createNamespacedJob'>
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
// DSPMSG QSYSOPR: the newest this many Warning events. A cluster in trouble has thousands, and nobody pages
// through them on a 5250.
export const MAX_MESSAGES = 1000

// The commands that name no job: they are about the system, and filter by the key themselves.
const SYSTEM_WIDE: EWrkCommand[] = [EWrkCommand.LIST, EWrkCommand.SYSTEM, EWrkCommand.SUBSYSTEMS, EWrkCommand.MESSAGES, EWrkCommand.SCHEDULES]
// The commands on a job schedule entry (a CronJob): targetName is the CronJob.
const ON_SCHEDULE: EWrkCommand[] = [EWrkCommand.HOLD, EWrkCommand.RELEASE, EWrkCommand.SUBMIT]

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

        /*
            Everything but the system-wide commands names one object, and the key has to reach it. A job is a pod;
            a job schedule entry is a CronJob, and a key's pod patterns are matched against its name (its pods are
            named after it); a subsystem alone is checked where it is described, since that needs its pods.
        */
        if (message.command === EWrkCommand.SUBSYSTEM_DESCRIPTION) {
            if (!namespace) return fail(EWrkError.BAD_REQUEST, 'No subsystem given')
        }
        else if (!SYSTEM_WIDE.includes(message.command)) {
            const what = ON_SCHEDULE.includes(message.command) ? 'job schedule entry' : 'job'
            if (!namespace || !name) return fail(EWrkError.BAD_REQUEST, `No ${what} given`)
            if (!keyMatchesResource(instance.accessKey, { namespace, pod: name, container: container || undefined })) {
                return fail(EWrkError.NOT_AUTHORIZED, `Your key does not reach ${namespace}/${name}`)
            }
        }
        if (ON_SCHEDULE.includes(message.command) && !this.allows(instance.accessKey, EWrkScope.SCHEDULE)) {
            this.backChannelObject.logWarning?.(`Denied ${message.command} of ${namespace}/${name}: '${EWrkScope.SCHEDULE}' required`)
            return fail(EWrkError.NOT_AUTHORIZED, `Holding, releasing or submitting a job schedule entry requires the '${EWrkScope.SCHEDULE}' scope`)
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

                case EWrkCommand.SYSTEM:
                    return { ...response, ok: true, system: await this.system(instance) }

                case EWrkCommand.SUBSYSTEMS:
                    return { ...response, ok: true, subsystems: await this.subsystems(instance) }

                case EWrkCommand.SUBSYSTEM_DESCRIPTION: {
                    if (!(await this.reachesSubsystem(instance, namespace))) return fail(EWrkError.NOT_AUTHORIZED, `Your key does not reach subsystem ${namespace}`)
                    const [ns, quotas, ranges] = await Promise.all([
                        this.clusterInfo.coreApi.readNamespace({ name: namespace }),
                        this.clusterInfo.coreApi.listNamespacedResourceQuota({ namespace }),
                        this.clusterInfo.coreApi.listNamespacedLimitRange({ namespace })
                    ])
                    return { ...response, ok: true, description: mapDescription(ns, quotas.items, ranges.items) }
                }

                case EWrkCommand.MESSAGES:
                    return { ...response, ok: true, messages: await this.messages(instance) }

                case EWrkCommand.SCHEDULES: {
                    const [cronJobs, jobs] = await Promise.all([
                        this.clusterInfo.batchApi.listCronJobForAllNamespaces(),
                        this.clusterInfo.batchApi.listJobForAllNamespaces()
                    ])
                    const schedules = cronJobs.items
                        .filter(c => keyMatchesResource(instance.accessKey, { namespace: c.metadata?.namespace ?? '', pod: c.metadata?.name ?? '' }))
                        .map(c => mapSchedule(c, jobs.items))
                        .sort((a, b) => a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name))
                    return { ...response, ok: true, schedules }
                }

                case EWrkCommand.HOLD:
                case EWrkCommand.RELEASE: {
                    const held = message.command === EWrkCommand.HOLD
                    // 'add' sets the field whether or not the stored object has it ('replace' needs it there).
                    await this.clusterInfo.batchApi.patchNamespacedCronJob({ name, namespace, body: [{ op: 'add', path: '/spec/suspend', value: held }] })
                    this.backChannelObject.logInfo?.(`Job schedule entry ${namespace}/${name} ${held ? 'held' : 'released'}`)
                    return { ...response, ok: true }
                }

                case EWrkCommand.SUBMIT: {
                    const cronJob = await this.clusterInfo.batchApi.readNamespacedCronJob({ name, namespace })
                    if (!cronJob.spec?.jobTemplate?.spec) return fail(EWrkError.FAILED, `Job schedule entry ${name} has no job template`)
                    const job = await this.clusterInfo.batchApi.createNamespacedJob({ namespace, body: submittedJobOf(cronJob, Date.now()) })
                    const submitted = job.metadata?.name ?? ''
                    this.backChannelObject.logInfo?.(`Job schedule entry ${namespace}/${name} submitted: job ${submitted}`)
                    return { ...response, ok: true, submitted }
                }

                default:
                    return fail(EWrkError.BAD_REQUEST, `Unknown command '${String(message.command)}'`)
            }
        }
        catch (err) {
            return fail(errorCode(err), errorText(err))
        }
    }

    private reachesPod = (instance: IWrkInstance, pod: V1Pod): boolean =>
        keyMatchesResource(instance.accessKey, { namespace: pod.metadata?.namespace ?? '', pod: pod.metadata?.name ?? '' })

    // The active pods the key reaches, each with the job WRKACTJOB makes of it.
    private activeJobs = (instance: IWrkInstance, pods: V1Pod[], usage: IUsage): IPodJob[] =>
        pods
            .filter(isActive)
            .filter(p => this.reachesPod(instance, p))
            .map(pod => ({ pod, job: mapJob(pod, usage.jobs.get((pod.metadata?.namespace ?? '') + '/' + (pod.metadata?.name ?? ''))) }))

    private metricsState = (): EWrkMetricsState => !this.metricsHandle
        ? EWrkMetricsState.UNAVAILABLE
        : this.readings.length < 2 ? EWrkMetricsState.WARMING : EWrkMetricsState.AVAILABLE

    // Every active job the key reaches, with its usage when the provider has it.
    private list = async (instance: IWrkInstance): Promise<Pick<IWrkactjobMessageResponse, 'jobs' | 'metrics' | 'clusterCpu'>> => {
        const podList = await this.clusterInfo.coreApi.listPodForAllNamespaces()
        const usage = usageOf(this.readings)
        const jobs = this.activeJobs(instance, podList.items, usage).map(p => p.job)
        return { jobs, metrics: this.metricsState(), clusterCpu: usage.clusterCpu }
    }

    /*
        WRKSYSSTS. Nodes and volumes are the cluster's: only a key at 'cluster' or above sees them (PRD-fase3 D17).
        Below it, the pools and the system ASP stay empty and the CPU is that of the jobs it reaches.
    */
    private system = async (instance: IWrkInstance): Promise<IWrkSystem> => {
        const restricted = !this.allows(instance.accessKey, EWrkScope.CLUSTER)
        const usage = usageOf(this.readings)
        const [podList, nodeList, volumeList] = await Promise.all([
            this.clusterInfo.coreApi.listPodForAllNamespaces(),
            restricted ? undefined : this.clusterInfo.coreApi.listNode(),
            restricted ? undefined : this.clusterInfo.coreApi.listPersistentVolume()
        ])
        const active = this.activeJobs(instance, podList.items, usage)
        return {
            restricted,
            jobs: active.length,
            cpu: restricted ? cpuOf(active.map(p => p.job)) : usage.clusterCpu,
            metrics: this.metricsState(),
            pools: nodeList ? mapPools(nodeList.items, active) : [],
            storage: volumeList ? storageOf(volumeList.items) : undefined
        }
    }

    /*
        WRKSBS: the namespaces the key reaches, by name or through a pod it reaches in them (a key restricted to
        some pods has no namespace of its own, but sees the subsystems those pods run in).
    */
    private subsystems = async (instance: IWrkInstance) => {
        const [nsList, podList] = await Promise.all([this.clusterInfo.coreApi.listNamespace(), this.clusterInfo.coreApi.listPodForAllNamespaces()])
        const active = this.activeJobs(instance, podList.items, usageOf(this.readings))
        return nsList.items
            .map(ns => ({ ns, inside: active.filter(p => p.job.namespace === (ns.metadata?.name ?? '')) }))
            .filter(({ ns, inside }) => inside.length > 0 || keyMatchesResource(instance.accessKey, { namespace: ns.metadata?.name ?? '' }))
            .map(({ ns, inside }) => mapSubsystem(ns, inside))
            .sort((a, b) => a.name.localeCompare(b.name))
    }

    // The same rule for one subsystem.
    private reachesSubsystem = async (instance: IWrkInstance, namespace: string): Promise<boolean> => {
        if (keyMatchesResource(instance.accessKey, { namespace })) return true
        const pods = await this.clusterInfo.coreApi.listNamespacedPod({ namespace })
        return pods.items.some(p => this.reachesPod(instance, p))
    }

    /*
        DSPMSG QSYSOPR: the Warning events of the objects the key reaches — a pod's by the pod, anything else in
        a namespace by the namespace, and a cluster object's (a node's) only at 'cluster' or above.
    */
    private messages = async (instance: IWrkInstance) => {
        const events = await this.clusterInfo.coreApi.listEventForAllNamespaces({ fieldSelector: 'type=Warning' })
        const cluster = this.allows(instance.accessKey, EWrkScope.CLUSTER)
        const reached = events.items.map(mapMessage).filter(m => {
            if (!m.namespace) return cluster
            return keyMatchesResource(instance.accessKey, { namespace: m.namespace, pod: m.kind === 'Pod' ? m.object : undefined })
        })
        return sortMessages(reached).slice(0, MAX_MESSAGES)
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
