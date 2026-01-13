import { IInstanceConfig, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, KwirthData} from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel'
import { Request, Response } from 'express'
import { Watch } from '@kubernetes/client-node'
import { applyResource, cronJobStatus, cronJobTrigger, nodeCordon, nodeDrain, nodeUnCordon, throttleExcute } from '../../tools/KubernetesTools'
const yaml = require('js-yaml')

export interface IMagnifyConfig {
    interval: number
}

export enum MagnifyCommandEnum {
    CREATE = 'create',
    APPLY = 'apply',
    DELETE = 'delete',
    LIST = 'list',
    CLUSTERINFO = 'clusterinfo',
    LISTCRD = 'listcrd',
    WATCH = 'watch',
    EVENTS = 'events',
    K8EVENT = 'k8event',
    CRONJOB = 'CronJob',
    NODE = 'Node',
}

export interface IMagnifyMessage extends IInstanceMessage {
    msgtype: 'magnifymessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: MagnifyCommandEnum
    params?: string[]
}

export interface IMagnifyMessageResponse extends IInstanceMessage {
    msgtype: 'magnifymessageresponse'
    id: string
    command: MagnifyCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    event?: string
    data?: any
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    configData: IMagnifyConfig
    paused: boolean
    watch: Watch
}

class MagnifyChannel implements IChannel {
    kwirthData : KwirthData
    clusterInfo : ClusterInfo
    webSockets: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    // +++ convert to abstract and implement common code like this
    /*

        abstract class BaseChannel implements IChannel {
            // 1. Constructor forzado para todos
            constructor(
                protected clusterInfo: ClusterInfo, 
                protected kwirthData: KwirthData
            ) {}

            // 2. Función COMÚN con implementación por defecto
            // Si a la clase hija le vale este código, no tiene que escribir nada.
            containsConnection(webSocket: WebSocket): boolean {
                console.log("Ejecutando lógica común de verificación...");
                // Supongamos una lógica estándar que sirva para casi todos
                return true; 
            }

            // 3. Método que el hijo PUEDE sobrescribir opcionalmente
            removeConnection(webSocket: WebSocket): void {
                console.log("Conexión eliminada de forma estándar");
            }

            // 4. Métodos que el hijo DEBE implementar sí o sí
            abstract getChannelData(): BackChannelData;
            abstract processEvent(type: string, obj: any): void;
            
            // ... el resto de métodos de IChannel marcados como abstract
        }

    */

    //+++ add dispose/destroy (conterpart of initChannel) to IChannel (and implement in this channel a remove from "events subscription")

    constructor (clusterInfo:ClusterInfo, kwirthData : KwirthData) {
        this.clusterInfo = clusterInfo
        this.kwirthData = kwirthData
    }

    getChannelData = (): BackChannelData => {
        return {
            id: 'magnify',
            routable: false,
            pauseable: false,
            modifyable: false,
            reconnectable: false,
            metrics: true,
            events: true,
            sources: [ ClusterTypeEnum.KUBERNETES ],
            endpoints: [],
            websocket: false
        }
    }

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'magnify$read', 'cluster'].indexOf(scope)
    }

    processEvent(type:string, obj:any) : void {
        // +++ debug console.log('****', type, obj.kind, obj.metadata.namespace, obj.metadata.name)
        for (let socket of this.webSockets) {
            for (let instance of socket.instances) {
                let magnifyMessage:IMagnifyMessageResponse = {
                    msgtype: 'magnifymessageresponse',
                    id: '1',
                    command: MagnifyCommandEnum.K8EVENT,
                    namespace: '',
                    group: '',
                    pod: '',
                    container: '',
                    action: InstanceMessageActionEnum.COMMAND,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    type: InstanceMessageTypeEnum.DATA,
                    channel: 'magnify',
                    instance: instance.instanceId,
                    event: type,
                    data: obj
                }
                socket.ws.send(JSON.stringify(magnifyMessage))
            }
        }
    }

    async endpointRequest(endpoint:string, req:Request, res:Response, accessKey:AccessKey) : Promise<void> {
    }

    async websocketRequest(newWebSocket:WebSocket) : Promise<void> {
    }

    containsInstance = (instanceId: string): boolean => {
        return this.webSockets.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    containsAsset = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string): boolean => {
        //+++ review asset list and answer accordingly
        return false
    }
    
    processCommand = async (webSocket:WebSocket, instanceMessage:IInstanceMessage) : Promise<boolean> => {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            return false
        }
        else {
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
            let magnifyMessage = instanceMessage as IMagnifyMessage
            let resp = await this.executeCommand(webSocket, instance, magnifyMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    addObject = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<boolean> => {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        if (instanceConfig.namespace === this.kwirthData.namespace) {
            ///+++check that namnespace and deployment and pod are  the ones of kwirth, return false otherwise
        }

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
                configData: instanceConfig.data,
                paused: false,
                watch: new Watch(this.clusterInfo.kubeConfig)
            }
            instances.push(instance)
        }
        return true
    }

    deleteObject = async (webSocket:WebSocket, instanceConfig:IInstanceConfig, podNamespace:string, podName:string, containerName:string) : Promise<boolean> => {
        return true
    }

    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig, action: InstanceMessageActionEnum): void => {
        console.log('Pause/Continue not supported')
    }

    modifyInstance = (webSocket:WebSocket, instanceConfig: IInstanceConfig): void => {
        console.log('Modify not supported')
    }

    stopInstance = (webSocket: WebSocket, instanceConfig: IInstanceConfig): void => {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Magnify instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Magnify instance not found`)
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no Magnify Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on Magnify')
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
            console.log('WebSocket not found on Magnify for remove')
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
        for (let entry of this.webSockets) {
            let exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                return true
            }
        }
        return false
    }

    // *************************************************************************************
    // PRIVATE
    // *************************************************************************************

    private sendDataMessage = (webSocket:WebSocket, instance:IInstance, command: MagnifyCommandEnum, data:any): void => {
        let resp: IMagnifyMessageResponse = {
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.RESPONSE,
            channel: 'magnify',
            instance: instance.instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id: '1',  //+++
            command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            data,
            msgtype: 'magnifymessageresponse'
        }
        webSocket.send(JSON.stringify(resp))
    }

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:ISignalMessage = {
            action,
            flow,
            channel: 'magnify',
            instance: instanceId,
            type: InstanceMessageTypeEnum.SIGNAL,
            text,
            level
        }
        ws.send(JSON.stringify(resp))
    }

    getInstance(webSocket:WebSocket, instanceId: string) : IInstance | undefined{
        let socket = this.webSockets.find(entry => entry.ws === webSocket)
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
    
    private async executeCommand (webSocket:WebSocket, instance:IInstance, magnifyMessage:IMagnifyMessage) : Promise<IMagnifyMessageResponse | undefined> {
        let execResponse: IMagnifyMessageResponse = {
            action: magnifyMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            channel: magnifyMessage.channel,
            instance: magnifyMessage.instance,
            command: magnifyMessage.command,
            id: magnifyMessage.id,
            namespace: magnifyMessage.namespace,
            group: magnifyMessage.group,
            pod: magnifyMessage.pod,
            container: magnifyMessage.container,
            msgtype: 'magnifymessageresponse'
        }

        if (!magnifyMessage.command) {
            execResponse.data = 'No command received in data'
            return execResponse
        }

        switch (magnifyMessage.command) {
            case MagnifyCommandEnum.LIST: {
                console.log(`Get LIST`)
                if (!magnifyMessage.params || magnifyMessage.params.length<1) {
                    execResponse.data = `Insufficent parameters`
                    return execResponse
                }
                this.executeList(webSocket, instance, magnifyMessage.params)
                return
            }
            case MagnifyCommandEnum.CLUSTERINFO:
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.CLUSTERINFO, JSON.stringify((await this.clusterInfo.versionApi.getCode())))
                break

            case MagnifyCommandEnum.NODE:
                switch (magnifyMessage.params![0]) {
                    case 'cordon':
                        await nodeCordon(this.clusterInfo.coreApi, magnifyMessage.params![1])
                        break
                    case 'uncordon':
                        await nodeUnCordon(this.clusterInfo.coreApi, magnifyMessage.params![1])
                        break
                    case 'drain':
                        await nodeDrain(this.clusterInfo.coreApi, magnifyMessage.params![1])
                        break
                }
                break

            case MagnifyCommandEnum.LISTCRD: {
                console.log(`Get LISTCRD`)
                if (!magnifyMessage.params || magnifyMessage.params.length<1) {
                    execResponse.data = `Insufficent parameters`
                    return execResponse
                }
                this.executeListCrd(webSocket, instance, magnifyMessage.params)
                return
            }
            case MagnifyCommandEnum.CREATE: {
                console.log(`Do CREATE`)
                this.executeCreate(webSocket, instance, magnifyMessage.params!)
                return
            }
            case MagnifyCommandEnum.EVENTS: {
                console.log(`Do EVENT`)
                this.executeEvents(webSocket, instance, magnifyMessage.params!)
                return
            }
            case MagnifyCommandEnum.APPLY: {
                console.log(`Do APPLY`)
                this.executeApply(webSocket, instance, magnifyMessage.params!)
                return
            }
            case MagnifyCommandEnum.DELETE: {
                console.log(`Do DELETE`)
                this.executeDelete(webSocket, instance, magnifyMessage.params!)
                return
            }

            case MagnifyCommandEnum.CRONJOB: {
                switch (magnifyMessage.params![0]) {
                    case 'trigger':
                        await cronJobTrigger(magnifyMessage.params![1], magnifyMessage.params![2], this.clusterInfo.batchApi)
                        break
                    case 'suspend':
                        await cronJobStatus(magnifyMessage.params![1], magnifyMessage.params![2], true, this.clusterInfo.batchApi)
                        break
                    case 'resume':
                        await cronJobStatus(magnifyMessage.params![1], magnifyMessage.params![2], false, this.clusterInfo.batchApi)
                        break
                }
                break
            }

            default:
                let text = `Invalid command '${magnifyMessage.command}'. Valid commands are: ${Object.keys(MagnifyCommandEnum)}`
                this.sendSignalMessage( webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, text)
                break
        }
        return execResponse
    }

    cleanLimitRange = (obj: any): void => {
        //+++ maybe this is needed for other resources
        if (obj !== null && typeof obj === 'object') {
            
            if (Array.isArray(obj)) {
                for (const item of obj)
                    this.cleanLimitRange(item)
            }
            else {
                if (obj['_default'] !== undefined) {
                    obj['default'] = obj['_default']
                    delete obj['_default']
                }
                for (const key of Object.keys(obj))
                    this.cleanLimitRange(obj[key])
            }
        }
    }
    
    private async executeList (webSocket:WebSocket, instance:IInstance, params:string[]) {
        try {
            throttleExcute(async () => {
                for (let param of params) {
                    switch (param) {
                        case 'Pod':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPodForAllNamespaces())))
                            break
                        case 'Node':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNode())))
                            break
                        case 'Namespace':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNamespace())))
                            break
                        case 'ConfigMap':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listConfigMapForAllNamespaces())))
                            break
                        case 'Secret':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listSecretForAllNamespaces())))
                            break
                        case 'ResourceQuota':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listResourceQuotaForAllNamespaces())))
                            break
                        case 'LimitRange':
                            let result = await this.clusterInfo.coreApi.listLimitRangeForAllNamespaces()
                            result.items.map(item => this.cleanLimitRange(item))
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify(result))
                            break
                        case 'HorizontalPodAutoscaler':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.autoscalingApi.listHorizontalPodAutoscalerForAllNamespaces())))
                            break
                        case 'PodDisruptionBudget':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.policyApi.listPodDisruptionBudgetForAllNamespaces())))
                            break
                        case 'PriorityClass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.schedulingApi.listPriorityClass())))
                            break
                        case 'RuntimeClass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.nodeApi.listRuntimeClass())))
                            break
                        case 'Lease':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coordinationApi.listLeaseForAllNamespaces())))
                            break
                        case 'ValidatingWebhookConfiguration':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.admissionApi.listValidatingWebhookConfiguration())))
                            break
                        case 'MutatingWebhookConfiguration':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.admissionApi.listMutatingWebhookConfiguration())))
                            break
                        case 'Service':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceForAllNamespaces())))
                            break
                        case 'Endpoints':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listEndpointsForAllNamespaces())))
                            break
                        case 'Ingress':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressForAllNamespaces())))
                            break
                        case 'IngressClass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressClass())))
                            break
                        case 'NetworkPolicy':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listNetworkPolicyForAllNamespaces())))
                            break
                        case 'Deployment':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDeploymentForAllNamespaces())))
                            break
                        case 'DaemonSet':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDaemonSetForAllNamespaces())))
                            break
                        case 'ReplicaSet':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listReplicaSetForAllNamespaces())))
                            break
                        case 'ReplicationController':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listReplicationControllerForAllNamespaces())))
                            break
                        case 'StatefulSet':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listStatefulSetForAllNamespaces())))
                            break
                        case 'Job':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listJobForAllNamespaces())))
                            break
                        case 'CronJob':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listCronJobForAllNamespaces())))
                            break
                        case 'PersistentVolumeClaim':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolumeClaimForAllNamespaces())))
                            break
                        case 'PersistentVolume':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolume())))
                            break
                        case 'StorageClass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.storageApi.listStorageClass())))
                            break
                        case 'ServiceAccount':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceAccountForAllNamespaces())))
                            break
                        case 'ClusterRole':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRole())))
                            break
                        case 'Role':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleForAllNamespaces())))
                            break
                        case 'ClusterRoleBinding':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRoleBinding())))
                            break
                        case 'RoleBinding':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleBindingForAllNamespaces())))
                            break
                        case 'CustomResourceDefinition':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.extensionApi.listCustomResourceDefinition())))
                            break
                        default:
                            console.log('invalid class: ', param)
                            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, 'Invalid class: '+param)
                            break
                    }
                }
            })
        }
        catch (err:any) {
            console.log(err)
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err.body))
        }

    }

    private async executeListCrd (webSocket:WebSocket, instance:IInstance, params:string[]) {
        try {
            throttleExcute(async () => {
                let resp = await this.clusterInfo.crdApi.listCustomObjectForAllNamespaces({
                    group: params[0],
                    version: params[1],
                    plural: params[2]
                })
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LISTCRD, JSON.stringify(resp))
            })
        }
        catch (err:any) {
            console.log(err)
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err.body))
        }
    }

    private async executeDelete (webSocket:WebSocket, instance:IInstance, params:string[]) {
        for (let obj of params) {
            try {
                await this.clusterInfo.objectsApi.delete(yaml.load(obj))
            }
            catch (err:any) {
                console.log(err)
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err.body))
            }
        }
    }

    private async executeCreate (webSocket:WebSocket, instance:IInstance, params:string[]) {
        for (let param of params) {
            try {
                this.clusterInfo.objectsApi.create(yaml.load(param))
            }
            catch (err:any) {
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err))
            }
        }
    }

    private async executeApply (webSocket:WebSocket, instance:IInstance, params:string[]) {
        for (let param of params) {
            try {
                const res = yaml.load(param)
                let result = await applyResource(res, this.clusterInfo)
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instance.instanceId, result)
            }
            catch (err:any) {
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err))
            }
        }
    }

    private async executeEvents (webSocket:WebSocket, instance:IInstance, params:string[]) {
        let res = await this.getEventsForObject(params[0],params[1],params[2])
        this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.EVENTS, JSON.stringify(res))
    }

    getEventsForObject = async (namespace:string,  objectKind:string, objectName:string) => {
        try {
            const res = await this.clusterInfo.coreApi.listEventForAllNamespaces( {
                fieldSelector: `involvedObject.name=${objectName},involvedObject.kind=${objectKind}`
            })
            return res.items
        }
        catch (err) {
            console.error('Error obteniendo eventos:', err);
        }
    }    
}

export { MagnifyChannel }