import { IMetricsCluster } from './MetricsProviderTypes'

export const CPU = 'container_cpu_usage_seconds_total'
export const MEMORY = 'container_memory_working_set_bytes'
export const READ = 'container_fs_reads_bytes_total'
export const WRITE = 'container_fs_writes_bytes_total'

// One container's figures. The pod's are its containers' added up.
export interface IContainerUsage {
    cpu?: number           // % of the cluster's CPU over the last interval; undefined until there are two readings
    cpuSeconds?: number    // the CPU counter: seconds used since the container started
    memory?: number        // working set, bytes
    ioRead?: number        // bytes, counter
    ioWrite?: number
}

export interface INodeUsage {
    cpu?: number               // % of the node's own CPU
    memory?: number            // bytes
    rxBytesPerSecond?: number
    txBytesPerSecond?: number
}

export interface IUsage {
    containers: Map<string, IContainerUsage>   // keyed 'namespace/pod/container'
    nodes: Map<string, INodeUsage>             // keyed by node name
    cluster?: { cpu: number; memory: number; interval: number }
}

// Every value of a metric in a reading, by 'namespace/pod/container'. Neither a namespace, a pod nor a container
// name can carry a '/', so the first three segments of the key are the container.
const byContainer = (reading: IMetricsCluster, metric: string): Map<string, number> => {
    const result = new Map<string, number>()
    const suffix = '/' + metric
    for (const node of reading.nodes) {
        for (const [key, v] of node.containerMetricValues) {
            if (!key.endsWith(suffix)) continue
            const parts = key.split('/')
            if (parts.length < 4) continue
            const container = parts.slice(0, 3).join('/')
            result.set(container, (result.get(container) ?? 0) + v.value)
        }
    }
    return result
}

const round2 = (n: number): number => Math.round(n * 100) / 100

/*
    Usage out of the provider's last two readings, as SDSF and WRKACTJOB compute it: CPU is a counter, so its %
    is the delta over the interval divided by every CPU second the cluster had in it — the CPU column of XP, a
    share of the whole machine. Memory is a gauge and needs one reading only. A container that restarted
    between readings has a counter that went backwards: no % for it this time rather than a negative one.

    A node's figures come from the kubelet's summary: its CPU in nano-cores now (over its capacity, which the
    caller knows), and its network counters, whose delta over the time that really passed between the two
    readings is the rate.
*/
export const usageOf = (readings: IMetricsCluster[]): IUsage => {
    const containers = new Map<string, IContainerUsage>()
    const nodes = new Map<string, INodeUsage>()
    const last = readings[readings.length - 1]
    if (!last) return { containers, nodes }
    const prev = readings.length > 1 ? readings[readings.length - 2] : undefined

    const set = (key: string, patch: IContainerUsage) => containers.set(key, { ...containers.get(key), ...patch })
    const cpuNow = byContainer(last, CPU)
    for (const [key, memory] of byContainer(last, MEMORY)) set(key, { memory })
    for (const [key, ioRead] of byContainer(last, READ)) set(key, { ioRead })
    for (const [key, ioWrite] of byContainer(last, WRITE)) set(key, { ioWrite })
    for (const [key, cpuSeconds] of cpuNow) set(key, { cpuSeconds })

    for (const node of last.nodes) {
        const usage: INodeUsage = {}
        if (node.summary?.memory) usage.memory = node.summary.memory.workingSetBytes
        if (node.summary?.cpu) usage.cpu = node.summary.cpu.usageNanoCores / 1e9   // cores, turned into % by the caller
        const before = prev?.nodes.find(n => n.name === node.name)
        const seconds = before ? (node.timestamp - before.timestamp) / 1000 : 0
        const now = node.summary?.network
        const then = before?.summary?.network
        // 0 is "the kubelet did not give it", not a reading (the provider's own rule)
        if (seconds > 0 && now && then && now.rxBytes > 0 && then.rxBytes > 0 && now.rxBytes >= then.rxBytes && now.txBytes >= then.txBytes) {
            usage.rxBytesPerSecond = (now.rxBytes - then.rxBytes) / seconds
            usage.txBytesPerSecond = (now.txBytes - then.txBytes) / seconds
        }
        nodes.set(node.name, usage)
    }

    const cpuSecondsOfCluster = last.metricsInterval * last.cluster.vcpus
    if (!prev || !(cpuSecondsOfCluster > 0)) return { containers, nodes }
    const cpuBefore = byContainer(prev, CPU)
    for (const [key, value] of cpuNow) {
        const old = cpuBefore.get(key)
        if (old === undefined || value < old) continue
        set(key, { cpu: round2((value - old) / cpuSecondsOfCluster * 100) })
    }
    let memory = 0
    for (const node of nodes.values()) memory += node.memory ?? 0
    return { containers, nodes, cluster: { cpu: round2(last.cluster.cpuUsage), memory, interval: last.metricsInterval } }
}
