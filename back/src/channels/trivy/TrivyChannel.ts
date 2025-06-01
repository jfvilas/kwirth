import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, TrivyMessage, TrivyMessageResponse, AccessKey, accessKeyDeserialize, parseResources, InstanceConfigScopeEnum, TrivyCommandEnum, TrivyConfig } from '@jfvilas/kwirth-common';
import { ClusterInfo } from '../../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from '../IChannel';
import { AuthorizationManagement } from '../../tools/AuthorizationManagement';

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    assets: IAsset[]
    maxCritical:number
    maxHigh:number
    maxMedium:number
    maxLow:number
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

    getChannelData = (): ChannelData => {
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

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'workload', 'kubernetes', 'cluster'].indexOf(scope)
    }

    containsInstance = (instanceId: string): boolean => {
        return this.webSocketTrivy.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    processCommand = async (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> => {
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
            let resp = await this.executeCommand(instanceMessage as TrivyMessage, instance)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    executeCommand = async (instanceMessage: TrivyMessage, instance:IInstance): Promise<TrivyMessageResponse>=> {
        let resp:TrivyMessageResponse = {
            msgtype: 'trivymessageresponse',
            id: '',
            namespace: '',
            group: '',
            pod: '',
            container: '',
            action: instanceMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.DATA,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            data: {}
        }

        switch (instanceMessage.command) {
            case TrivyCommandEnum.SCORE:
                let score = 0
                let unknown:any[] = []
                let known:any[] = []

                let maxScore = (instance.maxCritical>=0?instance.maxCritical*4:0) +
                    (instance.maxHigh>=0?instance.maxHigh*4:0) +
                    (instance.maxMedium>=0?instance.maxMedium*4:0) +
                    (instance.maxLow>=0?instance.maxLow*4:0)

                console.log('instance',instance)
                for (let asset of instance.assets) {
                    try {
                        let pod = (await this.clusterInfo.coreApi.readNamespacedPod(asset.podName, asset.podNamespace)).body
                        let ctrl = pod.metadata?.ownerReferences?.find(or => or.controller)
                        let kind = ctrl?.kind.toLowerCase()
                        let crdName = `${kind}-${ctrl?.name}-${asset.containerName}`
                        let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject('aquasecurity.github.io','v1alpha1',asset.podNamespace, 'vulnerabilityreports',crdName)
                        if (crdObject.response.statusCode === 200) {
                            console.log('got report for', crdName)
                            let summary = (crdObject.body as any).report.summary
                            console.log(summary)
                            score += (instance.maxCritical>=0?summary.criticalCount*4:0) +
                                (instance.maxHigh>=0?summary.highCount*4:0) +
                                (instance.maxMedium>=0?summary.mediumCount*4:0) +
                                (instance.maxLow>=0?summary.lowCount*4:0)
                            known.push({
                                name: asset.podName,
                                namespace: asset.podNamespace,
                                container: asset.containerName,
                                report: (crdObject.body as any).report
                            })
                        }
                        else {
                            console.log('vulnreport notfound')
                            unknown.push({
                                name: asset.podName,
                                namespace: asset.podNamespace,
                                container: asset.containerName
                            })
                        }
                    }
                    catch (err){
                        unknown.push({
                            name: asset.podName,
                            namespace: asset.podNamespace,
                            container: asset.containerName
                        })
                        console.log('err')
                        console.log(err)
                    }
                }
                let totalmaxscore = instance.assets.length * maxScore
                let value = (1.0 - (score / totalmaxscore)) * 100.0
                console.log(maxScore, instance.assets.length, score, totalmaxscore, value)
                resp.data.score = value
                resp.data.unknown = unknown
                resp.data.known = known
                console.log(`score:`, resp.data)
                break            
        }
        return resp
    }

    startInstance = async (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> => {
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
                assets: [],
                maxCritical:0,
                maxHigh:0,
                maxMedium:0,
                maxLow:0
            }
            instances.push(instance)
        }
        let ic = instanceConfig.data as TrivyConfig
        instance.maxCritical = ic.maxCritical
        instance.maxHigh = ic.maxHigh
        instance.maxMedium = ic.maxMedium
        instance.maxLow = ic.maxLow
        let asset:IAsset = {
            podNamespace,
            podName,
            containerName
        }
        instance.assets.push(asset)
    }

    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void => {
        console.log('Pause/Continue not supported')
    }

    modifyInstance = (webSocket:WebSocket, instanceConfig: InstanceConfig): void => {
        console.log('Modify not supported')
    }

    stopInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig): void => {
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

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
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

    containsConnection = (webSocket:WebSocket): boolean => {
        return Boolean (this.webSocketTrivy.find(s => s.ws === webSocket))
    }

    removeConnection = (webSocket: WebSocket): void => {
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

    refreshConnection = (webSocket: WebSocket): boolean => {
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

    updateConnection = (newWebSocket: WebSocket, instanceId: string): boolean => {
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
            group: '',
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