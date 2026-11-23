import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements, IExtensionScope, keyAllows
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, keyMatchesResource } from '@kwirthmagnify/kwirth-common-back'
import type { IProviderHandle } from '@kwirthmagnify/kwirth-common-back'
import type { BatchV1Api, CoreV1Api, CustomObjectsApi, SchedulingV1Api, V1CertificateSigningRequest, V1CertificateSigningRequestList, V1Pod } from '@kubernetes/client-node'
import { Request, Response } from 'express'
import {
    CLUSTER_SCOPED_KINDS, ESdsfCommand, ESdsfError, ESdsfMetricsState, ESdsfNodeAction, ESdsfObjectKind, ESdsfScope, ISdsfMessage, ISdsfMessageResponse,
    SDSF_SCOPES, SDSF_SCOPE_LADDER
} from '../common/SdsfTypes'
import { mapPod } from './PodMapper'
import { describeCronJob, describeCsr, describeJob, describeNode, describePod, describePriorityClass } from './Describe'
import { mapJobClass } from './ClassMapper'
import { mapRequests } from './RequestMapper'
import { isEvictable, isRunning, mapNode, nodeIdsOf } from './NodeMapper'
import { mapEvent, sortEvents } from './EventMapper'
import { mapCronJob, mapJob } from './JobMapper'
import { usageOf } from './PodMetrics'
import { IMetricsCluster } from './MetricsProviderTypes'

/*
    The slice of the core's ClusterInfo this channel reads. Structural, since a plugin cannot import it — and
    type-only on the client: the API objects are the CORE's, never a client of SDSF's own in the bundle.
*/
export interface ISdsfClusterInfo {
    coreApi: Pick<CoreV1Api, 'listPodForAllNamespaces' | 'readNamespacedPod' | 'readNamespacedPodLog' | 'deleteNamespacedPod' | 'listNamespacedEvent' | 'listEventForAllNamespaces'
        | 'listNode' | 'readNode' | 'patchNode' | 'createNamespacedPodEviction'>
    batchApi: Pick<BatchV1Api, 'listJobForAllNamespaces' | 'listCronJobForAllNamespaces' | 'readNamespacedJob' | 'readNamespacedCronJob' | 'deleteNamespacedJob' | 'deleteNamespacedCronJob'>
    schedulingApi: Pick<SchedulingV1Api, 'listPriorityClass' | 'readPriorityClass'>
    // The CSRs: the core has no CertificatesV1Api, and the generic one reaches any group by its path.
    crdApi: Pick<CustomObjectsApi, 'listClusterCustomObject' | 'getClusterCustomObject'>
    getProvider(providerId: string, consumer: unknown): IProviderHandle | undefined
}

interface IInstance {
    instanceId: string
    /*
        🔴 The key the instance was opened with, and the only thing this channel authorises from. It comes
        from the instanceConfig the CORE validated, never from a later message: a message is composed by the
        browser.
    */
    accessKey: AccessKey
}

const METRICS_PROVIDER = 'metrics'
// A browse is read once, in full; this caps what one S command can pull out of a chatty container.
export const DEFAULT_TAIL_LINES = 5000
export const MAX_TAIL_LINES = 20000

const errorText = (err: unknown): string => {
    const body = (err as { body?: unknown })?.body
    if (typeof body === 'string') {
        try { return (JSON.parse(body) as { message?: string }).message ?? body } catch { return body }
    }
    return err instanceof Error ? err.message : String(err)
}

// The CSRs, through the generic API: their group, version and plural.
const CSR_RESOURCE = { group: 'certificates.k8s.io', version: 'v1', plural: 'certificatesigningrequests' }

const errorCode = (err: unknown): ESdsfError => (err as { code?: number })?.code === 404 ? ESdsfError.NOT_FOUND : ESdsfError.FAILED

// 'implements IChannel' is what makes the compiler hold this class to the contract.
export class SdsfChannel implements IChannel {
    readonly channelId = 'sdsf'
    /*
        The metrics provider is a SOFT dependency: the core instantiates it if it is installed and only warns
        if it is not, and SDSF works without it (the metric columns show '-' and the panel says why). Never a
        'requires': Kwirth does not always run on Kubernetes.
    */
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [METRICS_PROVIDER] }

    clusterInfo: ISdsfClusterInfo
    backChannelObject: IBackChannelObject
    private webSockets: { ws: WebSocket; lastRefresh: number; instances: IInstance[] }[] = []
    // the provider's last two readings: CPU is a counter and needs a delta
    private readings: IMetricsCluster[] = []
    private metricsHandle?: IProviderHandle

    constructor(clusterInfo: ISdsfClusterInfo, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'sdsf',
        routable: false,
        pauseable: false,
        modifiable: false,
        reconnectable: false,
        // false: this flag asks the FRONT to load the metrics list for the cluster, which SDSF does not use
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        // a cluster channel: the core calls addObject once with '*all', on the cluster picked in the cluster list
        cluster: true,
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => SDSF_SCOPE_LADDER.indexOf(scope)
    getScopeCatalog = (): IExtensionScope[] => SDSF_SCOPES

    private allows = (accessKey: AccessKey, scope: ESdsfScope): boolean => keyAllows(accessKey, scope, this.getChannelScopeLevel)

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

    /*
        Subscribed while somebody has SDSF open, and only then: with no tab there is nobody to show a
        figure to, and the provider would be handing snapshots to an idle channel.
    */
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
            🔴 The door, checked BEFORE anything is registered. The core does not guard it: SDSF is a cluster
            channel, so the core never checks the scope and hands the key over for the channel to read.
        */
        const accessKey = accessKeyDeserialize(instanceConfig.accessKey)
        if (!this.allows(accessKey, ESdsfScope.READ)) {
            this.backChannelObject.logWarning?.(`Denied instance ${instanceConfig.instance}: '${ESdsfScope.READ}' required`)
            this.sendSignal(webSocket, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance,
                `You don't have permission to use SDSF. Opening it requires the '${ESdsfScope.READ}' scope — ask an administrator.`)
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
        this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'SDSF stopped')
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
        const message = instanceMessage as ISdsfMessage
        if (message.msgtype !== 'sdsfmessage') return false
        const response = await this.execute(instance, message)
        webSocket.send(JSON.stringify(response))
        return true
    }

    // Runs one command and builds its answer. Public so the tests can drive it without a socket.
    execute = async (instance: IInstance, message: ISdsfMessage): Promise<ISdsfMessageResponse> => {
        const response: ISdsfMessageResponse = {
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.RESPONSE,
            type: EInstanceMessageType.DATA,
            channel: 'sdsf',
            instance: instance.instanceId,
            msgtype: 'sdsfmessageresponse',
            id: message.id,
            command: message.command,
            ok: false
        }
        const fail = (error: ESdsfError, detail: string): ISdsfMessageResponse => ({ ...response, ok: false, error, detail })
        const targetNamespace = message.targetNamespace ?? ''
        const targetName = message.targetName ?? ''
        const containerName = message.containerName ?? ''
        const kind = message.objectKind ?? ESdsfObjectKind.POD
        const isList = message.command === ESdsfCommand.LIST || message.command === ESdsfCommand.EVENTS || message.command === ESdsfCommand.JOBS
            || message.command === ESdsfCommand.NODES || message.command === ESdsfCommand.CLASSES || message.command === ESdsfCommand.REQUESTS
        const clusterScoped = message.command === ESdsfCommand.NODE || (message.command === ESdsfCommand.DESCRIBE && CLUSTER_SCOPED_KINDS.includes(kind))

        /*
            Everything but the lists names one object, and the key has to reach it: a pod by its namespace, name
            and container; a Job or a CronJob by its namespace (a key limited to pods reaches no Job). A node has
            no namespace, nor a PriorityClass or a CSR: describing them is reading, as listing them is; changing a
            node is for 'admin' (below).
        */
        if (clusterScoped) {
            if (!targetName) return fail(ESdsfError.BAD_REQUEST, 'No target given')
        }
        else if (!isList) {
            if (!targetNamespace || !targetName) return fail(ESdsfError.BAD_REQUEST, 'No target given')
            const target = kind === ESdsfObjectKind.POD
                ? { namespace: targetNamespace, pod: targetName, container: containerName || undefined }
                : { namespace: targetNamespace }
            if (!keyMatchesResource(instance.accessKey, target)) {
                return fail(ESdsfError.NOT_AUTHORIZED, `Your key does not reach ${targetNamespace}/${targetName}`)
            }
        }

        try {
            switch (message.command) {
                case ESdsfCommand.LIST:
                    return { ...response, ...(await this.list(instance)), ok: true }

                case ESdsfCommand.LOG: {
                    if (kind !== ESdsfObjectKind.POD) return fail(ESdsfError.BAD_REQUEST, 'Only a pod has a log')
                    if (!containerName) return fail(ESdsfError.BAD_REQUEST, 'No container given')
                    const tailLines = Math.min(Math.max(1, Math.floor(message.tailLines ?? DEFAULT_TAIL_LINES)), MAX_TAIL_LINES)
                    const log = await this.clusterInfo.coreApi.readNamespacedPodLog({ name: targetName, namespace: targetNamespace, container: containerName, tailLines })
                    const lines = String(log ?? '').split('\n')
                    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
                    return { ...response, ok: true, lines }
                }

                case ESdsfCommand.NODES:
                    return { ...response, ok: true, nodes: await this.nodes(instance) }

                case ESdsfCommand.NODE:
                    return await this.nodeAction(instance, message.nodeAction, targetName, response)

                case ESdsfCommand.CLASSES:
                    return { ...response, ok: true, classes: await this.classes(instance) }

                case ESdsfCommand.REQUESTS: {
                    const list = await this.clusterInfo.crdApi.listClusterCustomObject(CSR_RESOURCE) as V1CertificateSigningRequestList
                    return { ...response, ok: true, requests: mapRequests(list.items) }
                }

                case ESdsfCommand.DESCRIBE: {
                    switch (kind) {
                        case ESdsfObjectKind.NODE:
                            return { ...response, ok: true, lines: await this.describeNode(instance, targetName) }
                        case ESdsfObjectKind.PRIORITY_CLASS: {
                            const pc = await this.clusterInfo.schedulingApi.readPriorityClass({ name: targetName })
                            const pods = (await this.reachedPods(instance)).filter(p => p.spec?.priorityClassName === targetName)
                            return { ...response, ok: true, lines: describePriorityClass(pc, pods) }
                        }
                        case ESdsfObjectKind.CSR: {
                            const csr = await this.clusterInfo.crdApi.getClusterCustomObject({ ...CSR_RESOURCE, name: targetName }) as V1CertificateSigningRequest
                            return { ...response, ok: true, lines: describeCsr(csr) }
                        }
                        default:
                            break
                    }
                    let events: Awaited<ReturnType<CoreV1Api['listNamespacedEvent']>>['items'] = []
                    const readEvents = async () => {
                        try {
                            events = (await this.clusterInfo.coreApi.listNamespacedEvent({ namespace: targetNamespace, fieldSelector: `involvedObject.name=${targetName}` })).items
                        }
                        catch (err) {
                            // A describe without events is still a describe: the key may not reach events.
                            this.backChannelObject.logWarning?.(`Cannot read events of ${targetNamespace}/${targetName}: ${errorText(err)}`)
                        }
                    }
                    switch (kind) {
                        case ESdsfObjectKind.JOB: {
                            const job = await this.clusterInfo.batchApi.readNamespacedJob({ name: targetName, namespace: targetNamespace })
                            await readEvents()
                            return { ...response, ok: true, lines: describeJob(job, events) }
                        }
                        case ESdsfObjectKind.CRONJOB: {
                            const cron = await this.clusterInfo.batchApi.readNamespacedCronJob({ name: targetName, namespace: targetNamespace })
                            await readEvents()
                            return { ...response, ok: true, lines: describeCronJob(cron, events) }
                        }
                        default: {
                            const pod = await this.clusterInfo.coreApi.readNamespacedPod({ name: targetName, namespace: targetNamespace })
                            await readEvents()
                            return { ...response, ok: true, lines: describePod(pod, events) }
                        }
                    }
                }

                case ESdsfCommand.JOBS: {
                    const [jobs, crons] = await Promise.all([
                        this.clusterInfo.batchApi.listJobForAllNamespaces(),
                        this.clusterInfo.batchApi.listCronJobForAllNamespaces()
                    ])
                    const all = [...jobs.items.map(mapJob), ...crons.items.map(mapCronJob)]
                    return { ...response, ok: true, jobs: all.filter(j => keyMatchesResource(instance.accessKey, { namespace: j.namespace })) }
                }

                case ESdsfCommand.EVENTS: {
                    /*
                        Only what the key reaches: an event about a pod needs the pod, any other the namespace.
                        A cluster-scoped object (a node) has no namespace, so a key limited to namespaces does
                        not see its events — the same rule the core applies everywhere.
                    */
                    const list = await this.clusterInfo.coreApi.listEventForAllNamespaces()
                    const events = list.items.map(mapEvent).filter(e =>
                        keyMatchesResource(instance.accessKey, { namespace: e.namespace, pod: e.kind === 'Pod' ? e.name : undefined }))
                    return { ...response, ok: true, events: sortEvents(events) }
                }

                case ESdsfCommand.CANCEL: {
                    if (!this.allows(instance.accessKey, ESdsfScope.CANCEL)) {
                        this.backChannelObject.logWarning?.(`Denied cancel of ${targetNamespace}/${targetName}: '${ESdsfScope.CANCEL}' required`)
                        return fail(ESdsfError.NOT_AUTHORIZED, `Cancelling requires the '${ESdsfScope.CANCEL}' scope`)
                    }
                    const options = { name: targetName, namespace: targetNamespace, ...(message.force ? { gracePeriodSeconds: 0 } : {}) }
                    switch (kind) {
                        case ESdsfObjectKind.JOB:
                            // Background propagation: the Job's pods go with it, as `kubectl delete job` does.
                            await this.clusterInfo.batchApi.deleteNamespacedJob({ ...options, propagationPolicy: 'Background' })
                            break
                        case ESdsfObjectKind.CRONJOB:
                            await this.clusterInfo.batchApi.deleteNamespacedCronJob({ ...options, propagationPolicy: 'Background' })
                            break
                        default:
                            await this.clusterInfo.coreApi.deleteNamespacedPod(options)
                    }
                    this.backChannelObject.logInfo?.(`Cancelled ${kind} ${targetNamespace}/${targetName}${message.force ? ' (force)' : ''}`)
                    return { ...response, ok: true }
                }

                default:
                    return fail(ESdsfError.BAD_REQUEST, `Unknown command '${String(message.command)}'`)
            }
        }
        catch (err) {
            return fail(errorCode(err), errorText(err))
        }
    }

    // Every node, as INIT shows them. Its status reads every pod on it; its Pods count only those the key reaches.
    private nodes = async (instance: IInstance) => {
        const [nodeList, podList] = await Promise.all([this.clusterInfo.coreApi.listNode(), this.clusterInfo.coreApi.listPodForAllNamespaces()])
        const usage = usageOf(this.readings)
        const byNode = new Map<string, V1Pod[]>()
        for (const pod of podList.items) {
            const node = pod.spec?.nodeName
            if (node) byNode.set(node, [...(byNode.get(node) ?? []), pod])
        }
        const ids = nodeIdsOf(nodeList.items.map(n => n.metadata?.name ?? ''))
        return nodeList.items.map((node, i) => {
            const name = node.metadata?.name ?? ''
            const onNode = byNode.get(name) ?? []
            const reached = onNode.filter(p => isRunning(p) && keyMatchesResource(instance.accessKey, { namespace: p.metadata?.namespace ?? '', pod: p.metadata?.name ?? '' })).length
            return mapNode(node, ids[i], onNode, reached, usage.nodes.get(name), usage.interval)
        })
    }

    // The pods still running that the key reaches.
    private reachedPods = async (instance: IInstance): Promise<V1Pod[]> =>
        (await this.clusterInfo.coreApi.listPodForAllNamespaces()).items
            .filter(p => isRunning(p) && keyMatchesResource(instance.accessKey, { namespace: p.metadata?.namespace ?? '', pod: p.metadata?.name ?? '' }))

    // Every PriorityClass, as JC shows them, with the pods of each the key reaches.
    private classes = async (instance: IInstance) => {
        const [classList, pods] = await Promise.all([this.clusterInfo.schedulingApi.listPriorityClass(), this.reachedPods(instance)])
        const counts = new Map<string, number>()
        for (const pod of pods) {
            const name = pod.spec?.priorityClassName
            if (name) counts.set(name, (counts.get(name) ?? 0) + 1)
        }
        return classList.items.map(pc => mapJobClass(pc, counts.get(pc.metadata?.name ?? '') ?? 0))
    }

    private describeNode = async (instance: IInstance, name: string): Promise<string[]> => {
        const node = await this.clusterInfo.coreApi.readNode({ name })
        const pods = (await this.clusterInfo.coreApi.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${name}` })).items
            .filter(p => isRunning(p) && keyMatchesResource(instance.accessKey, { namespace: p.metadata?.namespace ?? '', pod: p.metadata?.name ?? '' }))
        let events: Awaited<ReturnType<CoreV1Api['listEventForAllNamespaces']>>['items'] = []
        try {
            events = (await this.clusterInfo.coreApi.listEventForAllNamespaces({ fieldSelector: `involvedObject.kind=Node,involvedObject.name=${name}` })).items
                .filter(e => keyMatchesResource(instance.accessKey, { namespace: e.metadata?.namespace ?? '' }))
        }
        catch (err) {
            this.backChannelObject.logWarning?.(`Cannot read events of node ${name}: ${errorText(err)}`)
        }
        return describeNode(node, pods, events)
    }

    /*
        S, Z and P on INIT, for 'admin' only. The cordon is a JSON patch with 'add', which also works on a node
        that never had spec.unschedulable ('replace' would be refused there). A drain cordons first and then
        asks one eviction per pod (DaemonSet and static pods aside), as `kubectl drain` does: evictions honour
        the PodDisruptionBudgets, and the ones refused are reported, not hidden. It does not wait for the pods
        to go — the INIT panel shows the node HALTED until it is empty, then DRAINED.
    */
    private nodeAction = async (instance: IInstance, action: ESdsfNodeAction | undefined, name: string, response: ISdsfMessageResponse): Promise<ISdsfMessageResponse> => {
        if (!this.allows(instance.accessKey, ESdsfScope.ADMIN)) {
            this.backChannelObject.logWarning?.(`Denied ${action ?? 'node action'} on node ${name}: '${ESdsfScope.ADMIN}' required`)
            return { ...response, ok: false, error: ESdsfError.NOT_AUTHORIZED, detail: `Starting, halting or draining a node requires the '${ESdsfScope.ADMIN}' scope` }
        }
        const cordon = (unschedulable: boolean) => this.clusterInfo.coreApi.patchNode({ name, body: [{ op: 'add', path: '/spec/unschedulable', value: unschedulable }] })
        switch (action) {
            case ESdsfNodeAction.START:
                await cordon(false)
                this.backChannelObject.logInfo?.(`Node ${name} started (uncordoned)`)
                return { ...response, ok: true }
            case ESdsfNodeAction.HALT:
                await cordon(true)
                this.backChannelObject.logInfo?.(`Node ${name} halted (cordoned)`)
                return { ...response, ok: true }
            case ESdsfNodeAction.DRAIN: {
                await cordon(true)
                const pods = (await this.clusterInfo.coreApi.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${name}` })).items
                    .filter(p => isRunning(p) && isEvictable(p))
                const failures: string[] = []
                let evicted = 0
                for (const pod of pods) {
                    const podName = pod.metadata?.name ?? ''
                    const namespace = pod.metadata?.namespace ?? ''
                    try {
                        await this.clusterInfo.coreApi.createNamespacedPodEviction({ name: podName, namespace, body: { apiVersion: 'policy/v1', kind: 'Eviction', metadata: { name: podName, namespace } } })
                        evicted++
                    }
                    catch (err) {
                        failures.push(`${namespace}/${podName}: ${errorText(err)}`)
                    }
                }
                this.backChannelObject.logInfo?.(`Node ${name} drained: ${evicted} of ${pods.length} pod(s) evicted`)
                if (failures.length > 0) {
                    return { ...response, ok: false, error: ESdsfError.FAILED, evicted, detail: `Halted; ${evicted} of ${pods.length} pod(s) evicted. Refused: ${failures.join('; ')}` }
                }
                return { ...response, ok: true, evicted }
            }
            default:
                return { ...response, ok: false, error: ESdsfError.BAD_REQUEST, detail: `Unknown node action '${String(action)}'` }
        }
    }

    // Every pod the key reaches, with its usage when the provider has it.
    private list = async (instance: IInstance): Promise<Pick<ISdsfMessageResponse, 'pods' | 'metrics' | 'clusterCpu'>> => {
        const podList = await this.clusterInfo.coreApi.listPodForAllNamespaces()
        const usage = usageOf(this.readings)
        const pods = podList.items
            .map(mapPod)
            .filter(p => keyMatchesResource(instance.accessKey, { namespace: p.namespace, pod: p.name }))
            .map(p => {
                const u = usage.pods.get(p.namespace + '/' + p.name)
                return u ? { ...p, cpu: u.cpu, memory: u.memory } : p
            })
        const metrics = !this.metricsHandle
            ? ESdsfMetricsState.UNAVAILABLE
            : this.readings.length < 2 ? ESdsfMetricsState.WARMING : ESdsfMetricsState.AVAILABLE
        return { pods, metrics, clusterCpu: usage.clusterCpu }
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
        const msg: ISignalMessage = { action, flow, channel: 'sdsf', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): IInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
