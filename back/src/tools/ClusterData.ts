import { CoreV1Api, V1Node } from "@kubernetes/client-node";
import { Metrics } from "./Metrics";

export class ClusterData {
    public static nodes : Map<string,V1Node> = new Map()
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
            ClusterData.nodes.set(node.metadata?.name!,node)
            console.log('Found node', node.metadata?.name)
        }
        console.log('Node config loaded')

        // load metrics
        ClusterData.metrics = new Metrics(this.coreApi, this.saToken!)
        var nodeIp=Array.from(ClusterData.nodes.values())[0].status?.addresses!.find(a => a.type==='InternalIP')?.address
        ClusterData.metrics.loadMetrics(nodeIp!)
    }
}