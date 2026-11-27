/*
    The part of the core 'metrics' provider's model the Task Manager reads (providers/metrics/src/common/MetricsTypes.ts).
    A plugin cannot import from a provider, so it keeps a copy of just what it uses — as the metrics plugin, SDSF
    and WRKACTJOB do.
*/

export interface IMetricsValue {
    value: number
    timestamp: number
}

export interface IMetricsClusterUsage {
    vcpus: number
    memory: number
    cpuUsage: number           // % of the cluster
    memoryUsage: number        // % of the cluster
}

// The kubelet's summary of a node: only the figures the Performance and Networking tabs use.
export interface IMetricsNodeSummary {
    cpu?: { usageNanoCores: number }
    memory?: { workingSetBytes: number }
    // the node's DEFAULT interface (the provider resolves it since its 0.1.4): counters since boot
    network?: { rxBytes: number; txBytes: number }
}

export interface IMetricsNode {
    name: string
    timestamp: number
    summary?: IMetricsNodeSummary
    // keyed 'namespace/pod/container/metric'
    containerMetricValues: Map<string, IMetricsValue>
}

export interface IMetricsCluster {
    metricsInterval: number
    cluster: IMetricsClusterUsage
    nodes: IMetricsNode[]
}
