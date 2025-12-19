import { IInstanceConfig, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, IInstanceConfigResponse, parseResources } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel'
import { Request, Response } from 'express'
import { Watch } from '@kubernetes/client-node'
import { applyResource, nodeCordon, nodeDrain, nodeUnCordon, throttleExcute } from '../../tools/KubernetesTools'
const yaml = require('js-yaml')

export interface IMagnifyConfig {
    interval: number
}

export enum MagnifyCommandEnum {
    CREATE = 'create',
    DELETE = 'delete',
    LIST = 'list',
    CLUSTERINFO = 'clusterinfo',
    LISTCRD = 'listcrd',
    WATCH = 'watch',
    K8EVENT = 'k8event',
    NODECORDON = 'nodecordon',
    NODEUNCORDON = 'nodeuncordon',
    NODEDRAIN = 'nodedrainn'
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
    clusterInfo : ClusterInfo
    webSockets: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    //+++ add dispose to IChannel (and implment in this channel a remove to "events subscription")

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
        console.log('****', type, obj.kind, obj.metadata.namespace, obj.metadata.name)
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

    // private sendUnsolicitedMessage = (webSocket:WebSocket, instanceId:string, command: MagnifyCommandEnum, data:any): void => {
    //     let resp: IMagnifyMessageResponse = {
    //         action: InstanceMessageActionEnum.COMMAND,
    //         flow: InstanceMessageFlowEnum.UNSOLICITED,
    //         channel: 'magnify',
    //         instance: instanceId,
    //         type: InstanceMessageTypeEnum.DATA,
    //         id: '1',
    //         command,
    //         namespace: '',
    //         group: '',
    //         pod: '',
    //         container: '',
    //         data,
    //         msgtype: 'magnifymessageresponse'
    //     }
    //     webSocket.send(JSON.stringify(resp))
    // }

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
                console.log(await this.clusterInfo.versionApi.getCode())
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.CLUSTERINFO, JSON.stringify((await this.clusterInfo.versionApi.getCode())))
                break

            case MagnifyCommandEnum.NODECORDON:
                await nodeCordon(this.clusterInfo.coreApi, magnifyMessage.params![0])
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.CLUSTERINFO, JSON.stringify((await this.clusterInfo.versionApi.getCode())))
                break

            case MagnifyCommandEnum.NODEUNCORDON:
                await nodeUnCordon(this.clusterInfo.coreApi, magnifyMessage.params![0])
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.CLUSTERINFO, JSON.stringify((await this.clusterInfo.versionApi.getCode())))
                break

            case MagnifyCommandEnum.NODEDRAIN:
                await nodeDrain(this.clusterInfo.coreApi, magnifyMessage.params![0])
                this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.CLUSTERINFO, JSON.stringify((await this.clusterInfo.versionApi.getCode())))
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
            case MagnifyCommandEnum.DELETE: {
                console.log(`Do DELETE ${magnifyMessage.params![0]} in ${magnifyMessage.namespace}/${magnifyMessage.pod}/${magnifyMessage.container}`)
                this.executeDelete(webSocket, instance, '1', magnifyMessage.params![0])
                return
            }

            default:
                execResponse.data = `Invalid command '${magnifyMessage.command}'. Valid commands are: ${Object.keys(MagnifyCommandEnum)}`
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
    //                             let magnifyMessage:IMagnifyMessageResponse = {
    //                                 msgtype: 'magnifymessageresponse',
    //                                 id: '1',
    //                                 command: MagnifyCommandEnum.WATCH,
    //                                 namespace: '',
    //                                 group: '',
    //                                 pod: '',
    //                                 container: '',
    //                                 action: InstanceMessageActionEnum.COMMAND,
    //                                 flow: InstanceMessageFlowEnum.UNSOLICITED,
    //                                 type: InstanceMessageTypeEnum.DATA,
    //                                 channel: 'magnify',
    //                                 instance: instance.instanceId,
    //                                 event: apiObj.reason,
    //                                 data: resp.body
    //                             }
    //                             webSocket.send(JSON.stringify(magnifyMessage))
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
        try {
            throttleExcute(async () => {
                for (let param of params) {
                    switch (param) {
                        case 'pod':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPodForAllNamespaces())))
                            break
                        case 'node':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNode())))
                            break
                        case 'namespace':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNamespace())))
                            break
                        case 'configmap':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listConfigMapForAllNamespaces())))
                            break
                        case 'secret':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listSecretForAllNamespaces())))
                            break
                        case 'service':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceForAllNamespaces())))
                            break
                        case 'ingress':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressForAllNamespaces())))
                            break
                        case 'ingressclass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressClass())))
                            break
                        case 'deployment':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDeploymentForAllNamespaces())))
                            break
                        case 'daemonset':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDaemonSetForAllNamespaces())))
                            break
                        case 'replicaset':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listReplicaSetForAllNamespaces())))
                            break
                        case 'statefulset':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listStatefulSetForAllNamespaces())))
                            break
                        case 'job':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listJobForAllNamespaces())))
                            break
                        case 'cronjob':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listCronJobForAllNamespaces())))
                            break
                        case 'persistentvolumeclaim':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolumeClaimForAllNamespaces())))
                            break
                        case 'persistentvolume':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolume())))
                            break
                        case 'storageclass':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.storageApi.listStorageClass())))
                            break
                        case 'serviceaccount':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceAccountForAllNamespaces())))
                            break
                        case 'clusterrole':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRole())))
                            break
                        case 'role':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleForAllNamespaces())))
                            break
                        case 'clusterrolebinding':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRoleBinding())))
                            break
                        case 'rolebinding':
                            this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleBindingForAllNamespaces())))
                            break
                        case 'customresourcedefinition':
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

    // private async executeList (webSocket:WebSocket, instance:IInstance, params:string[]) {
    //     for (let param of params) {
    //         switch (param) {
    //             case 'pod':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPodForAllNamespaces())))
    //                 break

    //             case 'node':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNode())))
    //                 break
    //             case 'namespace':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listNamespace())))
    //                 break

    //             case 'configmap':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listConfigMapForAllNamespaces())))
    //                 break
    //             case 'secret':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listSecretForAllNamespaces())))
    //                 break
    //             case 'service':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceForAllNamespaces())))
    //                 break
    //             case 'ingress':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressForAllNamespaces())))
    //                 break
    //             case 'ingressclass':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.networkApi.listIngressClass())))
    //                 break
    //             case 'deployment':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDeploymentForAllNamespaces())))
    //                 break
    //             case 'daemonset':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listDaemonSetForAllNamespaces())))
    //                 break
    //             case 'replicaset':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listReplicaSetForAllNamespaces())))
    //                 break
    //             case 'statefulset':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.appsApi.listStatefulSetForAllNamespaces())))
    //                 break
    //             case 'job':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listJobForAllNamespaces())))
    //                 break
    //             case 'cronjob':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.batchApi.listCronJobForAllNamespaces())))
    //                 break
    //             case 'persistentvolumeclaim':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolumeClaimForAllNamespaces())))
    //                 break
    //             case 'persistentvolume':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listPersistentVolume())))
    //                 break
    //             case 'storageclass':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.storageApi.listStorageClass())))
    //                 break
    //             case 'serviceaccount':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.coreApi.listServiceAccountForAllNamespaces())))
    //                 break
    //             case 'clusterrole':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRole())))
    //                 break
    //             case 'role':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleForAllNamespaces())))
    //                 break
    //             case 'clusterrolebinding':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listClusterRoleBinding())))
    //                 break
    //             case 'rolebinding':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.rbacApi.listRoleBindingForAllNamespaces())))
    //                 break
    //             case 'customresourcedefinition':
    //                 this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LIST, JSON.stringify((await this.clusterInfo.extensionApi.listCustomResourceDefinition())))
    //                 break
    //             default:
    //                 console.log('invalid class: ', param)
    //                 this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, 'Invalid class: '+param)
    //                 break
    //         }
    //     }
    // }
    
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

    // private async executeListCrd (webSocket:WebSocket, instance:IInstance, params:string[]) {
    //     let repeat = true
    //     while (repeat) {
    //         repeat = false
    //         try {
    //             let resp = await this.clusterInfo.crdApi.listCustomObjectForAllNamespaces({
    //                 group: params[0],
    //                 version: params[1],
    //                 plural: params[2]
    //             })
    //             this.sendDataMessage(webSocket, instance, MagnifyCommandEnum.LISTCRD, JSON.stringify(resp))
    //         }
    //         catch (err:any) {
    //             if (err.code === 429) {
    //                 repeat = true
    //                 await new Promise ( (resolve) => { setTimeout(resolve, (+err.headers['retry-after']||1)*1000)})
    //             }
    //             else {
    //                 console.log(err)
    //                 this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, JSON.stringify(err.body))
    //             }
    //         }
    //     }
    // }
    
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

export { MagnifyChannel }