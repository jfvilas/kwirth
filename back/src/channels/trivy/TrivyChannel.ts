import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, TrivyMessage, TrivyMessageResponse, AccessKey, accessKeyDeserialize, parseResources, InstanceConfigScopeEnum, TrivyCommandEnum, TrivyConfig, ChannelData, SourceEnum } from '@jfvilas/kwirth-common';
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel';
import { KubernetesObject, makeInformer } from '@kubernetes/client-node';

const TRIVY_API_VERSION = 'v1alpha1'
const TRIVY_API_GROUP = 'aquasecurity.github.io'
const TRIVY_API_PLURAL = 'vulnerabilityreports'

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
    informer: any
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
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) return false

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

    scoreAsset = async (instance:IInstance, asset:IAsset): Promise<{ score: number; known: any; unknown: any; }> => {
        let known:any, unknown:any
        let score = 0
        try {
            let pod = (await this.clusterInfo.coreApi.readNamespacedPod(asset.podName, asset.podNamespace)).body
            let ctrl = pod.metadata?.ownerReferences?.find(or => or.controller)
            let kind = ctrl?.kind.toLowerCase()
            let crdName = `${kind}-${ctrl?.name}-${asset.containerName}`
            let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject(TRIVY_API_GROUP,TRIVY_API_VERSION, asset.podNamespace, TRIVY_API_PLURAL, crdName)
            if (crdObject.response.statusCode === 200) {
                console.log('Got report for', crdName)
                let summary = (crdObject.body as any).report.summary
                score += (instance.maxCritical>=0? summary.criticalCount*4 : 0) +
                    (instance.maxHigh>=0? summary.highCount*4 : 0) +
                    (instance.maxMedium>=0? summary.mediumCount*4 : 0) +
                    (instance.maxLow>=0? summary.lowCount*4 : 0)
                known = {
                    name: asset.podName,
                    namespace: asset.podNamespace,
                    container: asset.containerName,
                    report: (crdObject.body as any).report
                }
            }
            else {
                console.log(`VulnReport not found for ${crdName} (${crdObject.response.statusCode}-${crdObject.response.statusMessage})`)
                unknown = {
                    name: asset.podName,
                    namespace: asset.podNamespace,
                    container: asset.containerName,
                    statusCode: crdObject.response.statusCode,
                    statusMessage: crdObject.response.statusMessage
                }
            }
        }
        catch (err:any){
            unknown = {
                name: asset.podName,
                namespace: asset.podNamespace,
                container: asset.containerName,
                statusCode: 999,
                statusMessage: err
            }
            console.log('err', err.response.body)
        }
        return {
            score,
            known,
            unknown
        }
    }

    private calculateScore = async (instance: IInstance) => {
        let score = 0
        let unknown:any[] = []
        let known:any[] = []
        let maxScore = (instance.maxCritical>=0? instance.maxCritical*4 : 0) +
            (instance.maxHigh>=0? instance.maxHigh*4 : 0) +
            (instance.maxMedium>=0? instance.maxMedium*4 : 0) +
            (instance.maxLow>=0? instance.maxLow*4 : 0)
        let totalMaxScore = instance.assets.length * maxScore

        for (let asset of instance.assets) {
            let result = await this.scoreAsset(instance, asset)
            score += result.score
            if (result.known) known.push(result.known)
            if (result.unknown) unknown.push(result.unknown)
        }
        score = (1.0 - (score / totalMaxScore)) * 100.0
        return score
    }

    executeCommand = async (instanceMessage: TrivyMessage, instance:IInstance): Promise<TrivyMessageResponse>=> {
        let resp:TrivyMessageResponse = {
            msgtype: 'trivymessageresponse',
            id: '',
            namespace: instanceMessage.namespace,
            group: instanceMessage.group,
            pod: instanceMessage.pod,
            container: instanceMessage.container,
            action: instanceMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.DATA,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            data: undefined
        }

        console.log('instanceMessage.command', instanceMessage.command)
        switch (instanceMessage.command) {
            case TrivyCommandEnum.SCORE:
                if (!this.checkScopes(instance, InstanceConfigScopeEnum.WORKLOAD)) {
                    resp.data = `Insufficient scope for WORKLOAD`
                    return resp
                }
                let score = await this.calculateScore(instance)
                resp.data = { score }
                break
            case TrivyCommandEnum.RESCAN:
                let pod = (await this.clusterInfo.coreApi.readNamespacedPod(instanceMessage.pod, instanceMessage.namespace)).body
                let ctrl = pod.metadata?.ownerReferences?.find(or => or.controller)
                let kind = ctrl?.kind.toLowerCase()
                let crdName = `${kind}-${ctrl?.name}-${instanceMessage.container}`
                let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject(TRIVY_API_GROUP,TRIVY_API_VERSION, instanceMessage.namespace, TRIVY_API_PLURAL, crdName)
                if (crdObject.response.statusCode === 200) {
                    try {
                        await this.clusterInfo.crdApi.deleteNamespacedCustomObject(TRIVY_API_GROUP, TRIVY_API_VERSION, instanceMessage.namespace, TRIVY_API_PLURAL, crdName)
                    }
                    catch (err) {
                        console.log(err)
                        resp.data = `Error removing vulnerability report`
                        return resp
                    }
                }
                else {
                    resp.data = `Vulnerabilty report does not exist`
                    return resp
                }
                break
            default:
                console.log('Invalid command received:', instanceMessage.command)
        }
        return resp
    }

    private processEvent = async (webSocket:WebSocket, instance:IInstance, event:string, obj:any, asset:any) => {
        if (obj.metadata.labels['trivy-operator.resource.namespace'] === asset.podNamespace &&
            asset.podName.startsWith(obj.metadata.labels['trivy-operator.resource.name']) &&
            obj.metadata.labels['trivy-operator.container.name']  === asset.containerName) {
            let payload:TrivyMessageResponse = {
                msgtype: 'trivymessageresponse',
                msgsubtype: event,
                id: '',
                namespace: asset.podNamespace,
                group: '',
                pod: asset.podName,
                container: asset.containerName,
                action: InstanceMessageActionEnum.NONE,
                flow: InstanceMessageFlowEnum.UNSOLICITED,
                type: InstanceMessageTypeEnum.DATA,
                channel: InstanceMessageChannelEnum.TRIVY,
                instance: instance.instanceId
            }
            if (event==='add' || event==='update') {
                let result = await this.scoreAsset(instance, asset)
                if (result.known) {
                    payload.data = result.known
                    webSocket.send(JSON.stringify(payload))
                }                    
            }
            else {
                payload.data = asset
                webSocket.send(JSON.stringify(payload))
            }

            let score = await this.calculateScore(instance)
            let scoreResp:TrivyMessageResponse = {
                msgtype: 'trivymessageresponse',
                msgsubtype: 'score',
                id: '',
                namespace: '',
                group: '',
                pod: '',
                container: '',
                action: InstanceMessageActionEnum.NONE,
                flow: InstanceMessageFlowEnum.UNSOLICITED,
                type: InstanceMessageTypeEnum.DATA,
                channel: InstanceMessageChannelEnum.TRIVY,
                instance: instance.instanceId,
                data: { score }
            }
            webSocket.send(JSON.stringify(scoreResp))
        }
    }

    createInformer = (webSocket:WebSocket, instance:IInstance, asset:IAsset) => {
        const plural = 'vulnerabilityreports'
        const path = `/apis/${TRIVY_API_GROUP}/${TRIVY_API_VERSION}/namespaces/${asset.podNamespace}/${plural}`


        const listFn = () =>
            this.clusterInfo.crdApi.listNamespacedCustomObject(TRIVY_API_GROUP, TRIVY_API_VERSION, asset.podNamespace, plural).then((res) => {
                    const typedBody = res.body as { items:KubernetesObject[] }
                    return {
                        response: res.response,
                        body: typedBody,
                    }
            })
        const informer = makeInformer(this.clusterInfo.kubeConfig, path, listFn )
        informer.on('add', (obj:any) => this.processEvent(webSocket, instance, 'add', obj, asset))
        informer.on('update', (obj:any) => this.processEvent(webSocket, instance, 'update', obj, asset))
        informer.on('delete', (obj:any) => this.processEvent(webSocket, instance, 'delete', obj, asset))
        informer.on('error', (err:any) => {
            console.error('Error in informer:', err)
            setTimeout(() => { informer.start(); console.log('informer restarterd')}, 5000)
        })
        return informer
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
                maxCritical: 0,
                maxHigh: 0,
                maxMedium: 0,
                maxLow: 0,
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
            containerName,
            informer: undefined
        }
        asset.informer = this.createInformer(webSocket, instance, asset)
        asset.informer.start()
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
                        asset.informer.stop()
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

    private checkScopes = (instance:IInstance, scope: InstanceConfigScopeEnum) => {
        let resources = parseResources (instance.accessKey.resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel))
        return canPerform
    }

}

export { TrivyChannel }