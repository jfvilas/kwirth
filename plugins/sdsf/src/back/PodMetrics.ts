import { IMetricsCluster } from './MetricsProviderTypes'

const CPU = 'container_cpu_usage_seconds_total'
const MEMORY = 'container_memory_working_set_bytes'

export interface IPodUsage {
    cpu?: number       // % of the cluster's CPU over the last interval; undefined until there is a previous reading
    memory?: number    // working set, bytes
}

// A node's pods together: what the INIT panel shows. The CPU is in seconds over the interval, for the node's own %.
export interface INodeUsage {
    cpuSeconds?: number
    memory?: number
}

export interface IUsage {
    pods: Map<string, IPodUsage>   // keyed 'namespace/pod'
    nodes: Map<string, INodeUsage> // keyed by node name
    interval?: number              // seconds between the two readings the CPU comes from
    clusterCpu?: number
}

// Sums a metric over every container of each node of a reading.
const sumByNode = (reading: IMetricsCluster, metric: string): Map<string, number> => {
    const result = new Map<string, number>()
    const suffix = '/' + metric
    for (const node of reading.nodes) {
        let total = 0
        for (const [key, v] of node.containerMetricValues) if (key.endsWith(suffix)) total += v.value
        result.set(node.name, total)
    }
    return result
}

// Sums a metric per 'namespace/pod' over every node of a reading. Keys are 'ns/pod/container/metric', and
// neither a namespace nor a pod name can carry a '/', so the first two segments are the pod.
const sumByPod = (reading: IMetricsCluster, metric: string): Map<string, number> => {
    const result = new Map<string, number>()
    const suffix = '/' + metric
    for (const node of reading.nodes) {
        for (const [key, v] of node.containerMetricValues) {
            if (!key.endsWith(suffix)) continue
            const parts = key.split('/')
            if (parts.length < 4) continue
            const pod = parts[0] + '/' + parts[1]
            result.set(pod, (result.get(pod) ?? 0) + v.value)
        }
    }
    return result
}

/*
    Usage per pod out of the provider's last two readings, as the metrics plugin computes it: CPU is a
    counter, so its % is the delta over the interval divided by every CPU second the cluster had in it —
    exactly SDSF's CPU%, a share of the whole system. Memory is a gauge and needs one reading only.

    A pod that restarted between readings has a counter that went backwards: no figure for it this time
    rather than a negative one.
*/
export const usageOf = (readings: IMetricsCluster[]): IUsage => {
    const pods = new Map<string, IPodUsage>()
    const nodes = new Map<string, INodeUsage>()
    const last = readings[readings.length - 1]
    if (!last) return { pods, nodes }
    const prev = readings.length > 1 ? readings[readings.length - 2] : undefined

    for (const [pod, memory] of sumByPod(last, MEMORY)) pods.set(pod, { memory })
    for (const [node, memory] of sumByNode(last, MEMORY)) nodes.set(node, { memory })
    if (!prev) return { pods, nodes }

    /*
        A node's CPU is the sum of its containers' deltas, container by container: one that came, went or
        restarted between the readings (its counter is new or went back) is left out, not the whole node.
    */
    const suffix = '/' + CPU
    for (const node of last.nodes) {
        const before = prev.nodes.find(n => n.name === node.name)
        if (!before) continue
        let seconds: number | undefined
        for (const [key, v] of node.containerMetricValues) {
            if (!key.endsWith(suffix)) continue
            const old = before.containerMetricValues.get(key)?.value
            if (old === undefined || v.value < old) continue
            seconds = (seconds ?? 0) + v.value - old
        }
        if (seconds !== undefined) nodes.set(node.name, { ...nodes.get(node.name), cpuSeconds: seconds })
    }

    const cpuSeconds = last.metricsInterval * last.cluster.vcpus
    if (!(cpuSeconds > 0)) return { pods, nodes, interval: last.metricsInterval }
    const now = sumByPod(last, CPU)
    const before = sumByPod(prev, CPU)
    let clusterCpu = 0
    for (const [pod, value] of now) {
        const old = before.get(pod)
        if (old === undefined || value < old) continue
        const cpu = Math.round((value - old) / cpuSeconds * 100 * 100) / 100
        clusterCpu += cpu
        pods.set(pod, { ...pods.get(pod), cpu })
    }
    return { pods, nodes, interval: last.metricsInterval, clusterCpu: Math.round(clusterCpu * 100) / 100 }
}
