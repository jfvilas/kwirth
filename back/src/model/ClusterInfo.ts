import { ApiextensionsV1Api, AppsV1Api, CoreV1Api, CustomObjectsApi, Exec, KubeConfig, Log, RbacAuthorizationV1Api, V1Node } from "@kubernetes/client-node";
import { MetricsTools } from "../tools/Metrics";
import { ClusterTypeEnum } from "@jfvilas/kwirth-common";
import Docker from 'dockerode'
import { DockerTools } from "../tools/KwirthApi";
import { NodeMetrics } from "./MetricsNode";

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
    prevSummary: NodeMetrics|undefined
    summary: NodeMetrics|undefined
    timestamp: number
}

export class ClusterInfo {
    public name: string = ''
    public nodes: Map<string, NodeInfo> = new Map()
    public dockerTools!: DockerTools
    public dockerApi!: Docker
    public kubeConfig!: KubeConfig
    public coreApi!: CoreV1Api
    public appsApi!: AppsV1Api
    public execApi!: Exec
    public logApi!: Log
    public crdApi!: CustomObjectsApi
    public rbacApi!: RbacAuthorizationV1Api
    public extensionApi!: ApiextensionsV1Api
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
            let rg = node.metadata?.labels['kubernetes.azure.com/network-resourcegroup']
            if (this.name.startsWith(rg+'_')) this.name = this.name.substring(rg.length+1)            
        }
        else if (node.metadata?.labels && node.metadata?.labels['k8s.io/cloud-provider-aws']) {
            this.flavour = 'eks'
            if (node.metadata?.annotations) {
                let lastAppliedConfig = node.metadata?.annotations['kubectl.kubernetes.io/last-applied-configuration']
                if (lastAppliedConfig) {
                    let config = JSON.parse(lastAppliedConfig)
                    if (config) {
                        let spec = config['spec']
                        if (spec) {
                            let tags = spec['tags']
                            this.name = tags['karpenter.sh/discovery']
                        }
                    }
                }
            }
        }
        else if (node.metadata?.annotations && node.metadata?.annotations['k3s.io/hostname']) {
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
            if (node.spec?.unschedulable) {
                console.log(`WARNING: Node ${node.metadata?.name} is unschedulable`)
            }
            else {
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
                    prevMachineMetricValues: new Map(),
                    prevSummary: undefined,
                    summary: undefined
                }
                nodes.set(nodeData.name, nodeData)
            }
        }
        return nodes
    }

}
