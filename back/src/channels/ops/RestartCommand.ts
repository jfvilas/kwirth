import { InstanceMessageFlowEnum, InstanceMessageTypeEnum, OpsCommandEnum, OpsMessage, OpsMessageResponse } from "@jfvilas/kwirth-common"
import { ClusterInfo } from "../../model/ClusterInfo"
import { IInstance } from "./OpsChannel"

export async function restartPod(clusterInfo: ClusterInfo, podNamespace:string, podName:string) {
    try {
        await clusterInfo.coreApi.deleteNamespacedPod(podName, podNamespace)
        return `Pod ${podNamespace}/${podName} restarted`
    }
    catch (err) {
        return `Error restarting pod ${podNamespace}/${podName}: ${err}`
    }
}

export async function execCommandRestart(clusterInfo: ClusterInfo, instance:IInstance, opsMessage:OpsMessage): Promise<OpsMessageResponse> {
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

    switch(opsMessage.command) {
        case OpsCommandEnum.RESTARTPOD:
            if (opsMessage.namespace==='' || opsMessage.pod==='' || !opsMessage.namespace || !opsMessage.pod) {
                execResponse.data = `Namespace and pod must be specified (format 'ns/pod')`
                return execResponse
            }
            if (instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod)) {
                execResponse.data = await restartPod(clusterInfo, opsMessage.namespace, opsMessage.pod)
                execResponse.type = InstanceMessageTypeEnum.DATA
            }
            else {
                execResponse.data = `Cannot find pod '${opsMessage.namespace}/${opsMessage.pod}'`
                return execResponse
            }
            break

        case OpsCommandEnum.RESTARTNS:
            if (opsMessage.namespace==='' || !opsMessage.namespace) {
                execResponse.data = `Namespace must be specified`
                return execResponse
            }
            execResponse.data = ''
            for (let asset of instance.assets) {
                if (asset.podNamespace === opsMessage.namespace) {
                    try {
                        execResponse.data += restartPod(clusterInfo, asset.podNamespace, asset.podName) + '\n'
                    }
                    catch (err) {
                        execResponse.data += `Error restarting pod ${asset.podNamespace}/${asset.podName}: ${err}\n`
                    }                
                }    
            }
            execResponse.type = InstanceMessageTypeEnum.DATA
            break                
            
        default:
            execResponse.data = `Invalid command '${opsMessage.command}`
            break
    }
    return execResponse
}

