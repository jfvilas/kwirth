import { CoreV1Api, V1Node } from "@kubernetes/client-node";

export class ClusterData {
    public static nodes : Map<string,V1Node> = new Map()
    coreApi:CoreV1Api;

    constructor (coreApi: CoreV1Api) {
        this.coreApi=coreApi;
    }

    public init = async () => {
        var resp = await this.coreApi.listNode()
        for (var node of resp.body.items) {
            ClusterData.nodes.set(node.metadata?.name!,node)
            console.log(node)
        }
        console.log('Node config loaded',ClusterData.nodes);
    }
}