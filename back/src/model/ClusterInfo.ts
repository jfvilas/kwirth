import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { MetricsTools } from "../tools/Metrics";
import { ClusterTypeEnum } from "@jfvilas/kwirth-common";
import Docker from 'dockerode'
import { DockerTools } from "../tools/KwirthApi";

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
    public dockerTools!: DockerTools
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
    public type: ClusterTypeEnum = ClusterTypeEnum.KUBERNETES
    public flavour: string ='unknown'

    stopInterval = () => clearTimeout(this.metricsIntervalRef)

    startInterval = (seconds: number) => {
        this.metricsInterval = seconds
        this.metricsIntervalRef = setInterval(() => {
            this.metrics.readClusterMetrics(this) 
        }, this.metricsInterval * 1000, {})
    }

    loadKubernetesClusterName = async() => {
        if (this.name !== '') return
        var resp = await this.coreApi.listNode()
        if (!resp.body.items || resp.body.items.length===0) return 'unnamed'

        let node = resp.body.items[0]
        if (node.metadata?.labels && node.metadata?.labels['kubernetes.azure.com/cluster']) {
            this.flavour = 'aks'
            this.name = node.metadata?.labels['kubernetes.azure.com/cluster']
        }
        if (node.metadata?.annotations && node.metadata?.annotations['k3s.io/hostname']) {
            let hostname = node.metadata?.annotations['k3s.io/hostname'].toLocaleLowerCase()
            this.flavour = hostname.startsWith('k3d') ? 'k3d' : 'k3s'

            let i = hostname.indexOf('-agent-')
            if (i>=0) 
                this.name = hostname.substring(0,i)
            else {
                i = hostname.indexOf('-server-')
                if (i>=0) this.name = hostname.substring(0,i)
            }
        }
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
