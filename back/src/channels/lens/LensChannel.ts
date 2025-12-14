import { IInstanceConfig, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, IInstanceConfigResponse, parseResources } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel'
import { Request, Response } from 'express'
import { Watch } from '@kubernetes/client-node';
import { applyResource } from '../../tools/KubernetesManifests';
const yaml = require('js-yaml')

export interface ILensConfig {
    interval: number
}

export enum LensCommandEnum {
    CREATE = 'create',
    DELETE = 'delete',
    LIST = 'list',
    WATCH = 'watch',
    K8EVENT = 'k8event'
}

export interface ILensMessage extends IInstanceMessage {
    msgtype: 'lensmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: LensCommandEnum
    params?: string[]
}

export interface ILensMessageResponse extends IInstanceMessage {
    msgtype: 'lensmessageresponse'
    id: string
    command: LensCommandEnum
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
    configData: ILensConfig
    paused: boolean
    watch: Watch
}

class LensChannel implements IChannel {
    clusterInfo : ClusterInfo
    webSockets: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    //+++ add dispose to IChannel (and remove events subscription)

    getChannelData = (): BackChannelData => {
        return {
            id: 'lens',
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
        return ['', 'lens$read', 'cluster'].indexOf(scope)
    }

    processEvent(type:string, obj:any) : void {
        console.log('****', type, obj.kind, obj.metadata.namespace, obj.metadata.name)
        for (let socket of this.webSockets) {
            for (let instance of socket.instances) {
                let lensMessage:ILensMessageResponse = {
                    msgtype: 'lensmessageresponse',
                    id: '1',
                    command: LensCommandEnum.K8EVENT,
                    namespace: '',
                    group: '',
                    pod: '',
                    container: '',
                    action: InstanceMessageActionEnum.COMMAND,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    type: InstanceMessageTypeEnum.DATA,
                    channel: 'lens',
                    instance: instance.instanceId,
                    event: type,
                    data: obj
                }
                socket.ws.send(JSON.stringify(lensMessage))
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
            let lensMessage = instanceMessage as ILensMessage
            let resp = await this.executeCommand(webSocket, instance, lensMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
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
                configData: instanceConfig.data,
                paused: false,
                watch: new Watch(this.clusterInfo.kubeConfig)
            }
            instances.push(instance)
            //this.startClusterEventWatcher(instance, webSocket)
        }
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
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Lens instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Lens instance not found`)
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
                console.log('There are no Lens Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on Lens')
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
            console.log('WebSocket not found on Lens for remove')
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

    private sendUnsolicitedMessage = (webSocket:WebSocket, instanceId:string, command: LensCommandEnum, data:any): void => {
        let resp: ILensMessageResponse = {
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: 'lens',
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id: '1',
            command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            data,
            msgtype: 'lensmessageresponse'
        }
        webSocket.send(JSON.stringify(resp))
    }

    private sendDataMessage = (webSocket:WebSocket, instance:IInstance, command: LensCommandEnum, data:any): void => {
        let resp: ILensMessageResponse = {
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.RESPONSE,
            channel: 'lens',
            instance: instance.instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id: '1',  //+++
            command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            data,
            msgtype: 'lensmessageresponse'
        }
        webSocket.send(JSON.stringify(resp))
    }

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:ISignalMessage = {
            action,
            flow,
            channel: 'lens',
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
    
    private async executeCommand (webSocket:WebSocket, instance:IInstance, lensMessage:ILensMessage) : Promise<ILensMessageResponse | undefined> {
        let execResponse: ILensMessageResponse = {
            action: lensMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            channel: lensMessage.channel,
            instance: lensMessage.instance,
            command: lensMessage.command,
            id: lensMessage.id,
            namespace: lensMessage.namespace,
            group: lensMessage.group,
            pod: lensMessage.pod,
            container: lensMessage.container,
            msgtype: 'lensmessageresponse'
        }

        if (!lensMessage.command) {
            execResponse.data = 'No command received in data'
            return execResponse
        }

        switch (lensMessage.command) {
            case LensCommandEnum.LIST: {
                console.log(`Get LIST`)
                if (!lensMessage.params || lensMessage.params.length<1) {
                    execResponse.data = `Insufficent parameters`
                    return execResponse
                }
                this.executeList(webSocket, instance, lensMessage.params)
                return
            }
            case LensCommandEnum.CREATE: {
                console.log(`Do CREATE`)
                this.executeCreate(webSocket, instance, lensMessage.params!)
                return
            }
            case LensCommandEnum.DELETE: {
                console.log(`Do DELETE ${lensMessage.params![0]} in ${lensMessage.namespace}/${lensMessage.pod}/${lensMessage.container}`)
                this.executeDelete(webSocket, instance, '1', lensMessage.params![0])
                return
            }

            default:
                execResponse.data = `Invalid command '${lensMessage.command}'. Valid commands are: ${Object.keys(LensCommandEnum)}`
                break
        }
        return execResponse
    }

    // private startClusterEventWatcher = async (instance:IInstance, webSocket:WebSocket) => {
    //     const path = '/api/v1/events';

    //     try {
    //         await instance.watch.watch(
    //             path,
    //             {},
    //             (type, apiObj) => {

    //                 if (apiObj && apiObj.kind === 'Event') {
    //                     const eventMessage = apiObj.message || 'No message';
    //                     const involvedObject = apiObj.involvedObject;
    //                     const namespace = involvedObject ? involvedObject.namespace : 'N/A';
    //                     const name = involvedObject ? involvedObject.name : 'N/A';
                        
    //                     console.log(`\n--- EVENTO RECIBIDO (${type}) ---`);
    //                     console.log(`Namespace: ${namespace}`);
    //                     console.log(`Recurso: ${involvedObject.kind}/${name}`);
    //                     console.log(`Razón: ${apiObj.reason}`);
    //                     console.log(`Mensaje: ${eventMessage}`);
    //                     console.log('---------------------------------');
    //                     if (apiObj.involvedObject.kind === 'Pod') {
    //                         this.clusterInfo.coreApi.readNamespacedPod(apiObj.involvedObject.name, apiObj.involvedObject.namespace).then( resp => {
    //                             let lensMessage:ILensMessageResponse = {
    //                                 msgtype: 'lensmessageresponse',
    //                                 id: '1',
    //                                 command: LensCommandEnum.WATCH,
    //                                 namespace: '',
    //                                 group: '',
    //                                 pod: '',
    //                                 container: '',
    //                                 action: InstanceMessageActionEnum.COMMAND,
    //                                 flow: InstanceMessageFlowEnum.UNSOLICITED,
    //                                 type: InstanceMessageTypeEnum.DATA,
    //                                 channel: 'lens',
    //                                 instance: instance.instanceId,
    //                                 event: apiObj.reason,
    //                                 data: resp.body
    //                             }
    //                             webSocket.send(JSON.stringify(lensMessage))
    //                         })
    //                         .catch(r => {
    //                             console.log('catch')
    //                             console.log('apiObj.involvedObject.name, apiObj.involvedObject.namespace')
    //                             console.log(apiObj.involvedObject.name, apiObj.involvedObject.namespace)
    //                         })
    //                     }
    //                 }
    //             },
    //             (err) => {
    //                 console.log("Watcher finalizado o error. Reiniciando en 5 segundos...")
    //                 setTimeout(this.startClusterEventWatcher, 5000, instance, webSocket)
    //             }
    //         )
    //     }
    //     catch (error : any) {
    //         console.log('Error al configurar el watcher:', error.message)
    //         console.log("Reiniciando en 5 segundos...")
    //         setTimeout(this.startClusterEventWatcher, 5000, instance, webSocket)
    //     }
    // }

    private async executeList (webSocket:WebSocket, instance:IInstance, params:string[]) {
        for (let param of params) {
            switch (param) {
                case 'pod':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPodForAllNamespaces())))
                    break
                case 'namespace':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNamespace())))
                    break
                case 'configmap':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listConfigMapForAllNamespaces())))
                    break
                case 'secret':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listSecretForAllNamespaces())))
                    break
                case 'node':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNode())))
                    break
                case 'service':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceForAllNamespaces())))
                    break
                case 'ingress':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressForAllNamespaces())))
                    break
                case 'deployment':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDeploymentForAllNamespaces())))
                    break
                case 'daemonset':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDaemonSetForAllNamespaces())))
                    break
                case 'replicaset':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listReplicaSetForAllNamespaces())))
                    break
                case 'statefulset':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listStatefulSetForAllNamespaces())))
                    break
                case 'persistentvolumeclaim':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolumeClaimForAllNamespaces())))
                    break
                case 'persistentvolume':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolume())))
                    break
                case 'storageclass':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.storageApi.listStorageClass())))
                    break
                case 'serviceaccount':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceAccountForAllNamespaces())))
                    break
                case 'clusterrole':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRole())))
                    break
                case 'role':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleForAllNamespaces())))
                    break
                case 'clusterrolebinding':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRoleBinding())))
                    break
                case 'rolebinding':
                    this.sendDataMessage(webSocket, instance, LensCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleBindingForAllNamespaces())))
                    break
                default:
                    console.log('invalid class: ', param)
                    this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, 'Invalid class: '+param)
                    break
            }
        }
    }
    
    private async executeDelete (webSocket:WebSocket, instance:IInstance, id:string, srcPath:string) {
    }

    private async executeCreate (webSocket:WebSocket, instance:IInstance, params:string[]) {
        for (let param of params) {
            try {
                const res = yaml.load(param)
                let result = await applyResource(res, this.clusterInfo)
                if (result!=='') {
                    this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result)
                }
            }
            catch (err:any) {
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err))
            }
        }
    }

}

export { LensChannel }