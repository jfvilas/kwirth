import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { Metrics } from "../tools/MetricsTools";
import { ClusterTypeEnum } from "@jfvilas/kwirth-common";
import Docker from 'dockerode'

export interface NodeInfo {
    name:string
    ip:string
    kubernetesNode: V1Node
    containerMetricValues: Map<string,{value: number, timestamp:number}>
    prevContainerMetricValues: Map<string,{value: number, timestamp:number}>
    podMetricValues: Map<string,{value: number, timestamp:number}>
    prevPodMetricValues: Map<string,{value: number, timestamp:number}>
    machineMetricValues: Map<string,{value: number, timestamp:number}>
    prevMachineMetricValues: Map<string,{value: number, timestamp:number}>
    timestamp: number
}

export class ClusterInfo {
    public nodes: Map<string, NodeInfo> = new Map()
    public dockerApi!: Docker
    public coreApi!: CoreV1Api
    public appsApi!: AppsV1Api
    public logApi!: Log
    public token: string = ''
    public metrics!: Metrics;
    public metricsInterval: number = 60
    public metricsIntervalRef: number = -1
    public vcpus: number = 0
    public memory: number = 0
    public clusterType: ClusterTypeEnum = ClusterTypeEnum.KUBERNETES

    stopInterval = () => clearTimeout(this.metricsIntervalRef)

    startInterval = (seconds: number) => { 
        this.metricsInterval = seconds
        this.metricsIntervalRef = setInterval(() => { 
            this.metrics.readClusterMetrics(this) 
        }, this.metricsInterval * 1000, {})
    }
}
