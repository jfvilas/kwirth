import { InstanceConfig, InstanceMessage, InstanceMessageActionEnum, RouteMessageResponse } from '@jfvilas/kwirth-common'

enum SourceEnum {
    DOCKER = 'docker',
    KUBERNETES = 'kubernetes'
}

type ChannelData = {
    id: string
    routable: boolean  // instance can receive routed commands
    pauseable: boolean  // instance can be paused
    modifyable: boolean  // instance can be modified
    reconnectable: boolean  // instance supports client reconnect requests
    sources: SourceEnum[]  // array of sources (kubernetes, docker...)
    metrics: boolean  // this channel requires metrics
}

interface IChannel {
    getChannelData() : ChannelData
    getChannelScopeLevel(scope:string) : number
    
    startInstance (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) : void
    pauseContinueInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, action:InstanceMessageActionEnum) : void
    modifyInstance (webSocket: WebSocket, instanceConfig: InstanceConfig) : void
    containsInstance (instanceId:string) : boolean
    stopInstance (webSocket:WebSocket, instanceConfig:InstanceConfig) : void
    removeInstance (webSocket:WebSocket, instanceId:string) : void

    processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage, podNamespace?:string, podName?:string, containerName?:string) : Promise<boolean>

    containsConnection (webSocket:WebSocket) : boolean
    removeConnection (webSocket:WebSocket) : void
    refreshConnection (webSocket:WebSocket) : boolean
    updateConnection (webSocket:WebSocket, instanceId:string) : boolean
}

export type { ChannelData }
export { SourceEnum, IChannel }
