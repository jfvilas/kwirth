import { InstanceMessageFlowEnum, InstanceMessageTypeEnum, OpsCommandEnum, IOpsMessage, IOpsMessageResponse } from "@jfvilas/kwirth-common"
import { ClusterInfo } from "../../model/ClusterInfo"
import { IInstance } from "./OpsChannel"

export async function execCommandDelete(clusterInfo: ClusterInfo, instance:IInstance, opsMessage:IOpsMessage): Promise<IOpsMessageResponse> {
    let execResponse: IOpsMessageResponse = {
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

    switch(opsMessage.command) {
        case OpsCommandEnum.DELETE:
            if (opsMessage.namespace==='' || opsMessage.pod==='' || !opsMessage.namespace || !opsMessage.pod) {
                execResponse.data = `Namespace and pod must be specified (format 'ns/pod')`
                return execResponse
            }
            if (instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod)) {
                try {
                    await clusterInfo.coreApi.deleteNamespacedPod(opsMessage.pod, opsMessage.namespace)
                    execResponse.data = `Successfully deleted ${opsMessage.pod}/${opsMessage.namespace}`
                    execResponse.type = InstanceMessageTypeEnum.DATA
                }
                catch (err) {
                    execResponse.data = `Error deleting ${opsMessage.pod}/${opsMessage.namespace}`
                }
            }
            break
        default:
            execResponse.data = `Invalid command '${opsMessage.command}`
            break
    }
    return execResponse
}

