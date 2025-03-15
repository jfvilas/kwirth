import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { Metrics } from "../tools/MetricsTools";

export interface NodeInfo {
    name:string
    ip:string
    kubernetesNode: V1Node
    metricValues: Map<string,number>
    prevValues: Map<string,number>
    machineMetrics: Map<string,number>
    timestamp: number
}

export interface ClusterInfo {
    nodes: Map<string, NodeInfo>
    coreApi: CoreV1Api
    appsApi: AppsV1Api
    logApi: Log
    token: string
    metrics: Metrics
    metricsInterval: number
}
