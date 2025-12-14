import { FC } from 'react'
import { ChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { LensInstanceConfig, LensConfig } from './LensConfig'
import { LensSetup, LensIcon } from './LensSetup'
import { IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageEventEnum } from "@jfvilas/kwirth-common"
import { LensCommandEnum, LensData, ILensMessageResponse, ILensData } from './LensData'
import { LensTabContent } from './LensTabContent'
import { v4 as uuid } from 'uuid'
import { ENotifyLevel } from '../../tools/Global'
import { IFileObject } from '@jfvilas/react-file-manager'

interface ILensMessage extends IInstanceMessage {
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
    data?: any
}

export class LensChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = LensSetup
    TabContent: FC<IContentProps> = LensTabContent
    channelId = 'lens'
    
    requiresSetup() { return false }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresClusterUrl() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'lens$read'}
    getChannelIcon(): JSX.Element { return LensIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let msg:ILensMessage = JSON.parse(wsEvent.data)

        let lensData:ILensData = channelObject.data
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA: {
                let response = JSON.parse(wsEvent.data) as ILensMessageResponse
                switch(response.action) {
                    case InstanceMessageActionEnum.COMMAND: {
                        switch(response.command) {
                            case LensCommandEnum.LIST:
                                let content = JSON.parse(response.data)
                                if (content.kind.endsWith('List')) {
                                    content.items.forEach((o:any) => this.loadObject(content.kind.replace('List',''), lensData, o))
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'Unexpected list: '+ content.kind)
                                }
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            case LensCommandEnum.K8EVENT:
                                //console.log('k8Event:', response.event, response.data.metadata.namespace, response.data.metadata.name)
                                switch(response.event) {
                                    case 'ADDED':
                                    case 'MODIFIED':
                                        this.loadObject(response.data.kind, lensData, response.data)
                                        break
                                    case 'DELETED':
                                        let path=this.buildPath(response.data.kind, response.data)
                                        lensData.files = lensData.files.filter (f => f.path !== path)
                                        break
                                }
                                lensData.files = [...lensData.files]
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            case LensCommandEnum.DELETE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    // let fname = content.metadata.object
                                    // lensData.files = lensData.files.filter(f => f.path !== fname)
                                    // lensData.files = lensData.files.filter(f => !f.path.startsWith(fname+'/'))
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'ERROR: '+ (content.text || content.message))
                                }
                                return {
                                    action: ChannelRefreshAction.REFRESH
                                }
                            }
                            case LensCommandEnum.CREATE: {
                                let content = JSON.parse(response.data)
                                if (content.status==='Success') {
                                    // lensData.files = lensData.files.filter(f => f.path !== content.metadata.object)
                                    // let f = { 
                                    //     name: (content.metadata.object as string).split('/').slice(-1)[0],
                                    //     isDirectory: (content.metadata.type===1),
                                    //     path: content.metadata.object,
                                    //     updatedAt: new Date(+content.metadata.time).toISOString(), 
                                    //     size: +content.metadata.size,
                                    //     ...(content.metadata.type.type===0? {class:'file'}:{})
                                    // }
                                    // lensData.files.push(f)
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
                            let lensMessage:ILensMessage = {
                                msgtype: 'lensmessage',
                                accessKey: channelObject.accessString!,
                                instance: channelObject.instanceId,
                                id: uuid(),
                                namespace: '',
                                group: '',
                                pod: '',
                                container: '',
                                command: LensCommandEnum.LIST,
                                action: InstanceMessageActionEnum.COMMAND,
                                flow: InstanceMessageFlowEnum.REQUEST,
                                type: InstanceMessageTypeEnum.DATA,
                                channel: 'lens',
                                params: [
                                    'namespace', 'node',
                                    'service', 'ingress',
                                    'pod', 'deployment', 'daemonset', 'replicaset', 'statefulset',
                                    'configmap', 'secret', 
                                    'persistentvolumeclaim', 'persistentvolume', 'storageclass',
                                    'serviceaccount', 'clusterrole', 'role', 'clusterrolebinding', 'rolebinding'
                                ]
                            }
                            channelObject.webSocket!.send(JSON.stringify( lensMessage ))
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
        let config = new LensConfig()
        config.notify = this.notify

        channelObject.instanceConfig = new LensInstanceConfig()
        channelObject.config = config
        channelObject.data = new LensData()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let lensData:ILensData = channelObject.data
        lensData.paused = false
        lensData.started = true;
        lensData.currentPath='/overview'
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let lensData:ILensData = channelObject.data
        lensData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let lensData:ILensData = channelObject.data
        lensData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let lensData:ILensData = channelObject.data
        lensData.paused = false
        lensData.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

    loadObject (kind:string, lensData:ILensData, obj:any): void {
        if (kind==='Pod') this.loadPod(lensData, obj)
        else if (kind==='ConfigMap') this.loadConfigMap(lensData, obj)
        else if (kind==='Secret') this.loadSecret(lensData, obj)
        else if (kind==='Namespace') this.loadNamespace(lensData, obj)
        else if (kind==='Node') this.loadNode(lensData, obj)
        else if (kind==='Service') this.loadService(lensData, obj)
        else if (kind==='Ingress') this.loadIngress(lensData, obj)
        else if (kind==='Deployment') this.loadDeployment(lensData, obj)
        else if (kind==='DaemonSet') this.loadDaemonSet(lensData, obj)
        else if (kind==='ReplicaSet') this.loadReplicaSet(lensData, obj)
        else if (kind==='StatefulSet') this.loadStatefulSet(lensData, obj)
        else if (kind==='StorageClass') this.loadStorageClass(lensData, obj)
        else if (kind==='PersistentVolumeClaim') this.loadPersistentVolumeClaim(lensData, obj)
        else if (kind==='PersistentVolume') this.loadPersistentVolume(lensData, obj)
        else if (kind==='ServiceAccount') this.loadServiceAccount(lensData, obj)
        else if (kind==='ClusterRole') this.loadClusterRole(lensData, obj)
        else if (kind==='Role') this.loadRole(lensData, obj)
        else if (kind==='ClusterRoleBinding') this.loadClusterRoleBinding(lensData, obj)
        else if (kind==='RoleBinding') this.loadRoleBinding(lensData, obj)
        else {
            console.log('*** ERR INVALID Kind:', kind)
        }
    }

    updateObject(lensData:ILensData, obj:IFileObject): void {
        let i=lensData.files.findIndex(f => f.path === obj.path)
        if (i>=0)
            lensData.files[i]=obj
        else
            lensData.files.push(obj)
    }

    loadPod(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Pod'
        this.updateObject(lensData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/workload/pod/'+obj.metadata.name,
            class: 'pod',
            data: {
                namespace: obj.metadata.namespace,
                controller: obj.metadata.ownerReferences[0].kind,
                node: obj.spec.nodeName,
                startTime: obj.status.startTime,
                status: obj.status.phase,
                restartCount: obj.status.containerStatuses?.reduce((ac:number,c:any) => ac+=c.restartCount, 0) || 0,
                origin: obj
            }
        })
    }

    loadNamespace(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Namespace'
        this.updateObject(lensData, {
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

    loadConfigMap(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ConfigMap'
        this.updateObject(lensData, {
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

    loadSecret(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Secret'
        this.updateObject(lensData, {
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

    loadNode(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Node'
        let roles:string[] = []
        Object.keys(obj.metadata.labels).forEach(c => {
            if (c.startsWith('node-role.kubernetes.io')) {
                if (obj.metadata.labels[c]==='true') roles.push(c.substring(24))
            }
        })
        this.updateObject(lensData, {
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

    loadService(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Service'
        this.updateObject(lensData, {
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

    loadIngress(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'networking.k8s.io/v1'
        obj.kind = 'Ingress'
        this.updateObject(lensData, {
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

    loadDeployment(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'Deployment'
        this.updateObject(lensData, {
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

    loadDaemonSet(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'DaemonSet'
        this.updateObject(lensData, {
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

    loadReplicaSet(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'ReplicaSet'
        this.updateObject(lensData, {
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

    loadStatefulSet(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'apps/v1'
        obj.kind = 'StatefulSet'
        this.updateObject(lensData, {
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

    loadStorageClass(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'StorageClass'
        this.updateObject(lensData, {
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

    loadPersistentVolumeClaim(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'PersistentVolumeClaim'
        this.updateObject(lensData, {
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

    loadPersistentVolume(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'storage.k8s.io/v1'
        obj.kind = 'PersistentVolume'
        this.updateObject(lensData, {
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

    loadServiceAccount(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ServiceAccount'
        this.updateObject(lensData, {
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

    loadClusterRole(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'ClusterRole'
        this.updateObject(lensData, {
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

    loadRole(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'Role'
        this.updateObject(lensData, {
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

    loadClusterRoleBinding(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'ClusterRoleBinding'
        this.updateObject(lensData, {
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

    loadRoleBinding(lensData:ILensData, obj:any): void {
        obj.apiVersion = 'rbac.authorization.k8s.io/v1'
        obj.kind = 'RoleBinding'
        this.updateObject(lensData, {
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

    buildPath(kind:string, obj:any) {
        let section=''
        if ('Node Namespace'.includes(kind)) section='cluster'
        if ('ConfigMap Secret'.includes(kind)) section='config'
        if ('Ingress Service'.includes(kind)) section='network'
        if ('Pod Deployment DaemonSet ReplicaSet StatefulSet'.includes(kind)) section='workload'
        if ('StorageClass PersistentVolumeClaim PersistentVolume'.includes(kind)) section='storage'
        if ('ServiceAccount ClusterRole Role ClusterRoleBinding RoleBinding '.includes(kind)) section='access'
        return '/'+section+'/'+kind.toLowerCase()+'/'+obj.metadata.name
    }
}    
