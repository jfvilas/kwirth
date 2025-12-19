import { FC } from 'react'
import { ChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { MagnifyInstanceConfig, MagnifyConfig } from './MagnifyConfig'
import { MagnifySetup, MagnifyIcon } from './MagnifySetup'
import { IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageEventEnum } from "@jfvilas/kwirth-common"
import { MagnifyCommandEnum, MagnifyData, IMagnifyMessageResponse, IMagnifyData } from './MagnifyData'
import { MagnifyTabContent } from './MagnifyTabContent'
import { v4 as uuid } from 'uuid'
import { ENotifyLevel } from '../../tools/Global'
import { IFileObject } from '@jfvilas/react-file-manager'

interface IMagnifyMessage extends IInstanceMessage {
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
    data?: any
}

export class MagnifyChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = MagnifySetup
    TabContent: FC<IContentProps> = MagnifyTabContent
    channelId = 'magnify'
    
    requiresSetup() { return false }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'magnify$read'}
    getChannelIcon(): JSX.Element { return MagnifyIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let msg:IMagnifyMessage = JSON.parse(wsEvent.data)

        let magnifyData:IMagnifyData = channelObject.data
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA: {
                let response = JSON.parse(wsEvent.data) as IMagnifyMessageResponse
                switch(response.action) {
                    case InstanceMessageActionEnum.COMMAND: {
                        switch(response.command) {
                            case MagnifyCommandEnum.CLUSTERINFO:
                                let cInfo = JSON.parse(response.data)
                                magnifyData.clusterInfo = cInfo
                                break
                            case MagnifyCommandEnum.LIST:
                            case MagnifyCommandEnum.LISTCRD:
                                let content = JSON.parse(response.data)
                                if (content.kind.endsWith('List')) {
                                    content.items.forEach( (item:any) => this.loadObject(channelObject, content.kind.replace('List',''), magnifyData, item) )
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'Unexpected list: '+ content.kind)
                                }
                                magnifyData.files = [...magnifyData.files]
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            case MagnifyCommandEnum.K8EVENT:
                                switch(response.event) {
                                    case 'ADDED':
                                    case 'MODIFIED':
                                        this.loadObject(channelObject, response.data.kind, magnifyData, response.data)
                                        break
                                    case 'DELETED':
                                        let path=this.buildPath(response.data.kind, response.data)
                                        magnifyData.files = magnifyData.files.filter (f => f.path !== path)
                                        break
                                }
                                magnifyData.files = [...magnifyData.files]
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            case MagnifyCommandEnum.DELETE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    // let fname = content.metadata.object
                                    // magnifyData.files = magnifyData.files.filter(f => f.path !== fname)
                                    // magnifyData.files = magnifyData.files.filter(f => !f.path.startsWith(fname+'/'))
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            }
                            case MagnifyCommandEnum.CREATE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    // magnifyData.files = magnifyData.files.filter(f => f.path !== content.metadata.object)
                                    // let f = { 
                                    //     name: (content.metadata.object as string).split('/').slice(-1)[0],
                                    //     isDirectory: (content.metadata.type===1),
                                    //     path: content.metadata.object,
                                    //     updatedAt: new Date(+content.metadata.time).toISOString(), 
                                    //     size: +content.metadata.size,
                                    //     ...(content.metadata.type.type===0? {class:'file'}:{})
                                    // }
                                    // magnifyData.files.push(f)
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            }
                        }
                    }
                }
                return {
                    action: ChannelRefreshAction.NONE
                }
            }
            case InstanceMessageTypeEnum.SIGNAL:
                let signalMessage = JSON.parse(wsEvent.data) as ISignalMessage
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE) {
                    if (signalMessage.action === InstanceMessageActionEnum.START) {
                        channelObject.instanceId = signalMessage.instance
                        // +++ improve timeout
                        setTimeout( () => {
                            let magnifyMessage:IMagnifyMessage = {
                                msgtype: 'magnifymessage',
                                accessKey: channelObject.accessString!,
                                instance: channelObject.instanceId,
                                id: uuid(),
                                namespace: '',
                                group: '',
                                pod: '',
                                container: '',
                                command: MagnifyCommandEnum.LIST,
                                action: InstanceMessageActionEnum.COMMAND,
                                flow: InstanceMessageFlowEnum.REQUEST,
                                type: InstanceMessageTypeEnum.DATA,
                                channel: 'magnify',
                                params: [
                                    'namespace', 'node',
                                    'service', 'ingress', 'ingressclass',
                                    'pod', 'deployment', 'daemonset', 'replicaset', 'statefulset', 'job', 'cronjob',
                                    'configmap', 'secret', 
                                    'persistentvolumeclaim', 'persistentvolume', 'storageclass',
                                    'serviceaccount', 'clusterrole', 'role', 'clusterrolebinding', 'rolebinding',
                                    'customresourcedefinition'
                                ]
                            }
                            channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))

                            magnifyMessage.command = MagnifyCommandEnum.CLUSTERINFO
                            magnifyMessage.id = uuid()
                            magnifyMessage.params = []
                            channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))
                        }, 300)
                    }
                    else if (signalMessage.action === InstanceMessageActionEnum.COMMAND) {
                        if (signalMessage.text) this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text)
                    }
                }
                if (signalMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    if (signalMessage.event === SignalMessageEventEnum.ADD) {
                    }
                    else if (signalMessage.event === SignalMessageEventEnum.DELETE) {
                    }
                    else {
                        if (signalMessage.text) this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text)
                    }
                }
                return {
                    action: ChannelRefreshAction.REFRESH
                }
            default:
                console.log(`Invalid message type ${msg.type}`)
                return {
                    action: ChannelRefreshAction.NONE
                }
        }
    }

    initChannel(channelObject:IChannelObject): boolean {        
        let config = new MagnifyConfig()
        config.notify = this.notify

        channelObject.instanceConfig = new MagnifyInstanceConfig()
        channelObject.config = config
        channelObject.data = new MagnifyData()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let magnifyData:IMagnifyData = channelObject.data
        magnifyData.paused = false
        magnifyData.started = true;
        magnifyData.currentPath='/overview'
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let magnifyData:IMagnifyData = channelObject.data
        magnifyData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let magnifyData:IMagnifyData = channelObject.data
        magnifyData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let magnifyData:IMagnifyData = channelObject.data
        magnifyData.paused = false
        magnifyData.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

    loadObject (channelObject:IChannelObject, kind:string, magnifyData:IMagnifyData, obj:any): void {
        if (kind==='Pod') this.loadPod(magnifyData, obj)
        else if (kind==='ConfigMap') this.loadConfigMap(magnifyData, obj)
        else if (kind==='Secret') this.loadSecret(magnifyData, obj)
        else if (kind==='Namespace') this.loadNamespace(magnifyData, obj)
        else if (kind==='Node') this.loadNode(magnifyData, obj)
        else if (kind==='Service') this.loadService(magnifyData, obj)
        else if (kind==='Ingress') this.loadIngress(magnifyData, obj)
        else if (kind==='IngressClass') this.loadIngressClass(magnifyData, obj)
        else if (kind==='Deployment') this.loadDeployment(magnifyData, obj)
        else if (kind==='DaemonSet') this.loadDaemonSet(magnifyData, obj)
        else if (kind==='ReplicaSet') this.loadReplicaSet(magnifyData, obj)
        else if (kind==='StatefulSet') this.loadStatefulSet(magnifyData, obj)
        else if (kind==='Job') this.loadJob(magnifyData, obj)
        else if (kind==='CronJob') this.loadCronJob(magnifyData, obj)
        else if (kind==='StorageClass') this.loadStorageClass(magnifyData, obj)
        else if (kind==='PersistentVolumeClaim') this.loadPersistentVolumeClaim(magnifyData, obj)
        else if (kind==='PersistentVolume') this.loadPersistentVolume(magnifyData, obj)
        else if (kind==='ServiceAccount') this.loadServiceAccount(magnifyData, obj)
        else if (kind==='ClusterRole') this.loadClusterRole(magnifyData, obj)
        else if (kind==='Role') this.loadRole(magnifyData, obj)
        else if (kind==='ClusterRoleBinding') this.loadClusterRoleBinding(magnifyData, obj)
        else if (kind==='RoleBinding') this.loadRoleBinding(magnifyData, obj)
        else if (kind==='CustomResourceDefinition') this.loadCustomResourceDefinition(channelObject, magnifyData, obj)
        else {
            if (!this.loadCustomResourceDefinitionInstance(magnifyData, obj)) {
                console.log('*** ERR INVALID Kind:', kind)
            }
        }
    }

    updateObject(magnifyData:IMagnifyData, obj:IFileObject): void {
        let i=magnifyData.files.findIndex(f => f.path === obj.path)
        if (i>=0)
            magnifyData.files[i]=obj
        else
            magnifyData.files.push(obj)
    }

    loadPod(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Pod'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/workload/pod/'+obj.metadata.name,
            class: 'pod',
            data: {
                namespace: obj.metadata.namespace,
                controller: obj.metadata.ownerReferences && obj.metadata.ownerReferences.length>0? obj.metadata.ownerReferences[0].kind : '-',
                node: obj.spec.nodeName,
                startTime: obj.status.startTime,
                status: obj.metadata.deletionTimestamp? 'Terminating' : obj.status.phase,
                restartCount: obj.status.containerStatuses?.reduce((ac:number,c:any) => ac+=c.restartCount, 0) || 0,
                origin: obj
            }
        })
    }

    loadNamespace(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Namespace'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/cluster/namespace/'+obj.metadata.name,
            class: 'namespace',
            data: {
                labels: '...',
                creationTimestamp: obj.metadata.creationTimestamp,
                status: obj.status?.phase,
                origin: obj
            }
        })
    }

    loadConfigMap(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ConfigMap'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/config/configmap/'+obj.metadata.name,
            class: 'configmap',
            data: {
                namespace: obj.metadata.namespace,
                keys: obj.data? Object.keys(obj.data).join(', ') : '',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadSecret(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Secret'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/config/secret/'+obj.metadata.name,
            class: 'secret',
            data: {
                namespace: obj.metadata.namespace,
                keys: obj.data? Object.keys(obj.data).join(', ') : '',
                creationTimestamp: obj.metadata.creationTimestamp,
                type: obj.type,
                origin: obj
            }
        })
    }

    loadNode(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Node'
        let roles:string[] = []
        Object.keys(obj.metadata.labels).forEach(c => {
            if (c.startsWith('node-role.kubernetes.io')) {
                if (obj.metadata.labels[c]==='true') roles.push(c.substring(24))
            }
        })
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Node', obj),
            class: 'node',
            data: {
                creationTimestamp: obj.metadata.creationTimestamp,
                taints: '',
                roles: roles.join(','),
                version: obj.status.nodeInfo.kubeletVersion,
                origin: obj
            }
        })
    }

    loadService(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Service'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Service', obj),
            class: 'service',
            data: {
                namespace: obj.metadata.namespace,
                type: obj.spec.type,
                clusterIp: obj.spec.clusterIP,
                ports: obj.spec?.ports?.map((p:any) => p.port+'/'+p.protocol).join(',') || '-',
                externalIp: obj.status?.loadBalancer?.ingress?.map((x:any) => x.ip).join(',') || '-',
                selector: '#',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadIngress(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'networking.k8s.io/v1'
        obj.kind = 'Ingress'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Ingress', obj),
            class: 'ingress',
            data: {
                namespace: obj.metadata.namespace,
                loadBalancers: obj.status?.loadBalancer?.ingress?.map((x:any)=> x.ip).join(','),
                rules: '#',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadIngressClass(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'networking.k8s.io/v1'
        obj.kind = 'IngressClass'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('IngressClass', obj),
            class: 'ingressclass',
            data: {
                namespace: obj.metadata.namespace,
                controller: obj.spec.controller,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadDeployment(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'Deployment'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Deployment', obj),
            class: 'deployment',
            data: {
                namespace: obj.metadata.namespace,
                pods: 0,
                replicas: obj.spec.replicas,
                creationTimestamp: obj.metadata.creationTimestamp,
                status: 'running',
                origin: obj
            }
        })
    }

    loadDaemonSet(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'DaemonSet'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('DaemonSet', obj),
            class: 'daemonset',
            data: {
                namespace: obj.metadata.namespace,
                desired: obj.status.desiredNumberScheduled,
                current: obj.status.currentNumberScheduled,
                ready: obj.status.numberReady,
                upToDate: obj.status.updatedNumberScheduled,
                available: obj.status.numberAvailable,
                nodeSelector: '-',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadReplicaSet(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'ReplicaSet'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('ReplicaSet', obj),
            class: 'replicaset',
            data: {
                namespace: obj.metadata.namespace,
                desired: obj.status.replicas,
                current: obj.status.availableReplicas,
                ready: obj.status.readyReplicas,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadStatefulSet(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'StatefulSet'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('StatefulSet', obj),
            class: 'statefulset',
            data: {
                namespace: obj.metadata.namespace,
                pods: 0,
                replicas: obj.spec.replicas,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadJob(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'Job'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Job', obj),
            class: 'job',
            data: {
                namespace: obj.metadata.namespace,
                completions: obj.spec.completions + '/' + obj.spec.parallelism,
                conditions: obj.status.conditions? obj.status.conditions.filter((c:any) => c.status.toLowerCase()==='true').map ((c:any) => c.name): '-',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadCronJob(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'CronJob'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('CronJob', obj),
            class: 'cronjob',
            data: {
                namespace: obj.metadata.namespace,
                schedule: obj.spec.schedule,
                suspend: obj.spec.suspend,
                active: '0',
                lastSchedule: obj.status.lastScheduleTime,
                nextExecution: '-',
                timezone: '-',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadStorageClass(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'StorageClass'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('StorageClass', obj),
            class: 'storageclass',
            data: {
                provisioner: obj.provisioner,
                reclaimPolicy: obj.reclaimPolicy,
                default: obj.metadata.annotations['storageclass.kubernetes.io/is-default-class'] === 'true'? 'Yes':'',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadPersistentVolumeClaim(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'PersistentVolumeClaim'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('PersistentVolumeClaim', obj),
            class: 'persistentvolumeclaim',
            data: {
                namespace: obj.metadata.namespace,
                storageClass: obj.spec.storageClassName,
                size: obj.status.capacity.storage,
                pods: 'n/a',
                creationTimestamp: obj.metadata.creationTimestamp,
                status: obj.status.phase,
                origin: obj
            }
        })
    }

    loadPersistentVolume(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'PersistentVolume'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('PersistentVolume', obj),
            class: 'persistentvolume',
            data: {
                storageClass: obj.spec.storageClassName,
                capacity: obj.spec.capacity.storage,
                claim: obj.spec.claimRef.name,
                creationTimestamp: obj.metadata.creationTimestamp,
                status: obj.status.phase,
                origin: obj
            }
        })
    }

    loadServiceAccount(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ServiceAccount'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('ServiceAccount', obj),
            class: 'serviceaccount',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadClusterRole(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'ClusterRole'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('ClusterRole', obj),
            class: 'clusterrole',
            data: {
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadRole(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'Role'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('Role', obj),
            class: 'role',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadClusterRoleBinding(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'ClusterRoleBinding'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('ClusterRoleBinding', obj),
            class: 'clusterrolebinding',
            data: {
                bindings: obj.subjects? obj.subjects.map((s:any) => s.name).join(',') : 'n/a',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadRoleBinding(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'RoleBinding'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('RoleBinding', obj),
            class: 'rolebinding',
            data: {
                namespace: obj.metadata.namespace,
                bindings: obj.subjects? obj.subjects.map((s:any) => s.name).join(',') : 'n/a',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    // loadCustomResourceDefinition(channelObject:IChannelObject, magnifyData:IMagnifyData, obj:any): void {
    //     obj.apiVersion = 'apiextensions.k8s.io/v1'
    //     obj.kind = 'CustomResourceDefinition'
    //     this.updateObject(magnifyData, {
    //         name: obj.metadata.name,
    //         isDirectory: false,
    //         path: this.buildPath('CustomResourceDefinition', obj),
    //         class: 'customresourcedefinition',
    //         data: {
    //             namespace: obj.metadata.namespace,
    //             group: obj.spec.group,
    //             version: obj.spec.versions && obj.spec.versions.length>0? obj.spec.versions[0].name : '-',
    //             scope: obj.spec.scope,
    //             creationTimestamp: obj.metadata.creationTimestamp,
    //             origin: obj
    //         }
    //     })

    //     // for each CRD, we request the exsitent objects in that CRD
    //     if (obj.spec.versions && obj.spec.versions.length>0) {
    //         let magnifyMessage:IMagnifyMessage = {
    //             msgtype: 'magnifymessage',
    //             accessKey: channelObject.accessString!,
    //             instance: channelObject.instanceId,
    //             id: uuid(),
    //             namespace: '',
    //             group: '',
    //             pod: '',
    //             container: '',
    //             command: MagnifyCommandEnum.LISTCRD,
    //             action: InstanceMessageActionEnum.COMMAND,
    //             flow: InstanceMessageFlowEnum.REQUEST,
    //             type: InstanceMessageTypeEnum.DATA,
    //             channel: 'magnify',
    //             params: [ obj.spec.group, obj.spec.versions[0].name, obj.spec.names.plural ]
    //         }
    //         channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))
    //     }
    // }

    // loadCustomResourceDefinitionInstance(magnifyData:IMagnifyData, obj:any): boolean {
    //     let groupName = obj.apiVersion.replace('/','-')+'-'+obj.kind.toLowerCase()
    //     if (!magnifyData.files.some(f => f.path ==='/crd/'+groupName)) {
    //         magnifyData.files.push( {
    //             name: `${obj.apiVersion} (${obj.kind})`,
    //             isDirectory: true,
    //             path: '/crd/'+groupName,
    //             class: 'crdgroup',
    //             children: 'crdinstance'
    //         })
    //     }

    //     this.updateObject(magnifyData, {
    //         name: obj.metadata.name,
    //         isDirectory: false,
    //         path: '/crd/'+groupName+'/'+obj.metadata.name,
    //         class: 'crdinstance',
    //         data: {
    //             namespace: obj.metadata.namespace,
    //             source: obj.spec.source,
    //             checksum: obj.spec.checksum,
    //             creationTimestamp: obj.metadata.creationTimestamp,
    //             origin: obj
    //         }
    //     })
    //     return true
    // }

    loadCustomResourceDefinition(channelObject:IChannelObject, magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apiextensions.k8s.io/v1'
        obj.kind = 'CustomResourceDefinition'
        let version = obj.spec.versions && obj.spec.versions.length>0? obj.spec.versions[0].name : '-'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: this.buildPath('CustomResourceDefinition', obj),
            class: 'customresourcedefinition',
            data: {
                namespace: obj.metadata.namespace,
                group: obj.spec.group,
                version: version,
                scope: obj.spec.scope,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })

        // for each CRD, we create an entry in the navigation pane for each group
        let groupName = obj.spec.group + (version?'-'+version:'') + '-' + obj.spec.names.kind.toLowerCase()
        magnifyData.files.push( {
            name: `${obj.spec.group}${(version?'/'+version:'')} (${obj.spec.names.kind.toLowerCase()})`,
            isDirectory: true,
            path: '/crd/'+groupName,
            class: 'crdgroup',
            children: 'crdinstance'
        })

        // for each CRD, we request the exsistent objects in that CRD
        if (obj.spec.versions && obj.spec.versions.length>0) {
            let magnifyMessage:IMagnifyMessage = {
                msgtype: 'magnifymessage',
                accessKey: channelObject.accessString!,
                instance: channelObject.instanceId,
                id: uuid(),
                namespace: '',
                group: '',
                pod: '',
                container: '',
                command: MagnifyCommandEnum.LISTCRD,
                action: InstanceMessageActionEnum.COMMAND,
                flow: InstanceMessageFlowEnum.REQUEST,
                type: InstanceMessageTypeEnum.DATA,
                channel: 'magnify',
                params: [ obj.spec.group, obj.spec.versions[0].name, obj.spec.names.plural ]
            }
            channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))
        }
    }

    loadCustomResourceDefinitionInstance(magnifyData:IMagnifyData, obj:any): boolean {
        let groupName = obj.apiVersion.replace('/','-')+'-'+obj.kind.toLowerCase()

        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/crd/'+groupName+'/'+obj.metadata.name,
            class: 'crdinstance',
            data: {
                namespace: obj.metadata.namespace,
                source: obj.spec.source,
                checksum: obj.spec.checksum,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
        return true
    }

    buildPath(kind:string, obj:any) {
        let section=''
        if (' Node Namespace '.includes(' '+kind+' ')) section='cluster'
        if (' ConfigMap Secret '.includes(' '+kind+' ')) section='config'
        if (' Ingress IngressClass Service '.includes(' '+kind+' ')) section='network'
        if (' Pod Deployment DaemonSet ReplicaSet StatefulSet Job CronJob '.includes(' '+kind+' ')) section='workload'
        if (' StorageClass PersistentVolumeClaim PersistentVolume '.includes(' '+kind+' ')) section='storage'
        if (' ServiceAccount ClusterRole Role ClusterRoleBinding RoleBinding '.includes(' '+kind+' ')) section='access'
        if (' CustomResourceDefinition '.includes(' '+kind+' ')) section='crd'
        return '/'+section+'/'+kind.toLowerCase()+'/'+obj.metadata.name
    }
}    
