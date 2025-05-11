import { InstanceMessageFlowEnum, InstanceMessageTypeEnum, OpsCommandEnum, OpsMessage, OpsMessageResponse } from "@jfvilas/kwirth-common"
import { ClusterInfo } from "../../model/ClusterInfo"
import { IInstance } from "./OpsChannel"

export async function execCommandGetDescribe(clusterInfo: ClusterInfo, instance:IInstance, opsMessage:OpsMessage): Promise<OpsMessageResponse> {
    let execResponse: OpsMessageResponse = {
        action: opsMessage.action,
        flow: InstanceMessageFlowEnum.RESPONSE,
        type: InstanceMessageTypeEnum.SIGNAL,
        channel: opsMessage.channel,
        instance: opsMessage.instance,
        command: opsMessage.command,
        id: opsMessage.id,
        namespace: opsMessage.namespace,
        group: opsMessage.group,
        pod: opsMessage.pod,
        container: opsMessage.container,
        msgtype: 'opsmessageresponse'
    }
    
    if (opsMessage.namespace==='' || !opsMessage.namespace) {
        execResponse.data = `Namespace, pod and container must be specified (formats 'ns', 'ns/pod' or 'ns/pod/container')`
        return execResponse
    }

    try {
        if ((opsMessage.pod==='' || !opsMessage.pod) && (opsMessage.container==='' || !opsMessage.container)) {
            let nsresp = await clusterInfo.coreApi.readNamespace(opsMessage.namespace)
            if (opsMessage.command === OpsCommandEnum.GET)
                execResponse.data = { name:nsresp.body.metadata?.name, creationTimestamp: nsresp.body.metadata?.creationTimestamp }
            else 
                execResponse.data = nsresp.body
            execResponse.type = InstanceMessageTypeEnum.DATA
            return execResponse
        }

        let presp = await clusterInfo.coreApi.readNamespacedPod(opsMessage.pod,opsMessage.namespace)
        if (opsMessage.container==='' || !opsMessage.container) {
            console.log(presp.body)
            if (opsMessage.command === OpsCommandEnum.GET)
                execResponse.data = { name:presp.body.metadata?.name, creationTimestamp: presp.body.metadata?.creationTimestamp, containers: presp.body.spec?.containers.map(c => c.name) }
            else
                execResponse.data = presp.body
            execResponse.type = InstanceMessageTypeEnum.DATA
        }
        else {
            let cont = presp.body.spec?.containers.find(c => c.name === opsMessage.container)
            if (cont) {
                if (opsMessage.command === OpsCommandEnum.GET)
                    execResponse.data =  JSON.stringify({ name: cont.name, image: cont.image }, null, 2)
                else {
                    execResponse.data = JSON.stringify(cont,null,2)
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
            }
            else {
                execResponse.data = 'Container not found'
            }
        }
        return execResponse
    }
    catch (err) {
        console.log(err)
        execResponse.data = 'Cannot read data'
    }
    return execResponse
}