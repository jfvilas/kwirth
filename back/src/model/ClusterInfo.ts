import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { MetricsTools } from "../tools/MetricsTools";
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
    public name: string = ''
    public nodes: Map<string, NodeInfo> = new Map()
    public dockerApi!: Docker
    public coreApi!: CoreV1Api
    public appsApi!: AppsV1Api
    public logApi!: Log
    public token: string = ''
    public metrics!: MetricsTools;
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

    loadName = async() => {
        if (this.name !== '') return
        var resp = await this.coreApi.listNode()
        if (!resp.body.items || resp.body.items.length===0) return 'unnamed'

        let node = resp.body.items[0]
        if (node.metadata?.labels && node.metadata?.labels['kubernetes.azure.com/cluster']) {
            this.name = node.metadata?.labels['kubernetes.azure.com/cluster']
        }
    }

    loadMetricsInfo = async () => {
        console.log('Metrics information for cluster is being loaded asynchronously')
        await this.metrics.loadClusterMetrics(Array.from(this.nodes.values()))
        this.vcpus = 0
        this.memory = 0
        for (let node of this.nodes.values()) {
            await this.metrics.readNodeMetrics(node)
            this.vcpus += node.machineMetricValues.get('machine_cpu_cores')?.value!
            this.memory += node.machineMetricValues.get('machine_memory_bytes')?.value!
        }
        console.log('clusterInfo.memory', this.memory)
        console.log('clusterInfo.vcpus', this.vcpus)
        this.startInterval(this.metricsInterval)
    }

    loadNodes = async () => {
        // load nodes
        var resp = await this.coreApi.listNode()
        var nodes:Map<string, NodeInfo> = new Map()
        for (var node of resp.body.items) {
            var nodeData:NodeInfo = {
                name: node.metadata?.name!,
                ip: node.status?.addresses!.find(a => a.type === 'InternalIP')?.address!,
                kubernetesNode: node,
                containerMetricValues: new Map(),
                prevContainerMetricValues: new Map(),
                machineMetricValues: new Map(),
                timestamp: 0,
                podMetricValues: new Map(),
                prevPodMetricValues: new Map(),
                prevMachineMetricValues: new Map()
            }
            nodes.set(nodeData.name, nodeData)
            // +++ we need to check node status (only availables should be used)
        }
        return nodes
    }

}
