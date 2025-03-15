import { AppsV1Api, CoreV1Api, Log, V1Node } from "@kubernetes/client-node";
import { Metrics } from "./MetricsTools";

// export interface NodeData {
//     name:string
//     ip:string
//     kubernetesNode: V1Node
//     metricValues: Map<string,number>
//     prevValues: Map<string,number>
//     machineMetrics: Map<string,number>
//     timestamp: number
// }

// export class ClusterData {
//     // public static xclusterMetricsInterval = 60
//     // public static xclusterMetricsTimeout : NodeJS.Timeout
//     // public static xnodes : Map<string,NodeData> = new Map()
//     // public static xmetrics : Metrics
//     // public static coreApi:CoreV1Api
//     // public static xsaToken:string

//     // constructor (coreApi: CoreV1Api, saToken:string) {
//     //     this.coreApi=coreApi;
//     //     this.saToken=saToken
//     // }

//     // public init = async () => {
//     //     // load nodes
//     //     var resp = await this.coreApi.listNode()
//     //     for (var node of resp.body.items) {
//     //         var nodeData:NodeData = {
//     //             name: node.metadata?.name!,
//     //             ip: node.status?.addresses!.find(a => a.type === 'InternalIP')?.address!,
//     //             kubernetesNode: node,
//     //             metricValues: new Map(),
//     //             prevValues: new Map(),
//     //             machineMetrics: new Map(),
//     //             timestamp: 0
//     //         }
//     //         ClusterData.nodes.set(nodeData.name, nodeData)
//     //         console.log('Found node', nodeData.name)
//     //     }
//     //     console.log('Node config loaded')

//     //     // load metrics avaliable
//     //     ClusterData.metrics = new Metrics(this.saToken!)
//     //     await ClusterData.metrics.loadMetrics(Array.from(ClusterData.nodes.values()))
//     //     console.log('ClusterData.metrics.getMetricsList()')
//     //     console.log(ClusterData.metrics.getMetricsList())
//     //     await ClusterData.metrics.readClusterMetrics()
//     //     ClusterData.startInterval(ClusterData.clusterMetricsInterval)
//     // }

//     // public static init = async () => {
//     //     // load nodes
//     //     var resp = await ClusterData.coreApi.listNode()
//     //     for (var node of resp.body.items) {
//     //         var nodeData:NodeData = {
//     //             name: node.metadata?.name!,
//     //             ip: node.status?.addresses!.find(a => a.type === 'InternalIP')?.address!,
//     //             kubernetesNode: node,
//     //             metricValues: new Map(),
//     //             prevValues: new Map(),
//     //             machineMetrics: new Map(),
//     //             timestamp: 0
//     //         }
//     //         ClusterData.nodes.set(nodeData.name, nodeData)
//     //         console.log('Found node', nodeData.name)
//     //     }
//     //     console.log('Node config loaded')

//     //     // load metrics avaliable
//     //     // ClusterData.metrics = new Metrics(ClusterData.saToken!)
//     //     // await ClusterData.metrics.loadMetrics(Array.from(ClusterData.nodes.values()))
//     //     // await ClusterData.metrics.readClusterMetrics()
//     //     // ClusterData.startInterval(ClusterData.clusterMetricsInterval)
//     // }

//     // static startInterval = (seconds:number) => {
//     //     ClusterData.clusterMetricsInterval = seconds
//     //     ClusterData.clusterMetricsTimeout = setInterval( () => {
//     //         ClusterData.metrics.readClusterMetrics()
//     //     }, ClusterData.clusterMetricsInterval * 1000)
//     //     console.log('ClusterMetricsInterval changed to',seconds)
//     // }
// }