import {
    IInstanceConfig, ISignalMessage, IInstanceMessage, AccessKey, accessKeyDeserialize,
    EClusterType, BackChannelData, EInstanceMessageType,
    EInstanceMessageAction, EInstanceMessageFlow, ESignalMessageLevel,
    IBackChannelRequirements, IExtensionScope, keyAllows
} from '@kwirthmagnify/kwirth-common'
import { IChannelInstances } from '@kwirthmagnify/kwirth-common'
import { IBackChannelObject, IChannel, keyMatchesResource } from '@kwirthmagnify/kwirth-common-back'
import type { IProviderHandle } from '@kwirthmagnify/kwirth-common-back'
import type { AppsV1Api, BatchV1Api, CoreV1Api, V1Pod } from '@kubernetes/client-node'
import { Request, Response } from 'express'
import {
    EShutDownAction, ETasklistCommand, ETasklistError, ETasklistScope, ITasklistMessage, ITasklistMessageResponse,
    ITasklistProcess, ITasklistSnapshot, TASKLIST_SCOPES, TASKLIST_SCOPE_LADDER
} from '../common/TasklistTypes'
import { IdRegistry, isValidName, mapApplication, mapNode, mapProcess, mapUser, newTaskPod, PeakRegistry } from './Mapper'
import { requestOf } from './Quantity'
import { usageOf } from './Usage'
import { IMetricsCluster } from './MetricsProviderTypes'

/*
    The slice of the core's ClusterInfo this channel reads. Structural, since a plugin cannot import it — and
    type-only on the client: the API objects are the CORE's, never a client of the Task Manager's own in the bundle.
*/
export interface ITasklistClusterInfo {
    coreApi: Pick<CoreV1Api, 'listPodForAllNamespaces' | 'listNode' | 'listNamespace' | 'readNamespacedPod' | 'deleteNamespacedPod'
        | 'createNamespacedPod' | 'deleteNamespace' | 'patchNode' | 'createNamespacedPodEviction'>
    appsApi: Pick<AppsV1Api, 'listDeploymentForAllNamespaces' | 'readNamespacedReplicaSet' | 'deleteNamespacedDeployment'
        | 'deleteNamespacedReplicaSet' | 'deleteNamespacedStatefulSet' | 'deleteNamespacedDaemonSet'>
    batchApi: Pick<BatchV1Api, 'deleteNamespacedJob'>
    getProvider(providerId: string, consumer: unknown): IProviderHandle | undefined
}

export interface ITasklistInstance {
    instanceId: string
    /*
        🔴 The key the instance was opened with, and the only thing this channel authorises from. It comes from
        the instanceConfig the CORE validated, never from a later message: a message is composed by the browser.
    */
    accessKey: AccessKey
}

const METRICS_PROVIDER = 'metrics'

const errorText = (err: unknown): string => {
    const body = (err as { body?: unknown })?.body
    if (typeof body === 'string') {
        try { return (JSON.parse(body) as { message?: string }).message ?? body } catch { return body }
    }
    return err instanceof Error ? err.message : String(err)
}

const errorCode = (err: unknown): ETasklistError => {
    const code = (err as { code?: number })?.code
    if (code === 404) return ETasklistError.NOT_FOUND
    if (code === 403) return ETasklistError.ACCESS_DENIED
    return ETasklistError.FAILED
}

// 'implements IChannel' is what makes the compiler hold this class to the contract.
export class TasklistChannel implements IChannel {
    readonly channelId = 'tasklist'
    /*
        The metrics provider is a SOFT dependency: without it the window still lists processes, applications and
        users, with no CPU or memory figures. Never a 'requires': Kwirth does not always run on Kubernetes.
    */
    readonly requirements: IBackChannelRequirements = { storage: false, providers: [METRICS_PROVIDER] }

    clusterInfo: ITasklistClusterInfo
    backChannelObject: IBackChannelObject
    private webSockets: { ws: WebSocket; lastRefresh: number; instances: ITasklistInstance[] }[] = []
    // the provider's last two readings: CPU and network are counters and need a delta
    private readings: IMetricsCluster[] = []
    private metricsHandle?: IProviderHandle
    // PIDs and user IDs, and the peak working set, are the channel's: the same for every tab of the cluster
    private pids = new IdRegistry(4, 4)
    private userIds = new IdRegistry(0, 1)
    private peaks = new PeakRegistry()

    constructor(clusterInfo: ITasklistClusterInfo, backChannelObject: IBackChannelObject) {
        this.clusterInfo = clusterInfo
        this.backChannelObject = backChannelObject
    }

    getChannelData = (): BackChannelData => ({
        id: 'tasklist',
        routable: false,
        pauseable: false,
        modifiable: false,
        reconnectable: false,
        // false: this flag asks the FRONT to load the metrics list for the cluster, which the Task Manager does not use
        metrics: false,
        sources: [EClusterType.KUBERNETES],
        endpoints: [],
        websocket: false,
        // a cluster channel: the core calls addObject once with '*all', on the cluster picked in the cluster list
        cluster: true,
        resourced: false
    })

    getChannelScopeLevel = (scope: string): number => TASKLIST_SCOPE_LADDER.indexOf(scope)
    getScopeCatalog = (): IExtensionScope[] => TASKLIST_SCOPES

    private allows = (accessKey: AccessKey, scope: ETasklistScope): boolean => keyAllows(accessKey, scope, this.getChannelScopeLevel)

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

    // Subscribed while somebody has the Task Manager open, and only then.
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
            🔴 The door, checked BEFORE anything is registered. The core does not guard it: this is a cluster
            channel, so the core never checks the scope and hands the key over for the channel to read.
        */
        const accessKey = accessKeyDeserialize(instanceConfig.accessKey)
        if (!this.allows(accessKey, ETasklistScope.READ)) {
            this.backChannelObject.logWarning?.(`Denied instance ${instanceConfig.instance}: '${ETasklistScope.READ}' required`)
            this.sendSignal(webSocket, EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.ERROR, instanceConfig.instance,
                `You don't have permission to use the Task Manager. Opening it requires the '${ETasklistScope.READ}' scope — ask an administrator.`)
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
        this.sendSignal(webSocket, EInstanceMessageAction.STOP, EInstanceMessageFlow.RESPONSE, ESignalMessageLevel.INFO, instanceConfig.instance, 'Task Manager stopped')
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
        const message = instanceMessage as ITasklistMessage
        if (message.msgtype !== 'tasklistmessage') return false
        const response = await this.execute(instance, message)
        webSocket.send(JSON.stringify(response))
        return true
    }

    // Runs one command and builds its answer. Public so the tests can drive it without a socket.
    execute = async (instance: ITasklistInstance, message: ITasklistMessage): Promise<ITasklistMessageResponse> => {
        const response: ITasklistMessageResponse = {
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.RESPONSE,
            type: EInstanceMessageType.DATA,
            channel: 'tasklist',
            instance: instance.instanceId,
            msgtype: 'tasklistmessageresponse',
            id: message.id,
            command: message.command,
            ok: false
        }
        const fail = (error: ETasklistError, detail: string): ITasklistMessageResponse => ({ ...response, ok: false, error, detail })
        const denied = (scope: string, what: string): ITasklistMessageResponse => {
            this.backChannelObject.logWarning?.(`Denied ${message.command} of ${what}: '${scope}' required`)
            return fail(ETasklistError.ACCESS_DENIED, 'Access is denied.')
        }
        const namespace = message.targetNamespace ?? ''
        const name = message.targetName ?? ''
        const key = instance.accessKey

        try {
            switch (message.command) {
                case ETasklistCommand.SNAPSHOT:
                    return {
                        ...response, ok: true, snapshot: await this.snapshot(instance),
                        canEnd: this.allows(key, ETasklistScope.END), isAdmin: this.allows(key, ETasklistScope.ADMIN)
                    }

                case ETasklistCommand.END_PROCESS: {
                    if (!namespace || !name) return fail(ETasklistError.NOT_FOUND, 'No process given')
                    if (!this.allows(key, ETasklistScope.END) || !keyMatchesResource(key, { namespace, pod: name })) return denied(ETasklistScope.END, `${namespace}/${name}`)
                    await this.clusterInfo.coreApi.deleteNamespacedPod({ name, namespace })
                    this.backChannelObject.logInfo?.(`Ended process ${namespace}/${name}`)
                    return { ...response, ok: true }
                }

                case ETasklistCommand.END_PROCESS_TREE: {
                    if (!namespace || !name) return fail(ETasklistError.NOT_FOUND, 'No process given')
                    if (!this.allows(key, ETasklistScope.END) || !keyMatchesResource(key, { namespace, pod: name })) return denied(ETasklistScope.END, `${namespace}/${name}`)
                    const ended = await this.endTree(instance, namespace, name)
                    if (!ended) return denied(ETasklistScope.END, `the tree of ${namespace}/${name}`)
                    this.backChannelObject.logInfo?.(`Ended process tree of ${namespace}/${name}: ${ended}`)
                    return { ...response, ok: true, detail: ended }
                }

                case ETasklistCommand.END_TASK: {
                    if (!namespace || !name) return fail(ETasklistError.NOT_FOUND, 'No task given')
                    if (!this.allows(key, ETasklistScope.END) || !keyMatchesResource(key, { namespace, pod: name })) return denied(ETasklistScope.END, `${namespace}/${name}`)
                    await this.clusterInfo.appsApi.deleteNamespacedDeployment({ name, namespace })
                    this.backChannelObject.logInfo?.(`Ended task (Deployment) ${namespace}/${name}`)
                    return { ...response, ok: true }
                }

                case ETasklistCommand.NEW_TASK: {
                    const image = (message.image ?? '').trim()
                    if (!image) return fail(ETasklistError.FAILED, 'Type the name of an image.')
                    if (!isValidName(name)) return fail(ETasklistError.FAILED, `'${name}' is not a valid name: lowercase letters, digits and '-', up to 63.`)
                    if (!namespace) return fail(ETasklistError.FAILED, 'Choose a user (namespace).')
                    if (!this.allows(key, ETasklistScope.END) || !keyMatchesResource(key, { namespace, pod: name })) return denied(ETasklistScope.END, `${namespace}/${name}`)
                    await this.clusterInfo.coreApi.createNamespacedPod({ namespace, body: newTaskPod(namespace, name, image) })
                    this.backChannelObject.logInfo?.(`New task ${namespace}/${name} (${image})`)
                    return { ...response, ok: true }
                }

                case ETasklistCommand.LOG_OFF: {
                    if (!name) return fail(ETasklistError.NOT_FOUND, 'No user given')
                    if (!this.allows(key, ETasklistScope.ADMIN)) return denied(ETasklistScope.ADMIN, `namespace ${name}`)
                    await this.clusterInfo.coreApi.deleteNamespace({ name })
                    this.backChannelObject.logInfo?.(`Logged off user (deleted namespace) ${name}`)
                    return { ...response, ok: true }
                }

                case ETasklistCommand.SHUT_DOWN: {
                    if (!name) return fail(ETasklistError.NOT_FOUND, 'No computer (node) given')
                    if (!this.allows(key, ETasklistScope.ADMIN)) return denied(ETasklistScope.ADMIN, `node ${name}`)
                    const detail = await this.shutDown(name, message.shutDown)
                    this.backChannelObject.logInfo?.(`Shut down (${message.shutDown}) node ${name}: ${detail}`)
                    return { ...response, ok: true, detail }
                }

                default:
                    return fail(ETasklistError.FAILED, `Unknown command '${String(message.command)}'`)
            }
        }
        catch (err) {
            return fail(errorCode(err), errorText(err))
        }
    }

    private reachesPod = (instance: ITasklistInstance, pod: V1Pod): boolean =>
        keyMatchesResource(instance.accessKey, { namespace: pod.metadata?.namespace ?? '', pod: pod.metadata?.name ?? '' })

    /*
        Everything the window shows. Processes, applications and users are what the key reaches; the nodes (CPUs,
        memory, network adapters) are the cluster's and only a key at 'cluster' or above sees them — below it the
        Performance tab is drawn from the processes the key reaches, as WRKACTJOB's WRKSYSSTS does.
    */
    private snapshot = async (instance: ITasklistInstance): Promise<ITasklistSnapshot> => {
        const key = instance.accessKey
        const wholeCluster = this.allows(key, ETasklistScope.CLUSTER)
        const usage = usageOf(this.readings)
        const [podList, nodeList, nsList, deploymentList] = await Promise.all([
            this.clusterInfo.coreApi.listPodForAllNamespaces(),
            wholeCluster ? this.clusterInfo.coreApi.listNode() : undefined,
            this.clusterInfo.coreApi.listNamespace(),
            this.clusterInfo.appsApi.listDeploymentForAllNamespaces()
        ])

        const reached = podList.items.filter(p => this.reachesPod(instance, p))
        const processes: ITasklistProcess[] = reached.map(p => mapProcess(p, usage, this.pids, this.peaks))
        // a uid that is gone is forgotten, but only for pods nobody can see any more (the registries are shared)
        const alive = new Set(podList.items.map(p => p.metadata?.uid ?? ''))
        this.pids.keepOnly(alive)
        this.peaks.keepOnly(alive)

        const users = nsList.items
            .filter(ns => keyMatchesResource(key, { namespace: ns.metadata?.name ?? '' }) || processes.some(p => p.namespace === ns.metadata?.name))
            .map(ns => mapUser(ns, processes, this.userIds))
            .sort((a, b) => a.name.localeCompare(b.name))
        this.userIds.keepOnly(new Set(nsList.items.map(ns => ns.metadata?.name ?? '')))

        const applications = deploymentList.items
            .filter(d => keyMatchesResource(key, { namespace: d.metadata?.namespace ?? '', pod: d.metadata?.name ?? '' }))
            .map(mapApplication)
            .sort((a, b) => a.name.localeCompare(b.name) || a.namespace.localeCompare(b.namespace))

        const requests = reached.reduce((total, p) => ({ cpu: total.cpu + requestOf(p, 'cpu'), memory: total.memory + requestOf(p, 'memory') }), { cpu: 0, memory: 0 })

        let metrics = usage.cluster
        if (metrics && !wholeCluster) {
            // the key's share: its processes added up
            metrics = {
                ...metrics,
                cpu: Math.round(processes.reduce((n, p) => n + (p.cpu ?? 0), 0) * 100) / 100,
                memory: processes.reduce((n, p) => n + (p.memory ?? 0), 0)
            }
        }

        return {
            processes,
            nodes: (nodeList?.items ?? []).map(n => mapNode(n, usage)).sort((a, b) => a.name.localeCompare(b.name)),
            users,
            applications,
            requests,
            metrics
        }
    }

    /*
        End Process Tree (PRD D14): the controller that keeps the pod alive goes, and its pods with it. A ReplicaSet
        is followed up to its Deployment. A pod with no controller is the whole tree. The key must reach the
        controller by its name too, as it reaches a pod. Returns what was deleted, or undefined when the key does
        not reach it.
    */
    private endTree = async (instance: ITasklistInstance, namespace: string, name: string): Promise<string | undefined> => {
        const pod = await this.clusterInfo.coreApi.readNamespacedPod({ name, namespace })
        const owner = (pod.metadata?.ownerReferences ?? []).find(r => r.controller) ?? pod.metadata?.ownerReferences?.[0]
        let kind = owner?.kind ?? ''
        let ownerName = owner?.name ?? ''
        if (kind === 'ReplicaSet') {
            const rs = await this.clusterInfo.appsApi.readNamespacedReplicaSet({ name: ownerName, namespace })
            const up = (rs.metadata?.ownerReferences ?? []).find(r => r.controller && r.kind === 'Deployment')
            if (up) { kind = 'Deployment'; ownerName = up.name }
        }
        if (!owner) {
            await this.clusterInfo.coreApi.deleteNamespacedPod({ name, namespace })
            return `Pod ${name}`
        }
        if (!keyMatchesResource(instance.accessKey, { namespace, pod: ownerName })) return undefined
        // the pods go with their controller, not orphaned
        const propagationPolicy = 'Background'
        switch (kind) {
            case 'Deployment': await this.clusterInfo.appsApi.deleteNamespacedDeployment({ name: ownerName, namespace, propagationPolicy }); break
            case 'ReplicaSet': await this.clusterInfo.appsApi.deleteNamespacedReplicaSet({ name: ownerName, namespace, propagationPolicy }); break
            case 'StatefulSet': await this.clusterInfo.appsApi.deleteNamespacedStatefulSet({ name: ownerName, namespace, propagationPolicy }); break
            case 'DaemonSet': await this.clusterInfo.appsApi.deleteNamespacedDaemonSet({ name: ownerName, namespace, propagationPolicy }); break
            case 'Job': await this.clusterInfo.batchApi.deleteNamespacedJob({ name: ownerName, namespace, propagationPolicy }); break
            default:
                // a controller the Task Manager does not know (an operator's): the pod alone, which it will recreate
                await this.clusterInfo.coreApi.deleteNamespacedPod({ name, namespace })
                return `Pod ${name} (its ${kind} ${ownerName} is not one the Task Manager ends)`
        }
        return `${kind} ${ownerName}`
    }

    /*
        Shut Down on a node (PRD D6). Cordon and uncordon are a JSON patch 'add' of spec.unschedulable — never the
        'replace' of common-back's nodeCordon, which fails on a node that was never cordoned. Turn Off
        drains: cordon, then evict every pod on the node but a DaemonSet's (which would come straight back) and
        the mirror pods of static ones (which cannot be evicted). An eviction a PodDisruptionBudget refuses is
        reported, not forced.
    */
    private shutDown = async (node: string, action: EShutDownAction | undefined): Promise<string> => {
        // 'add' sets the field whether or not the node has it ('replace' needs it there)
        const cordon = (unschedulable: boolean) => this.clusterInfo.coreApi.patchNode({ name: node, body: [{ op: 'add', path: '/spec/unschedulable', value: unschedulable }] })
        switch (action) {
            case EShutDownAction.STAND_BY:
                await cordon(true)
                return 'cordoned'
            case EShutDownAction.RESTART:
                await cordon(false)
                return 'uncordoned'
            case EShutDownAction.TURN_OFF: {
                await cordon(true)
                const pods = await this.clusterInfo.coreApi.listPodForAllNamespaces({ fieldSelector: `spec.nodeName=${node}` })
                const evictable = pods.items.filter(p =>
                    !(p.metadata?.ownerReferences ?? []).some(r => r.kind === 'DaemonSet' || r.kind === 'Node')
                    && !p.metadata?.annotations?.['kubernetes.io/config.mirror'])
                const refused: string[] = []
                for (const p of evictable) {
                    const namespace = p.metadata?.namespace ?? ''
                    const name = p.metadata?.name ?? ''
                    try {
                        await this.clusterInfo.coreApi.createNamespacedPodEviction({ name, namespace, body: { apiVersion: 'policy/v1', kind: 'Eviction', metadata: { name, namespace } } })
                    }
                    catch (err) {
                        refused.push(`${namespace}/${name}: ${errorText(err)}`)
                    }
                }
                const evicted = evictable.length - refused.length
                return refused.length === 0 ? `drained, ${evicted} pod(s) evicted` : `cordoned, ${evicted} pod(s) evicted, ${refused.length} refused (${refused.join('; ')})`
            }
            default:
                throw new Error(`Unknown Shut Down action '${String(action)}'`)
        }
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
        const msg: ISignalMessage = { action, flow, channel: 'tasklist', instance: instanceId, type: EInstanceMessageType.SIGNAL, text, level }
        ws.send(JSON.stringify(msg))
    }

    private getInstance = (webSocket: WebSocket, instanceId: string): ITasklistInstance | undefined => {
        const socket = this.webSockets.find(s => s.ws === webSocket)
        return socket?.instances.find(i => i.instanceId === instanceId)
    }
}
