import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../model/ClusterInfo'
import { ChannelData, IChannel } from './IChannel';
import { OpsCommandEnum, OpsMessage, OpsMessageResponse } from '../model/OpsMessage';

interface IAsset {
    podNamespace:string,
    podName:string,
    containerName:string
}        

interface IInstance {
    instanceId:string
    assets: IAsset[]
    timestamps: boolean
    paused:boolean
}

class OpsChannel implements IChannel {
    
    clusterInfo : ClusterInfo
    websocketOps: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : boolean {
        console.log(instanceMessage)
        let command = instanceMessage as OpsMessage
        console.log(command)
        let response:OpsMessageResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.REQUEST,
            type: InstanceMessageTypeEnum.DATA,
            channel: '',
            instance: '',
            id: command.id,
            command: command.command,
            namespace: '',
            group: '',
            pod: '',
            container: ''
        }
        webSocket.send(JSON.stringify(response))
        return true
    }

    getChannelData(): ChannelData {
        return {
            id: 'ops',
            pauseable: false,
            modifyable: false,
            reconnectable: true
        }
    }

    containsInstance(instanceId: string): boolean {
        for (let socket of this.websocketOps) {
            let exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, channel: InstanceMessageChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
        var resp:InstanceConfigResponse = {
            action,
            flow,
            channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig): void {
        var signalMessage:SignalMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.RESPONSE,
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }

    async startKubernetesStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            let socket = this.websocketOps.find(s => s.ws === webSocket)
            if (!socket) {
                let len = this.websocketOps.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                socket = this.websocketOps[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance, 
                    timestamps: instanceConfig.data.timestamp,
                    paused:false,
                    assets:[]
                })
                instance = socket?.instances[len-1]
            }
            
            let asset = {
                podNamespace,
                podName,
                containerName,
                buffer: ''
            }
            instance.assets.push( asset )
    
        }
        catch (err:any) {
            console.log('Generic error starting pod ops stream', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
            //this.startDockerStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
        else {
            this.startKubernetesStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
    }

    async processMessage(webSocket: WebSocket) {

    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'filter', 'view', 'cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        var socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('No socket found for pci')
            return
        }
        let instances = socket.instances

        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log paused')
            }
            if (action === InstanceMessageActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.CONTINUE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            var instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (var asset of instance.assets) {
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no ops Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on ops')
        }
    }

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.websocketOps.find(s => s.ws === webSocket))
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.websocketOps.findIndex(s => s.ws === webSocket)
            this.websocketOps.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on logs for remove')
        }
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            socket.lastRefresh = Date.now()
            return true
        }
        else {
            console.log('WebSocket not found')
            return false
        }
    }

    updateConnection(newWebSocket: WebSocket, instanceId: string): boolean {
        for (let entry of this.websocketOps) {
            var exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (var instance of entry.instances) {
                    if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
                        for (let asset of instance.assets) {
                        }
                    }
                    else if (this.clusterInfo.type === ClusterTypeEnum.KUBERNETES) {
                        console.log('instancefound')
                        for (let asset of instance.assets) {
                            console.log(`found ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)
                        }
                    }
                }
                return true
            }
        }
        return false
    }

}

export { OpsChannel }