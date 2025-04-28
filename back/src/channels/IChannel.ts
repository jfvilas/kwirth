import { InstanceConfig, InstanceMessage, InstanceMessageActionEnum } from '@jfvilas/kwirth-common'
import WebSocket from 'ws'

enum SourceEnum {
    DOCKER = 'docker',
    KUBERNETES = 'kubernetes'
}

type ChannelData = {
    id: string
    pauseable: boolean
    modifyable: boolean
    reconnectable: boolean
    sources: SourceEnum[]
    metrics: boolean
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

    processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean>

    containsConnection (webSocket:WebSocket) : boolean
    removeConnection (webSocket:WebSocket) : void
    refreshConnection (webSocket:WebSocket) : boolean
    updateConnection (webSocket:WebSocket, instanceId:string) : boolean
}

export type { ChannelData }
export { SourceEnum, IChannel }
