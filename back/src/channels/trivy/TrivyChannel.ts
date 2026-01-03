import { IInstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, ITrivyMessage, ITrivyMessageResponse, AccessKey, accessKeyDeserialize, parseResources, TrivyCommandEnum, TrivyConfig, BackChannelData, ClusterTypeEnum, IKnown, IUnknown } from '@jfvilas/kwirth-common';
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel';
import { CustomObjectsApiListNamespacedCustomObjectRequest, KubernetesObject, makeInformer } from '@kubernetes/client-node';
import { Request, Response } from 'express'

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
    readonly channelId: string = 'trivy'
    clusterInfo : ClusterInfo
    webSockets: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData = (): BackChannelData => {
        return {
            id: this.channelId,
            routable: false,
            pauseable: false,
            modifyable: false,
            reconnectable: false,
            metrics: false,
            events: false, 
            sources: [ ClusterTypeEnum.KUBERNETES ],
            endpoints: [],
            websocket: false
        }
    }

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'trivy$workload', 'trivy$kubernetes', 'cluster'].indexOf(scope)
    }

    processEvent(type:string, obj:any) : void {
    }

    async endpointRequest(endpoint:string,req:Request, res:Response) : Promise<void> {
    }

    async websocketRequest(newWebSocket:WebSocket) : Promise<void> {
    }

    containsAsset = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string): boolean => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) return instances.some(i => i.assets.some(a => a.podNamespace===podNamespace && a.podName===podName && a.containerName===containerName))
        }
        return false
    }

    containsInstance = (instanceId: string): boolean => {
        return this.webSockets.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    processCommand = async (webSocket:WebSocket, instanceMessage:IInstanceMessage) : Promise<boolean> => {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) return false

        let socket = this.webSockets.find(s => s.ws === webSocket)
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
        let resp = await this.executeCommand(instanceMessage as ITrivyMessage, instance)
        if (resp) webSocket.send(JSON.stringify(resp))
        return Boolean(resp)
    }

    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> => {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSockets.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSockets[len-1]
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
        //+++ inexistent vuln reports do not create a informer event, so we need to review if some report does not exist and inform the client accordingly

        let result = await this.scoreAsset(instance, asset)
        if (result.unknown) {
            let payload:ITrivyMessageResponse = {
                msgtype: 'trivymessageresponse',
                msgsubtype: 'add',
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
            payload.data = result
            webSocket.send(JSON.stringify(payload))
        }

        instance.assets.push(asset)
        asset.informer = this.createInformer(webSocket, instance, asset)
        asset.informer.start()
    }

    deleteObject = (webSocket:WebSocket, instanceConfig:IInstanceConfig, podNamespace:string, podName:string, containerName:string) : void => {
        
    }
    
    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig, action: InstanceMessageActionEnum): void => {
        console.log('Pause/Continue not supported')
    }

    modifyInstance = (webSocket:WebSocket, instanceConfig: IInstanceConfig): void => {
        console.log('Modify not supported')
    }

    stopInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
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
        let socket = this.webSockets.find(s => s.ws === webSocket)
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
        return Boolean (this.webSockets.find(s => s.ws === webSocket))
    }

    removeConnection = (webSocket: WebSocket): void => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSockets.findIndex(s => s.ws === webSocket)
            this.webSockets.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on trivy for remove')
        }
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
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

    // *************************************************************************************
    // PRIVATE
    // *************************************************************************************

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:ISignalMessage = {
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

    private checkScopes = (instance:IInstance, scope: string) => {
        let resources = parseResources (instance.accessKey.resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel))
        return canPerform
    }

    createInformer = (webSocket:WebSocket, instance:IInstance, asset:IAsset) => {
        const plural = 'vulnerabilityreports'
        const path = `/apis/${TRIVY_API_GROUP}/${TRIVY_API_VERSION}/namespaces/${asset.podNamespace}/${plural}`

        // const listFn = () =>
        //     this.clusterInfo.crdApi.listNamespacedCustomObject(TRIVY_API_GROUP, TRIVY_API_VERSION, asset.podNamespace, plural).then((res) => {
        //         const typedBody = res.body as { items:KubernetesObject[] }
        //         return {
        //             response: res.response,
        //             body: typedBody,
        //         }
        //     })
        const listFn = () =>
            this.clusterInfo.crdApi.listNamespacedCustomObject({ group: TRIVY_API_GROUP, version: TRIVY_API_VERSION, namespace: asset.podNamespace, plural: plural }).then((res) => {
                const typedBody = res as { items:KubernetesObject[] }
                return typedBody
            })
        const informer = makeInformer(this.clusterInfo.kubeConfig, path, listFn )
        informer.on('add', (obj:any) => this.processInformerEvent(webSocket, instance, 'add', obj, asset))
        informer.on('update', (obj:any) => this.processInformerEvent(webSocket, instance, 'update', obj, asset))
        informer.on('delete', (obj:any) => this.processInformerEvent(webSocket, instance, 'delete', obj, asset))
        informer.on('error', (err:any) => {
            console.error('Error in informer:', err)
            setTimeout(() => { informer.start(); console.log('informer restarterd')}, 5000)
        })
        return informer
    }

    scoreAsset = async (instance:IInstance, asset:IAsset): Promise<{ score: number, known?: IKnown, unknown?: IUnknown }> => {
        let known:IKnown = {
            name: '',
            namespace: '',
            container: '',
            report: undefined
        }
        let unknown:IUnknown = {
            name: '',
            namespace: '',
            container: '',
            statusCode: 0,
            statusMessage: ''
        }
        let score = 0
        try {
            let pod = (await this.clusterInfo.coreApi.readNamespacedPod({ name:asset.podName, namespace:asset.podNamespace }))
            let ctrl = pod.metadata?.ownerReferences?.find(or => or.controller)
            let kind = ctrl?.kind.toLowerCase()
            let crdName = `${kind}-${ctrl?.name}-${asset.containerName}`
            //let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject(TRIVY_API_GROUP,TRIVY_API_VERSION, asset.podNamespace, TRIVY_API_PLURAL, crdName)
            let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject({ group: TRIVY_API_GROUP, version: TRIVY_API_VERSION, namespace: asset.podNamespace, plural: TRIVY_API_PLURAL, name: crdName })
            if (crdObject.response.statusCode === 200) { //+++
                console.log('Got report for', crdName)
                let summary = (crdObject.body as any).report.summary
                score +=
                    (instance.maxCritical>=0? summary.criticalCount*4 : 0) +
                    (instance.maxHigh>=0? summary.highCount*3 : 0) +
                    (instance.maxMedium>=0? summary.mediumCount*2 : 0) +
                    (instance.maxLow>=0? summary.lowCount*1 : 0)
                known = {
                    container: asset.containerName,
                    name: asset.podName,
                    namespace: asset.podNamespace,
                    report: (crdObject.body as any).report
                }
                return {score, known, unknown:undefined}
            }
            else {
                console.log(`VulnReport not found for ${crdName} (${crdObject.response.statusCode}-${crdObject.response.statusMessage})`) //+++
                unknown = {
                    container: asset.containerName,
                    name: asset.podName,
                    namespace: asset.podNamespace,
                    statusCode: crdObject.response.statusCode || 0,
                    statusMessage: crdObject.response.statusMessage || ''
                }
                return {score:0, known:undefined, unknown}
            }
        }
        catch (err:any){
            unknown = {
                container: asset.containerName,
                name: asset.podName,
                namespace: asset.podNamespace,
                statusCode: 999,
                statusMessage: err.response.body.message
            }
            console.log('catcherr', err.response.body)
            return {score:0, known:undefined, unknown}
        }
    }

    private calculateScore = async (instance: IInstance) => {
        let score = 0
        let maxScore =
            (instance.maxCritical>=0? instance.maxCritical*4 : 0) +
            (instance.maxHigh>=0? instance.maxHigh*3 : 0) +
            (instance.maxMedium>=0? instance.maxMedium*2 : 0) +
            (instance.maxLow>=0? instance.maxLow*1 : 0)
        let totalMaxScore = instance.assets.length * maxScore

        for (let asset of instance.assets) {
            let result = await this.scoreAsset(instance, asset)
            score += result.score
        }
        score = (1.0 - (score / totalMaxScore)) * 100.0
        return score
    }

    executeCommand = async (instanceMessage: ITrivyMessage, instance:IInstance): Promise<ITrivyMessageResponse>=> {
        let resp:ITrivyMessageResponse = {
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

        switch (instanceMessage.command) {
            case TrivyCommandEnum.SCORE:
                if (!this.checkScopes(instance, 'trivy$workload')) {
                    resp.data = `Insufficient scope for WORKLOAD`
                    return resp
                }
                let score = await this.calculateScore(instance)
                resp.data = { score }
                break
            case TrivyCommandEnum.RESCAN:
                let pod = (await this.clusterInfo.coreApi.readNamespacedPod({ name:instanceMessage.pod, namespace:instanceMessage.namespace }))
                let ctrl = pod.metadata?.ownerReferences?.find(or => or.controller)
                let kind = ctrl?.kind.toLowerCase()
                let crdName = `${kind}-${ctrl?.name}-${instanceMessage.container}`
                let crdObject = await this.clusterInfo.crdApi.getNamespacedCustomObject({ group:TRIVY_API_GROUP, version: TRIVY_API_VERSION, namespace:instanceMessage.namespace, plural: TRIVY_API_PLURAL, name:crdName })
                if (crdObject.response.statusCode === 200) { //+++
                    try {
                        await this.clusterInfo.crdApi.deleteNamespacedCustomObject({ group:TRIVY_API_GROUP, version:TRIVY_API_VERSION, namespace:instanceMessage.namespace, plural:TRIVY_API_PLURAL, name:crdName })
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

    private processInformerEvent = async (webSocket:WebSocket, instance:IInstance, event:string, obj:any, asset:any) => {
        if (obj.metadata.labels['trivy-operator.resource.namespace'] === asset.podNamespace &&
            asset.podName.startsWith(obj.metadata.labels['trivy-operator.resource.name']) &&
            obj.metadata.labels['trivy-operator.container.name']  === asset.containerName) {
            let payload:ITrivyMessageResponse = {
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
                payload.data = result
                webSocket.send(JSON.stringify(payload))
            }
            else {
                payload.data = asset
                webSocket.send(JSON.stringify(payload))
            }

            // we calculate score everytime a nd event is received in the informer
            let score = await this.calculateScore(instance)
            let scoreResp:ITrivyMessageResponse = {
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

}

export { TrivyChannel }