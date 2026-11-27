import type { V1ContainerStatus, V1Deployment, V1Namespace, V1Node, V1Pod } from '@kubernetes/client-node'
import { ITasklistApplication, ITasklistContainer, ITasklistNode, ITasklistOwner, ITasklistProcess, ITasklistUser } from '../common/TasklistTypes'
import { quantityOf } from './Quantity'
import { IUsage } from './Usage'

/*
    Windows numbers its processes in steps of 4. A pod keeps its number while the channel lives, and a pod that
    is recreated (another uid) gets a new one — just what XP shows when a process is restarted.
*/
export class IdRegistry {
    private ids = new Map<string, number>()
    private next: number
    private readonly step: number

    constructor(first: number, step: number) {
        this.next = first
        this.step = step
    }

    idOf = (key: string): number => {
        let id = this.ids.get(key)
        if (id === undefined) {
            id = this.next
            this.next += this.step
            this.ids.set(key, id)
        }
        return id
    }

    // Forgets whatever is not in `alive`, so the map does not grow forever on a cluster that churns pods.
    keepOnly = (alive: Set<string>): void => {
        for (const key of this.ids.keys()) if (!alive.has(key)) this.ids.delete(key)
    }
}

// The highest working set seen per pod (XP's Peak Mem Usage), forgotten with the pod.
export class PeakRegistry {
    private peaks = new Map<string, number>()

    peakOf = (key: string, value: number | undefined): number | undefined => {
        const peak = Math.max(this.peaks.get(key) ?? 0, value ?? 0)
        if (peak > 0) this.peaks.set(key, peak)
        return peak > 0 ? peak : undefined
    }

    keepOnly = (alive: Set<string>): void => {
        for (const key of this.peaks.keys()) if (!alive.has(key)) this.peaks.delete(key)
    }
}

const stateOf = (status: V1ContainerStatus | undefined): string => {
    if (status?.state?.running) return 'Running'
    if (status?.state?.waiting) return `Waiting (${status.state.waiting.reason ?? 'unknown'})`
    if (status?.state?.terminated) return `Terminated (${status.state.terminated.reason ?? 'unknown'})`
    return 'Unknown'
}

/*
    The controller that owns a pod. A ReplicaSet is a Deployment's way of keeping pods, and its pods carry the
    template hash the ReplicaSet appended to the Deployment's name: without the hash, it is the Deployment (the
    same rule `kubectl` follows to show a rollout's pods). End Process Tree confirms it on the ReplicaSet itself.
*/
export const ownerOf = (pod: V1Pod): ITasklistOwner | undefined => {
    const ref = (pod.metadata?.ownerReferences ?? []).find(r => r.controller) ?? pod.metadata?.ownerReferences?.[0]
    if (!ref) return undefined
    const hash = pod.metadata?.labels?.['pod-template-hash']
    if (ref.kind === 'ReplicaSet' && hash && ref.name.endsWith('-' + hash)) {
        return { kind: 'Deployment', name: ref.name.slice(0, -(hash.length + 1)) }
    }
    return { kind: ref.kind, name: ref.name }
}

const sum = (values: (number | undefined)[]): number | undefined =>
    values.some(v => v !== undefined) ? values.reduce<number>((total, v) => total + (v ?? 0), 0) : undefined

export const mapProcess = (pod: V1Pod, usage: IUsage, pids: IdRegistry, peaks: PeakRegistry): ITasklistProcess => {
    const namespace = pod.metadata?.namespace ?? ''
    const name = pod.metadata?.name ?? ''
    const uid = pod.metadata?.uid ?? `${namespace}/${name}`
    const statuses = pod.status?.containerStatuses ?? []
    const containers: ITasklistContainer[] = (pod.spec?.containers ?? []).map(c => {
        const status = statuses.find(s => s.name === c.name)
        const used = usage.containers.get(`${namespace}/${name}/${c.name}`)
        return {
            name: c.name,
            image: c.image ?? '',
            state: stateOf(status),
            ready: status?.ready ?? false,
            restarts: status?.restartCount ?? 0,
            cpu: used?.cpu,
            memory: used?.memory
        }
    })
    const used = (pod.spec?.containers ?? []).map(c => usage.containers.get(`${namespace}/${name}/${c.name}`))
    const memory = sum(used.map(u => u?.memory))
    const cpu = sum(used.map(u => u?.cpu))
    const startTime = pod.status?.startTime
    return {
        uid,
        pid: pids.idOf(uid),
        name,
        namespace,
        node: pod.spec?.nodeName ?? '',
        phase: pod.metadata?.deletionTimestamp ? 'Terminating' : (pod.status?.phase ?? 'Unknown'),
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        owner: ownerOf(pod),
        cpu: cpu === undefined ? undefined : Math.round(cpu * 100) / 100,
        cpuTime: sum(used.map(u => u?.cpuSeconds)),
        memory,
        peakMemory: peaks.peakOf(uid, memory),
        ioRead: sum(used.map(u => u?.ioRead)),
        ioWrite: sum(used.map(u => u?.ioWrite)),
        containers
    }
}

export const mapNode = (node: V1Node, usage: IUsage): ITasklistNode => {
    const name = node.metadata?.name ?? ''
    const cpuCapacity = quantityOf(node.status?.capacity?.['cpu'])
    const used = usage.nodes.get(name)
    return {
        name,
        ready: (node.status?.conditions ?? []).some(c => c.type === 'Ready' && c.status === 'True'),
        unschedulable: node.spec?.unschedulable === true,
        cpuCapacity,
        cpuAllocatable: quantityOf(node.status?.allocatable?.['cpu']),
        memoryCapacity: quantityOf(node.status?.capacity?.['memory']),
        memoryAllocatable: quantityOf(node.status?.allocatable?.['memory']),
        // the summary gives cores in use; the Performance tab wants the node's own %
        cpu: used?.cpu !== undefined && cpuCapacity > 0 ? Math.round(used.cpu / cpuCapacity * 100 * 100) / 100 : undefined,
        memory: used?.memory,
        rxBytesPerSecond: used?.rxBytesPerSecond,
        txBytesPerSecond: used?.txBytesPerSecond
    }
}

export const mapApplication = (deployment: V1Deployment): ITasklistApplication => ({
    namespace: deployment.metadata?.namespace ?? '',
    name: deployment.metadata?.name ?? '',
    replicas: deployment.spec?.replicas ?? 1,
    readyReplicas: deployment.status?.readyReplicas ?? 0
})

export const mapUser = (namespace: V1Namespace, processes: ITasklistProcess[], ids: IdRegistry): ITasklistUser => {
    const name = namespace.metadata?.name ?? ''
    return {
        id: ids.idOf(name),
        name,
        phase: namespace.status?.phase ?? (namespace.metadata?.deletionTimestamp ? 'Terminating' : 'Active'),
        pods: processes.filter(p => p.namespace === name).length
    }
}

/*
    The pod a New Task runs: one container with the image, never restarted (a task that ends is gone, as on
    Windows), labelled so it can be told apart.
*/
export const newTaskPod = (namespace: string, name: string, image: string): V1Pod => ({
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: { name, namespace, labels: { 'app.kubernetes.io/created-by': 'kwirth-tasklist' } },
    spec: {
        restartPolicy: 'Never',
        containers: [{ name: 'task', image }]
    }
})

// A Kubernetes object name: a DNS-1123 label (pods accept subdomains, but a label is what anybody types).
export const isValidName = (name: string): boolean => /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/.test(name)
