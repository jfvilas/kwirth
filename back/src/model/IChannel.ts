import { ServiceConfig, ServiceConfigActionEnum } from '@jfvilas/kwirth-common'
import WebSocket from 'ws'

interface IChannel {
    startInstance (webSocket:WebSocket, serviceConfig:ServiceConfig, podNamespace:string, podName:string, containerName:string) : void
    stopInstance (webSocket:WebSocket, serviceConfig:ServiceConfig) : void
    removeService (webSocket:WebSocket) : void
    updateInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, eventType:string, podNamespace:string, podName:string, containerName:string) : void
    removeInstance (webSocket:WebSocket, instanceId:string) : void
    modifyService (webSocket: WebSocket, serviceConfig: ServiceConfig) : void
    processModifyServiceConfig (webSocket: WebSocket, serviceConfig: ServiceConfig) : void
    pauseContinueChannel (webSocket: WebSocket, serviceConfig: ServiceConfig, action:ServiceConfigActionEnum) : void
    getServiceScopeLevel(scope:string) : number
}

export { IChannel }