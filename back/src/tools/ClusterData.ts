import { CoreV1Api } from "@kubernetes/client-node";

export class ClusterData {
    public static nodes : Map<string,string> = new Map()
    coreApi:CoreV1Api;

    constructor (coreApi: CoreV1Api) {
        this.coreApi=coreApi;
    }

    public init = async () => {
        var resp = await this.coreApi.listNode()
        for (var element of resp.body.items) {
            var internalIp = element.status?.addresses!.find(a => a.type==='InternalIP')
            if (internalIp) ClusterData.nodes.set(element.metadata?.name!,internalIp.address)
        }
        console.log('Node config loaded',ClusterData.nodes);
    }
}