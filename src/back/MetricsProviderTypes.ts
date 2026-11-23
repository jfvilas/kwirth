/*
    The part of the core 'metrics' provider's model WRKACTJOB reads (back/src/providers/metrics/IMetricsModel.ts
    in the core). A plugin cannot import from the core, so it keeps a copy of just what it uses — the same copy
    the metrics plugin and SDSF keep.
*/

export interface IMetricsValue {
    value: number
    timestamp: number
}

export interface IMetricsClusterUsage {
    vcpus: number
    memory: number
}

export interface IMetricsNode {
    name: string
    timestamp: number
    podMetricValues: Map<string, IMetricsValue>
    // keyed 'namespace/pod/container/metric'
    containerMetricValues: Map<string, IMetricsValue>
}

export interface IMetricsCluster {
    metricsInterval: number
    cluster: IMetricsClusterUsage
    nodes: IMetricsNode[]
    clusterMetricValues: Map<string, IMetricsValue>
}
