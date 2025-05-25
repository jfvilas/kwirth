import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, TrivyMessage, TrivyMessageResponse, AccessKey, accessKeyDeserialize, parseResources, InstanceConfigScopeEnum } from '@jfvilas/kwirth-common';
import { ClusterInfo } from '../../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from '../IChannel';

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    assets: IAsset[]
}

class TrivyChannel implements IChannel {    
    clusterInfo : ClusterInfo
    webSocketTrivy: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData(): ChannelData {
        return {
            id: 'trivy',
            immediatable: false,
            routable: false,
            pauseable: false,
            modifyable: false,
            reconnectable: false,
            sources: [ SourceEnum.KUBERNETES ],
            metrics: false
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'workload', 'kubernetes', 'cluster'].indexOf(scope)
    }

    containsInstance(instanceId: string): boolean {
        return this.webSocketTrivy.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    async processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> {
        console.log('instanceMessage.flow',instanceMessage.flow)
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            return false
        }
        else {
        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
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
            let resp = ''
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSocketTrivy.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSocketTrivy[len-1]
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (!instance) {
            instance = {
                accessKey: accessKeyDeserialize(instanceConfig.accessKey),
                instanceId: instanceConfig.instance,
                assets: []
            }
            instances.push(instance)
        }
        let asset:IAsset = {
            podNamespace,
            podName,
            containerName
        }
        instance.assets.push(asset)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        console.log('Pause/Continue not supported')
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {
        console.log('Modify not supported')
    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Trivy instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Trivy instance not found`)
        }
    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
        if (socket) {
            var instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no trivy Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on trivy')
        }
    }

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.webSocketTrivy.find(s => s.ws === webSocket))
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSocketTrivy.findIndex(s => s.ws === webSocket)
            this.webSocketTrivy.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on trivy for remove')
        }
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.webSocketTrivy.find(s => s.ws === webSocket)
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
        console.log('updateConnection not supported')
        return false
    }

    // ************************* private methods *************************

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:SignalMessage = {
            action,
            flow,
            channel: InstanceMessageChannelEnum.TRIVY,
            instance: instanceId,
            type: InstanceMessageTypeEnum.SIGNAL,
            text,
            level
        }
        ws.send(JSON.stringify(resp))
    }

    private sendDataMessage = (ws:WebSocket, instanceId:string, text:string): void => {
        var resp: InstanceConfigResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: InstanceMessageChannelEnum.TRIVY,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    private sendSecurityResponse = (ws:WebSocket, instance:IInstance, asset:IAsset, id:string, text:string): void => {
        var resp: TrivyMessageResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: InstanceMessageChannelEnum.TRIVY,
            instance: instance.instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id,
            namespace: asset.podNamespace,
            kind: '',
            pod: asset.podName,
            container: asset.containerName,
            data: text,
            msgtype: 'trivymessageresponse'
        }
        ws.send(JSON.stringify(resp))
    }

    private checkScopes = (instance:IInstance, scope: InstanceConfigScopeEnum) => {
        let resources = parseResources (instance.accessKey.resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel))
        return canPerform
    }

}

export { TrivyChannel }