import { FC } from 'react'
import { EChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { MagnifyInstanceConfig, MagnifyConfig } from './MagnifyConfig'
import { MagnifySetup, MagnifyIcon } from './MagnifySetup'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ESignalMessageEvent, IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageEventEnum } from "@jfvilas/kwirth-common"
import { EMagnifyCommand, MagnifyData, IMagnifyMessageResponse, IMagnifyData } from './MagnifyData'
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
    command: EMagnifyCommand
    params?: string[]
    data?: any
}

class MagnifyChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = MagnifySetup
    TabContent: FC<IContentProps> = MagnifyTabContent
    channelId = 'magnify'
    
    requiresSetup() { return false }
    requiresSettings() { return false }
    requiresMetrics() { return true }
    requiresAccessString() { return true }
    requiresFrontChannels() { return true }
    requiresClusterUrl() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'magnify$read'}
    getChannelIcon(): JSX.Element { return MagnifyIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        // +++
        // +++ very important: modifying 'files' re-renders, so it is important to decide if it necesary (it depends on current view in file manager)
        // +++

        let msg:IMagnifyMessage = JSON.parse(wsEvent.data)
        let magnifyData:IMagnifyData = channelObject.data

        
        // Implement commandAsync responses management
        if (msg.id && magnifyData.pendingWebSocketRequests.has(msg.id)) {
            const resolve = magnifyData.pendingWebSocketRequests.get(msg.id)
            resolve!(wsEvent.data)
            magnifyData.pendingWebSocketRequests.delete(msg.id)
            return {
                action: EChannelRefreshAction.NONE
            }
        }

        // general message management
        switch (msg.type) {
            case EInstanceMessageType.DATA: {
                let response = JSON.parse(wsEvent.data) as IMagnifyMessageResponse
                switch(response.action) {
                    case EInstanceMessageAction.COMMAND: {
                        switch(response.command) {
                            case EMagnifyCommand.CLUSTERINFO:
                                let cInfo = JSON.parse(response.data)
                                magnifyData.clusterInfo = cInfo
                                break
                            case EMagnifyCommand.LIST:
                            case EMagnifyCommand.LISTCRD:
                                let content = JSON.parse(response.data)
                                if (content.kind.endsWith('List')) {
                                    content.items.forEach( (item:any) => this.loadObject(channelObject, content.kind.replace('List',''), magnifyData, item) )
                                }
                                else {
                                    this.notify(ENotifyLevel.ERROR, 'Unexpected list: '+ content.kind)
                                }
                                magnifyData.files = [...magnifyData.files]
                                return {
                                    action: EChannelRefreshAction.REFRESH
                                }
                            case EMagnifyCommand.EVENTS:
                                let result:{type:string, events:any} = JSON.parse(response.data)
                                if (result.type==='cluster') {
                                    magnifyData.clusterEvents = result.events 
                                }
                                else {
                                    if (result.events) {
                                        result.events = result.events.sort( (a:any,b:any) => Date.parse(b.lastTimestamp)-Date.parse(a.lastTimestamp))  //+++ review
                                        for (let event of result.events) {
                                            let path = buildPath(event.involvedObject.kind, event.involvedObject.name)
                                            let obj = magnifyData.files.find(f => f.path === path)
                                            if ((obj && obj?.data.origin.metadata.namespace === event.involvedObject.namespace) || (obj && !event.involvedObject.namespace)) {
                                                if (!obj.data.events) {
                                                    obj.data.events = {}
                                                    obj.data.events.list = []
                                                }
                                                obj.data.events.list.push(event)
                                            }
                                        }
                                        magnifyData.files = [...magnifyData.files]
                                    }
                                }
                                return {
                                    action: EChannelRefreshAction.REFRESH
                                }
                            case EMagnifyCommand.K8EVENT:
                                switch(response.event) {
                                    case 'ADDED':
                                    case 'MODIFIED':
                                        this.loadObject(channelObject, response.data.kind, magnifyData, response.data)
                                        magnifyData.files = [...magnifyData.files]
                                        break
                                    case 'DELETED':
                                        let path=buildPath(response.data.kind, response.data.metadata.name)
                                        magnifyData.files = magnifyData.files.filter (f => f.path !== path)
                                        break
                                }
                                return {
                                    action: EChannelRefreshAction.REFRESH
                                }
                            case EMagnifyCommand.DELETE: {
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
                                    action: EChannelRefreshAction.REFRESH
                                }
                            }
                            case EMagnifyCommand.CREATE: {
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
                                    action: EChannelRefreshAction.REFRESH
                                }
                            }
                        }
                    }
                }
                return {
                    action: EChannelRefreshAction.NONE
                }
            }
            case EInstanceMessageType.SIGNAL:
                let signalMessage = JSON.parse(wsEvent.data) as ISignalMessage
                if (signalMessage.flow === EInstanceMessageFlow.RESPONSE) {
                    if (signalMessage.action === EInstanceMessageAction.START) {
                        channelObject.instanceId = signalMessage.instance
                        magnifyData.timers = this.createTimers(channelObject)

                        // +++ improve setTimeout mechanism (find something better!!!)
                        setTimeout( () => {
                            requestList(channelObject)
                            requestClusterInfo(channelObject)
                        }, 300)
                    }
                    else if (signalMessage.action === EInstanceMessageAction.COMMAND) {
                        if (signalMessage.text)this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text)
                    }
                }
                else if (signalMessage.flow === EInstanceMessageFlow.UNSOLICITED) {
                    if (signalMessage.event === ESignalMessageEvent.ADD) {
                    }
                    else if (signalMessage.event === ESignalMessageEvent.DELETE) {
                    }
                    else {
                        if (signalMessage.text) this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text)
                    }
                }
                return {
                    action: EChannelRefreshAction.REFRESH
                }
            default:
                console.log(`Invalid message type ${msg.type}`)
                return {
                    action: EChannelRefreshAction.NONE
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
        magnifyData.started = true
        magnifyData.files = magnifyData.files.filter(f => f.isDirectory && f.path.split('/').length-1 <= 2)
        magnifyData.files = magnifyData.files.filter(f => f.class!=='crdgroup')
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

    //*************************************************************************************************
    //*************************************************************************************************
    //*************************************************************************************************

    createTimers = (channelObject:IChannelObject) : number[] => {
        return [
            setInterval ( (c:IChannelObject, _forceNumberReturn:any) => {
                let magnifyMessage:IMagnifyMessage = {
                    msgtype: 'magnifymessage',
                    accessKey: channelObject.accessString!,
                    instance: channelObject.instanceId,
                    id: uuid(),
                    namespace: '',
                    group: '',
                    pod: '',
                    container: '',
                    command: EMagnifyCommand.EVENTS,
                    action: EInstanceMessageAction.COMMAND,
                    flow: EInstanceMessageFlow.REQUEST,
                    type: EInstanceMessageType.DATA,
                    channel: 'magnify',
                    params: [ 'cluster', '', '', '', '10']
                }
                c.webSocket!.send(JSON.stringify( magnifyMessage ))
            }, 60000, channelObject)
        ]
    }

    loadObject (channelObject:IChannelObject, kind:string, magnifyData:IMagnifyData, obj:any): void {
        if (kind==='Pod') this.loadPod(magnifyData, obj)
        else if (kind==='ConfigMap') this.loadConfigMap(magnifyData, obj)
        else if (kind==='Secret') this.loadSecret(magnifyData, obj)
        else if (kind==='ResourceQuota') this.loadResourceQuota(magnifyData, obj)
        else if (kind==='LimitRange') this.loadLimitRange(magnifyData, obj)
        else if (kind==='HorizontalPodAutoscaler') this.loadHorizontalPodAutoscaler(magnifyData, obj)
        else if (kind==='PodDisruptionBudget') this.loadPodDisruptionBudget(magnifyData, obj)
        else if (kind==='PriorityClass') this.loadPriorityClass(magnifyData, obj)
        else if (kind==='RuntimeClass') this.loadRuntimeClass(magnifyData, obj)
        else if (kind==='Lease') this.loadLease(magnifyData, obj)
        else if (kind==='ValidatingWebhookConfiguration') this.loadValidatingWebhookConfiguration(magnifyData, obj)
        else if (kind==='MutatingWebhookConfiguration') this.loadMutatingWebhookConfiguration(magnifyData, obj)
        else if (kind==='Namespace') this.loadNamespace(magnifyData, obj)
        else if (kind==='Node') this.loadNode(magnifyData, obj)
        else if (kind==='Service') this.loadService(magnifyData, obj)
        else if (kind==='Endpoints') this.loadEndpoints(magnifyData, obj)
        else if (kind==='Ingress') this.loadIngress(magnifyData, obj)
        else if (kind==='IngressClass') this.loadIngressClass(magnifyData, obj)
        else if (kind==='NetworkPolicy') this.loadNetworkPolicy(magnifyData, obj)
        else if (kind==='Deployment') this.loadDeployment(magnifyData, obj)
        else if (kind==='DaemonSet') this.loadDaemonSet(magnifyData, obj)
        else if (kind==='ReplicaSet') this.loadReplicaSet(magnifyData, obj)
        else if (kind==='ReplicationController') this.loadReplicationController(magnifyData, obj)
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
            path: buildPath('Pod', obj.metadata.name),
            class: 'Pod',
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
        //+++ resquest resources snapshot
    }

    loadNamespace(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Namespace'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('Namespace', obj.metadata.name),
            class: 'Namespace',
            data: {
                creationTimestamp: obj.metadata.creationTimestamp,
                status: obj.status?.phase,
                origin: obj
            }
        })
        //+++ resquest namespace resources snapshot
    }

    loadConfigMap(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ConfigMap'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('ConfigMap', obj.metadata.name),
            class: 'ConfigMap',
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
            path: buildPath('Secret', obj.metadata.name),
            class: 'Secret',
            data: {
                namespace: obj.metadata.namespace,
                keys: obj.data? Object.keys(obj.data).join(', ') : '',
                creationTimestamp: obj.metadata.creationTimestamp,
                type: obj.type,
                origin: obj
            }
        })
    }

    loadResourceQuota(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ResourceQuota'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/config/ResourceQuota/'+obj.metadata.name,
            class: 'ResourceQuota',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadLimitRange(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'LimitRange'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: '/config/LimitRange/'+obj.metadata.name,
            class: 'LimitRange',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadHorizontalPodAutoscaler(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'autoscaling/v2'
        obj.kind = 'HorizontalPodAutoscaler'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('HorizontalPodAutoscaler', obj.metadata.name),
            class: 'HorizontalPodAutoscaler',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadPodDisruptionBudget(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'policy/v1'
        obj.kind = 'PodDisruptionBudget'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('PodDisruptionBudget', obj.metadata.name),
            class: 'PodDisruptionBudget',
            data: {
                namespace: obj.metadata.namespace,
                minAvailable: obj.spec.minAvailable || 'N/A',
                maxUnavailable: obj.spec.maxUnavailable || 'N/A',
                currentHealthy: obj.status.currentHealthy,
                desiredHealthy: obj.status.desiredHealthy,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadPriorityClass(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'scheduling.k8s.io/v1'
        obj.kind = 'PriorityClass'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('PriorityClass', obj.metadata.name),
            class: 'PriorityClass',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadRuntimeClass(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'node.k8s.io/v1'
        obj.kind = 'RuntimeClass'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('RuntimeClass', obj.metadata.name),
            class: 'RuntimeClass',
            data: {
                namespace: obj.metadata.namespace,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadLease(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'node.k8s.io/v1'
        obj.kind = 'Lease'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('Lease', obj.metadata.name),
            class: 'Lease',
            data: {
                namespace: obj.metadata.namespace,
                holder: obj.spec.holderIdentity,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadValidatingWebhookConfiguration(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'admissionregistration.k8s.io/v1'
        obj.kind = 'ValidatingWebhookConfiguration'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('ValidatingWebhookConfiguration', obj.metadata.name),
            class: 'ValidatingWebhookConfiguration',
            data: {
                webhooks: obj.webhooks.length,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadMutatingWebhookConfiguration(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'admissionregistration.k8s.io/v1'
        obj.kind = 'MutatingWebhookConfiguration'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('MutatingWebhookConfiguration', obj.metadata.name),
            class: 'MutatingWebhookConfiguration',
            data: {
                webhooks: obj.webhooks.length,
                creationTimestamp: obj.metadata.creationTimestamp,
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
            path: buildPath('Node', obj.metadata.name),
            class: 'Node',
            data: {
                creationTimestamp: obj.metadata.creationTimestamp,
                taints: obj.spec.taints? obj.spec.taints.length : 0,
                roles: roles.join(','),
                conditions: obj.spec.unschedulable === true? 'Unschedulable' : obj.status.conditions.filter((c:any) => c.status==='True').map((c:any) => c.type).join(' '),
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
            path: buildPath('Service', obj.metadata.name),
            class: 'Service',
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

    loadEndpoints(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'Endpoints'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('Endpoints', obj.metadata.name),
            class: 'Endpoints',
            data: {
                namespace: obj.metadata.namespace,
                endpoints: obj.subsets ? obj.subsets?.map((subset:any) => subset.addresses?.map((a:any) => subset.ports?.map((p:any) => a.ip+':'+p.port)).join(',')) :'',
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
            path: buildPath('Ingress', obj.metadata.name),
            class: 'Ingress',
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
            path: buildPath('IngressClass', obj.metadata.name),
            class: 'IngressClass',
            data: {
                namespace: obj.metadata.namespace,
                controller: obj.spec.controller,
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadNetworkPolicy(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'networking.k8s.io/v1'
        obj.kind = 'NetworkPolicy'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('NetworkPolicy', obj.metadata.name),
            class: 'NetworkPolicy',
            data: {
                namespace: obj.metadata.namespace,
                policyTypes: obj.spec.policyTypes?obj.spec.policyTypes.join(',') : '',
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
            path: buildPath('Deployment', obj.metadata.name),
            class: 'Deployment',
            data: {
                namespace: obj.metadata.namespace,
                pods: 0,
                replicas: obj.spec.replicas,
                creationTimestamp: obj.metadata.creationTimestamp,
                status: 'running',  //+++
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
            path: buildPath('DaemonSet', obj.metadata.name),
            class: 'DaemonSet',
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
            path: buildPath('ReplicaSet', obj.metadata.name),
            class: 'ReplicaSet',
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

    loadReplicationController(magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'v1'
        obj.kind = 'ReplicationController'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('ReplicationController', obj.metadata.name),
            class: 'ReplicationController',
            data: {
                namespace: obj.metadata.namespace,
                replicas: obj.status.replicas,
                desired: obj.spec.replicas,
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
            path: buildPath('StatefulSet', obj.metadata.name),
            class: 'StatefulSet',
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
        obj.apiVersion = 'batch/v1'
        obj.kind = 'Job'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('Job', obj.metadata.name),
            class: 'Job',
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
        obj.apiVersion = 'batch/v1'
        obj.kind = 'CronJob'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('CronJob', obj.metadata.name),
            class: 'CronJob',
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
            path: buildPath('StorageClass', obj.metadata.name),
            class: 'StorageClass',
            data: {
                provisioner: obj.provisioner,
                reclaimPolicy: obj.reclaimPolicy,
                default: (obj.metadata?.annotations && obj.metadata.annotations['storageclass.kubernetes.io/is-default-class'] === 'true'? 'Yes':'') || '',
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
            path: buildPath('PersistentVolumeClaim', obj.metadata.name),
            class: 'PersistentVolumeClaim',
            data: {
                namespace: obj.metadata.namespace,
                storageClass: obj.spec.storageClassName,
                size: obj.status?.capacity?.storage,
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
            path: buildPath('PersistentVolume', obj.metadata.name),
            class: 'PersistentVolume',
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
            path: buildPath('ServiceAccount', obj.metadata.name),
            class: 'ServiceAccount',
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
            path: buildPath('ClusterRole', obj.metadata.name),
            class: 'ClusterRole',
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
            path: buildPath('Role', obj.metadata.name),
            class: 'Role',
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
            path: buildPath('ClusterRoleBinding', obj.metadata.name),
            class: 'ClusterRoleBinding',
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
            path: buildPath('RoleBinding', obj.metadata.name),
            class: 'RoleBinding',
            data: {
                namespace: obj.metadata.namespace,
                bindings: obj.subjects? obj.subjects.map((s:any) => s.name).join(',') : 'n/a',
                creationTimestamp: obj.metadata.creationTimestamp,
                origin: obj
            }
        })
    }

    loadCustomResourceDefinition(channelObject:IChannelObject, magnifyData:IMagnifyData, obj:any): void {
        obj.apiVersion = 'apiextensions.k8s.io/v1'
        obj.kind = 'CustomResourceDefinition'
        let version = obj.spec.versions && obj.spec.versions.length>0? obj.spec.versions[0].name : '-'
        this.updateObject(magnifyData, {
            name: obj.metadata.name,
            isDirectory: false,
            path: buildPath('CustomResourceDefinition', obj.metadata.name),
            class: 'CustomResourceDefinition',
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
            path: '/custom/'+groupName,
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
                command: EMagnifyCommand.LISTCRD,
                action: EInstanceMessageAction.COMMAND,
                flow: EInstanceMessageFlow.REQUEST,
                type: EInstanceMessageType.DATA,
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
            path: '/custom/'+groupName+'/'+obj.metadata.name,
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

}    

const buildPath = (kind:string, name:string) => {
    let section=''
    if (' Node Namespace '.includes(' '+kind+' ')) section='cluster'
    if (' Pod Deployment DaemonSet ReplicaSet ReplicationController StatefulSet Job CronJob '.includes(' '+kind+' ')) section='workload'
    if (' ConfigMap Secret ResourceQuota LimitRange HorizontalPodAutoscaler PodDisruptionBudget PriorityClass RuntimeClass Lease ValidatingWebhookConfiguration MutatingWebhookConfiguration '.includes(' '+kind+' ')) section='config'
    if (' Service Endpoints Ingress IngressClass NetworkPolicy '.includes(' '+kind+' ')) section='network'
    if (' StorageClass PersistentVolumeClaim PersistentVolume '.includes(' '+kind+' ')) section='storage'
    if (' ServiceAccount ClusterRole Role ClusterRoleBinding RoleBinding '.includes(' '+kind+' ')) section='access'
    if (' CustomResourceDefinition '.includes(' '+kind+' ')) section='custom'
    return '/'+section+'/'+kind+'/'+name
}

const requestClusterInfo = (channelObject: IChannelObject) => {
    let magnifyMessage:IMagnifyMessage = {
        msgtype: 'magnifymessage',
        accessKey: channelObject.accessString!,
        instance: channelObject.instanceId,
        id: uuid(),
        namespace: '',
        group: '',
        pod: '',
        container: '',
        command: EMagnifyCommand.CLUSTERINFO,
        action: EInstanceMessageAction.COMMAND,
        flow: EInstanceMessageFlow.REQUEST,
        type: EInstanceMessageType.DATA,
        channel: 'magnify',
        params: []
    }
    channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))
}

const requestList = (channelObject: IChannelObject) => {
    let magnifyMessage:IMagnifyMessage = {
        msgtype: 'magnifymessage',
        accessKey: channelObject.accessString!,
        instance: channelObject.instanceId,
        id: uuid(),
        namespace: '',
        group: '',
        pod: '',
        container: '',
        command: EMagnifyCommand.LIST,
        action: EInstanceMessageAction.COMMAND,
        flow: EInstanceMessageFlow.REQUEST,
        type: EInstanceMessageType.DATA,
        channel: 'magnify',
        params: [
            'Namespace', 'Node',
            'Service', 'Endpoints', 'Ingress', 'IngressClass', 'NetworkPolicy',
            'Pod', 'Deployment', 'DaemonSet', 'ReplicaSet', 'ReplicationController', 'StatefulSet', 'Job', 'CronJob',
            'ConfigMap', 'Secret', 'ResourceQuota', 'LimitRange', 'HorizontalPodAutoscaler', 'PodDisruptionBudget', 'PriorityClass','RuntimeClass', 'Lease', 'ValidatingWebhookConfiguration', 'MutatingWebhookConfiguration',
            'PersistentVolumeClaim', 'PersistentVolume', 'StorageClass',
            'ServiceAccount', 'ClusterRole', 'Role', 'ClusterRoleBinding', 'RoleBinding',
            'CustomResourceDefinition'
        ]
    }
    channelObject.webSocket!.send(JSON.stringify( magnifyMessage ))
}

export { MagnifyChannel, buildPath, requestList }