import { InstanceConfig, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, IEchoConfig, IEchoMessageResponse } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel';

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
    interval: NodeJS.Timeout
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    configData: IEchoConfig
    paused: boolean
    assets: IAsset[]
}

class EchoChannel implements IChannel {
    clusterInfo : ClusterInfo
    webSocketEcho: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData = (): BackChannelData => {
        return {
            id: 'echo',
            routable: false,
            pauseable: true,
            modifyable: false,
            reconnectable: true,
            metrics: false,
            sources: [ ClusterTypeEnum.KUBERNETES, ClusterTypeEnum.DOCKER ]
        }
    }

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'echo', 'cluster'].indexOf(scope)
    }

    containsInstance = (instanceId: string): boolean => {
        return this.webSocketEcho.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    processCommand = async (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> => {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            return false
        }
        else {
            let socket = this.webSocketEcho.find(s => s.ws === webSocket)
            if (!socket) {
                console.log('Socket not found')
                return false
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceMessage.instance)
            if (!instance) {
                this.sendSignalMessage(webSocket, instanceMessage.action, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceMessage.instance, `Instance not found`)
                console.log(`Instance ${instanceMessage.instance} not found`)
                return false
            }
            return true
        }
    }

    startInstance = async (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> => {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSocketEcho.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSocketEcho.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSocketEcho[len-1]
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (!instance) {
            instance = {
                accessKey: accessKeyDeserialize(instanceConfig.accessKey),
                instanceId: instanceConfig.instance,
                configData: instanceConfig.data,
                paused: false,
                assets: []
            }
            instances.push(instance)
        }
        let asset:IAsset = {
            podNamespace,
            podName,
            containerName,
            interval: setInterval(() => this.sendData(webSocket, instance, asset), instance.configData.interval*1000)
        }
        instance.assets.push(asset)
    }

    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void => {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) instance.paused = true
            if (action === InstanceMessageActionEnum.CONTINUE) instance.paused = false
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Echo instance not found`)
        }
    }

    modifyInstance = (webSocket:WebSocket, instanceConfig: InstanceConfig): void => {
        console.log('Modify not supported')
    }

    stopInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig): void => {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Echo instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Echo instance not found`)
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        let socket = this.webSocketEcho.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
                        clearTimeout(asset.interval)
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no Echo Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on Echo')
        }
    }

    containsConnection = (webSocket:WebSocket): boolean => {
        return Boolean (this.webSocketEcho.find(s => s.ws === webSocket))
    }

    removeConnection = (webSocket: WebSocket): void => {
        let socket = this.webSocketEcho.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSocketEcho.findIndex(s => s.ws === webSocket)
            this.webSocketEcho.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on Echo for remove')
        }
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        let socket = this.webSocketEcho.find(s => s.ws === webSocket)
        if (socket) {
            socket.lastRefresh = Date.now()
            return true
        }
        else {
            console.log('WebSocket not found')
            return false
        }
    }

    updateConnection = (newWebSocket: WebSocket, instanceId: string): boolean => {
        for (let entry of this.webSocketEcho) {
            let exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (let instance of entry.instances) {
                    for (let asset of instance.assets) {
                        clearInterval(asset.interval)
                        asset.interval = setInterval(() => this.sendData(newWebSocket, instance, asset), instance.configData.interval*1000)
                    }
                }
                return true
            }
        }
        return false
    }

    // ************************* private methods *************************

    private sendData = (ws:WebSocket, instance:IInstance, asset:IAsset) => {
        if (instance.paused) return
        let msg:IEchoMessageResponse = {
            msgtype: 'echomessageresponse',
            channel: 'echo',
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            type: InstanceMessageTypeEnum.DATA,
            instance: instance.instanceId,
            text: `${new Date()} ${asset.podNamespace}/${asset.podName}/${asset.containerName}`
        }
        ws.send(JSON.stringify(msg))
    }

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:SignalMessage = {
            action,
            flow,
            channel: 'echo',
            instance: instanceId,
            type: InstanceMessageTypeEnum.SIGNAL,
            text,
            level
        }
        ws.send(JSON.stringify(resp))
    }

    getInstance(webSocket:WebSocket, instanceId: string) : IInstance | undefined{
        let socket = this.webSocketEcho.find(entry => entry.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                if (instanceIndex>=0) return instances[instanceIndex]
                console.log('Instance not found')
            }
            else {
                console.log('There are no Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found')
        }
        return undefined
    }

}

export { EchoChannel }