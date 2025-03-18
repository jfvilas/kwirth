import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { Metrics } from "../tools/MetricsTools";

export interface NodeInfo {
    name:string
    ip:string
    kubernetesNode: V1Node
    containerMetricValues: Map<string,number>
    prevContainerMetricValues: Map<string,number>
    podMetricValues: Map<string,number>
    prevPodMetricValues: Map<string,number>
    machineMetricValues: Map<string,number>
    prevMachineMetricValues: Map<string,number>
    timestamp: number
}

export class ClusterInfo {
    public nodes: Map<string, NodeInfo> = new Map()
    public coreApi!: CoreV1Api
    public appsApi!: AppsV1Api
    public logApi!: Log
    public token: string = ''
    public metrics!: Metrics;
    public interval: number = 60
    public intervalRef: number = -1

    stopInterval = () => clearTimeout(this.intervalRef)

    startInterval = (seconds: number) => { 
        this.interval = seconds
        this.intervalRef = setInterval(() => { 
            this.metrics.readClusterMetrics(this) 
        }, this.interval * 1000, {})
    }
}
