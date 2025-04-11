import { InstanceConfig, ResourceIdentifier } from "@jfvilas/kwirth-common"
import { V1Pod } from "@kubernetes/client-node"

export interface ISource {
    watchSourcePods(apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig): void
    getAllPods(): V1Pod[]
    getAllowedNamespaces(accessKeyResources:ResourceIdentifier[]):string[]
    getAllowedPodNames(validNamespaces:string[]):string[]
    getValidNamespaces(requestedNamespaces:string[], allowedNamespaces:string[]):string[]
    getValidPodNames(validNamespaces:string[]):string[]
}
