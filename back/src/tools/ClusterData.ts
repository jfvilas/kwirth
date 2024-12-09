import { CoreV1Api, V1Node } from "@kubernetes/client-node";
import { Metrics } from "./Metrics";

export interface NodeData {
    name:string
    ip:string
    kubernetesNode: V1Node
    metricValues:Map<string,number>
    timestamp:number
}
export class ClusterData {
    public static clusterMetricsInterval = 60
    public static clusterMetricsTimeout : NodeJS.Timeout
    public static nodes : Map<string,NodeData> = new Map()
    public static metrics : Metrics
    coreApi:CoreV1Api
    saToken:string

    constructor (coreApi: CoreV1Api, saToken:string) {
        this.coreApi=coreApi;
        this.saToken=saToken
    }

    public init = async () => {
        // load nodes
        var resp = await this.coreApi.listNode()
        for (var node of resp.body.items) {
            var nodeData:NodeData = {
                name:node.metadata?.name!,
                ip:node.status?.addresses!.find(a => a.type==='InternalIP')?.address!,
                kubernetesNode: node,
                metricValues: new Map(),
                timestamp: 0
            }
            ClusterData.nodes.set(nodeData.name, nodeData)
            console.log('Found node', nodeData.name)
        }
        console.log('Node config loaded')

        // load metrics avaliable
        console.log('********* load metrics')
        ClusterData.metrics = new Metrics(this.coreApi, this.saToken!)
        ClusterData.metrics.loadMetrics(Array.from(ClusterData.nodes.values()))


        console.log('********* read metric values')
        ClusterData.metrics.readClusterMetrics()
        ClusterData.startInterval(ClusterData.clusterMetricsInterval)
    }

    static startInterval = (seconds:number) => {
        ClusterData.clusterMetricsInterval = seconds
        ClusterData.clusterMetricsTimeout = setInterval( () => {
            ClusterData.metrics.readClusterMetrics()
        }, ClusterData.clusterMetricsInterval * 1000)
        console.log('ClusterMetricsInterval changed to',seconds)
    }
}