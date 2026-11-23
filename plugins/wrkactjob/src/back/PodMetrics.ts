import { IMetricsCluster } from './MetricsProviderTypes'

const CPU = 'container_cpu_usage_seconds_total'
const MEMORY = 'container_memory_working_set_bytes'

export interface IJobUsage {
    cpu?: number           // % of the cluster's CPU over the last interval; undefined until there are two readings
    cpuSeconds?: number    // the CPU counter of its containers now: seconds used since they started
    memory?: number        // working set, bytes
}

export interface IUsage {
    jobs: Map<string, IJobUsage>   // keyed 'namespace/pod'
    clusterCpu?: number            // every job together, % of the cluster
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
    Usage per job out of the provider's last two readings, as SDSF and the metrics plugin compute it: CPU is a
    counter, so its % is the delta over the interval divided by every CPU second the cluster had in it — the
    CPU % of WRKACTJOB, a share of the whole system. The counter itself is the CPU the job has used (the CPU
    column of the second view). Memory is a gauge and needs one reading only.

    A pod that restarted between readings has a counter that went backwards: no % for it this time rather than
    a negative one.
*/
export const usageOf = (readings: IMetricsCluster[]): IUsage => {
    const jobs = new Map<string, IJobUsage>()
    const last = readings[readings.length - 1]
    if (!last) return { jobs }
    const prev = readings.length > 1 ? readings[readings.length - 2] : undefined

    const now = sumByPod(last, CPU)
    for (const [pod, memory] of sumByPod(last, MEMORY)) jobs.set(pod, { memory })
    for (const [pod, cpuSeconds] of now) jobs.set(pod, { ...jobs.get(pod), cpuSeconds })

    const cpuSecondsOfCluster = last.metricsInterval * last.cluster.vcpus
    if (!prev || !(cpuSecondsOfCluster > 0)) return { jobs }
    const before = sumByPod(prev, CPU)
    let clusterCpu = 0
    for (const [pod, value] of now) {
        const old = before.get(pod)
        if (old === undefined || value < old) continue
        const cpu = Math.round((value - old) / cpuSecondsOfCluster * 100 * 100) / 100
        clusterCpu += cpu
        jobs.set(pod, { ...jobs.get(pod), cpu })
    }
    return { jobs, clusterCpu: Math.round(clusterCpu * 100) / 100 }
}
