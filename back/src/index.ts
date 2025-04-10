import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod, V1ObjectMeta, V1PodSpec, V1Container } from '@kubernetes/client-node'
import Docker from 'dockerode'
import { ConfigApi } from './api/ConfigApi'
import { KubernetesSecrets } from './tools/KubernetesSecrets'
import { KubernetesConfigMaps } from './tools/KubernetesConfigMaps'
import { VERSION } from './version'

// HTTP server for serving front, api and websockets
import { StoreApi } from './api/StoreApi'
import { UserApi } from './api/UserApi'
import { ApiKeyApi } from './api/ApiKeyApi'
import { LoginApi } from './api/LoginApi'

// HTTP server & websockets
import WebSocket from 'ws'
import { ManageKwirthApi } from './api/ManageKwirthApi'
import { InstanceConfigActionEnum, InstanceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResources, ResourceIdentifier, KwirthData, InstanceConfigChannelEnum, InstanceConfig, SignalMessage, SignalMessageLevelEnum, InstanceConfigViewEnum, InstanceMessageTypeEnum, IChannel, ClusterTypeEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getChannelScopeLevel, validBearerKey } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'

import express, { Request, Response} from 'express'
import { ClusterInfo, NodeInfo } from './model/ClusterInfo'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuidv4 } from 'uuid'

import { Metrics } from './tools/MetricsTools'
import { LogChannel } from './channels/LogChannel'
import { AlertChannel } from './channels/AlertChannel'
import { MetricsChannel } from './channels/MetricsChannel'
import { ISecrets } from './tools/ISecrets'
import { IConfigMaps } from './tools/IConfigMap'
import { DockerSecrets } from './tools/DockerSecrets'
import { DockerConfigMaps } from './tools/DockerConfigMaps'

const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883

const channels : Map<string, IChannel> = new Map()

// Kubernetes API access
const kubeConfig = new KubeConfig()
kubeConfig.loadFromDefault()
const coreApi = kubeConfig.makeApiClient(CoreV1Api)
const appsApi = kubeConfig.makeApiClient(AppsV1Api)
const logApi = new Log(kubeConfig)
var dockerApi: Docker = new Docker()
var thisKwirthData: KwirthData

var saToken: ServiceAccountToken
var secrets: ISecrets
var configMaps: IConfigMaps
const rootPath = process.env.KWIRTH_ROOTPATH || ''

const getExecutionEnvironment = async ():Promise<string> => {
    console.log('Detecting execution environment...')

    // we keep this order of detection, since kubernetes also has a docker engine
    console.log('Trying Kubernetes...')
    try {
        await coreApi.listPodForAllNamespaces()
        return 'kubernetes'
    }
    catch {}

    console.log('Trying WinDocker...')
    try {
        dockerApi = new Docker({ socketPath: '//./pipe/docker_engine' })
        return 'windocker'
    }
    catch {}

    console.log('Trying LinuxDocker...')
    try {
        let ld = new Docker()
        return 'linuxdocker'
    }
    catch {}

    return 'undetected'
}

// get the namespace where Kwirth is running on
const getMyKubernetesData = async ():Promise<KwirthData> => {
    var podName=process.env.HOSTNAME
    var depName=''
    const pods = await coreApi.listPodForAllNamespaces()
    const pod = pods.body.items.find(p => p.metadata?.name === podName)  
    if (pod && pod.metadata?.namespace) {

        if (pod.metadata.ownerReferences) {
            for (const owner of pod.metadata.ownerReferences) {
                if (owner.kind === 'ReplicaSet') {
                    const rs = await appsApi.readNamespacedReplicaSet(owner.name, pod.metadata.namespace)
                    if (rs.body.metadata && rs.body.metadata.ownerReferences) {
                        for (const rsOwner of rs.body.metadata.ownerReferences) {
                            if (rsOwner.kind === 'Deployment') depName=rsOwner.name
                        }
                    }
                }
            }
        }
        return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true, version:VERSION, lastVersion: VERSION, clusterType: ClusterTypeEnum.KUBERNETES }
    }
    else {
        // this namespace will be used to access secrets and configmaps
        return { clusterName: 'inCluster', namespace:'default', deployment:'', inCluster:false, version:VERSION, lastVersion: VERSION, clusterType: ClusterTypeEnum.KUBERNETES }
    }
}

const sendChannelSignal = (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig) => {
    if (channels.has(instanceConfig.channel)) {
        var sgnMsg:SignalMessage = {
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }
    else {
        console.log(`Unsupported channel ${instanceConfig.channel}`)
    }
}

const sendInstanceConfigSignalMessage = (ws:WebSocket, action:InstanceConfigActionEnum, flow: InstanceConfigFlowEnum, channel: string, instanceConfig:InstanceConfig, text:string) => {
    var resp:any = {
        action,
        flow,
        channel,
        instance: instanceConfig.instance,
        ...(instanceConfig.reconnectKey && { reconnectKey: instanceConfig.reconnectKey }),
        type: 'signal',
        text
    }
    ws.send(JSON.stringify(resp))
}

const addObject = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, instanceConfig:InstanceConfig) => {
    console.log(`startPodInstance '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)

    sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Container ADDED: ${podNamespace}/${podName}/${containerName}`, instanceConfig)
    if(channels.has(instanceConfig.channel)) {
        channels.get(instanceConfig.channel)?.startInstance(webSocket, instanceConfig, podNamespace, podName, containerName)
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

const modifyObject = async (eventType:string, podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    if(channels.has(instanceConfig.channel)) {
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

const deleteObject = async (eventType:string, podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    if(channels.has(instanceConfig.channel)) {
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

const processEvent = (eventType:string, webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containers:string[]) => {
    if (eventType === 'ADDED') {
        for (var container of containers) {
            let containerName = container
            switch (instanceConfig.view) {
                case InstanceConfigViewEnum.NAMESPACE:
                    addObject(webSocket, podNamespace, podName, containerName, instanceConfig)
                    break
                case InstanceConfigViewEnum.GROUP:
                    var [_groupType, groupName] = instanceConfig.group.split('+')
                    if (podName.startsWith(groupName)) {  // we rely on kubernetes naming conventions here (we could query k8 api to discover group the pod belongs to)
                        addObject(webSocket, podNamespace, podName, containerName, instanceConfig)
                    }
                    break
                case InstanceConfigViewEnum.POD:
                    if ((instanceConfig.namespace==='' || (instanceConfig.namespace!=='' && instanceConfig.namespace.split(',').includes(podNamespace))) && instanceConfig.pod.split(',').includes(podName)) {
                        if (instanceConfig.pod.split(',').includes(podName)) {
                            console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName}`)
                            addObject(webSocket, podNamespace, podName, containerName, instanceConfig)
                        }
                    }
                    break
                case InstanceConfigViewEnum.CONTAINER:
                    // container has the form: podname+containername (includes a plus sign as separating char)
                    var icContainers = Array.from (new Set (instanceConfig.container.split(',').map (c => c.split('+')[1])))
                    var scPods = Array.from (new  Set (instanceConfig.container.split(',').map (c => c.split('+')[0])))
                    console.log('sccontainers')
                    console.log(scPods)
                    console.log(icContainers)
                    console.log(containerName)
                    if (icContainers.includes(containerName) && scPods.includes(podName)) {
                        if (instanceConfig.container.split(',').includes(podName+'+'+containerName)) {
                            console.log(`Container ADDED: ${podNamespace}/${podName}/${containerName}`)
                            addObject(webSocket, podNamespace, podName, containerName, instanceConfig)
                        }
                    }
                    else {
                        console.log(`Excluded container: ${containerName}`)
                    }
                    break
                default:
                    console.log('Invalid instanceConfig view')
                    break
            }
        }
    }
    else if (eventType === 'MODIFIED') {
        deleteObject(eventType, podNamespace, podName, '', webSocket, instanceConfig)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, instanceConfig)
    }
    else if (eventType === 'DELETED') {
        modifyObject(eventType, podNamespace, podName, '', webSocket, instanceConfig)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, instanceConfig)
    }
    else {
        console.log(`Pod ${eventType} is unmanaged`)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, instanceConfig)
    }

}

const watchDockerPods = (apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    //launch included containers

    console.log(apiPath)
    console.log(queryParams)
    console.log([ queryParams['$dockerContainerName']])
    let ml = '{'+queryParams.labelSelector+'}'
    let kvps:string[] = queryParams.labelSelector.split(',')
    const jsonObject: { [key: string]: string } = {}
    kvps.forEach(kvp => {
        const [key, value] = kvp.split('=')
        jsonObject[key] = value
    })
    console.log(jsonObject)
    processEvent('ADDED', webSocket, instanceConfig, '$docker', '$docker', [ jsonObject['$dockerContainerName']] )


    // listen for changes
    // dockerApi.getEvents({ filters: { type: ['container'], event: ['start'] } }, (err, eventStream) => {
    //     if (err) {
    //       console.error('Error listening to events:', err)
    //       return
    //     }
    
    //     if (eventStream) {
    //         eventStream.on('data', async buffer => {
    //             const event = JSON.parse(buffer.toString());
    //             const containerId = event.id;

    //             const containerInfo = await dockerApi.getContainer(containerId).inspect();
    //             //streamLogs(containerInfo);
    //             console.log('containerInfo')
    //             console.log(containerInfo.Name)
    //             processEvent('ADDED', webSocket, instanceConfig, '$docker', '$docker', [containerInfo.Name])
    //         })
    //     }
    // })
}

// watches for pod changes (add, delete...) inside the group pointed by the requestor
const watchKubernetesPods = (apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    const watch = new Watch(kubeConfig)

    watch.watch(apiPath, queryParams, (eventType:string, obj:any) => {
        let podName:string = obj.metadata.name
        let podNamespace:string = obj.metadata.namespace

        if (obj.status.phase.toLowerCase()!=='running') {
            console.log('Not running pod:', podNamespace+'/'+podName)
            return
        }
        
        // let containerNames = obj.spec.containers.map( (c: any) => c.name.replaceAll('/',''))
        // processEvent(eventType, webSocket, instanceConfig, podNamespace, podName, containerNames)
        processEvent(eventType, webSocket, instanceConfig, podNamespace, podName, obj.spec.containers)
    },
    (err) => {
        if (err !== null) {
            console.log('Generic error starting watchPods')
            console.log(err)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), instanceConfig)
        }
        else {
            // watch method launches a 'done' invocation several minutes after starting streaming, I don't know why.
        }
    })
}

const watchPods = (apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    if (thisKwirthData.clusterType === ClusterTypeEnum.DOCKER) {
        watchDockerPods(apiPath, queryParams, webSocket, instanceConfig)
    }
    else {
        watchKubernetesPods(apiPath, queryParams, webSocket, instanceConfig)
    }
}

// +++ this function should be refactored to check only for requested resources included in instanceConfig, since, for example, a 'cluster' scope in
// accessKeyResources will create a list including all pods in the cluster
const getRequestedValidatedScopedPods = async (instanceConfig:InstanceConfig, accessKeyResources:ResourceIdentifier[], validNamespaces:string[], validPodNames:string[]) => {
    var selectedPods:V1Pod[]=[]
    if (thisKwirthData.clusterType === ClusterTypeEnum.DOCKER) {

        let pod = new V1Pod()
        pod.metadata = new V1ObjectMeta()
        pod.metadata.name = '$docker'
        pod.metadata.namespace = '$docker'
        pod.metadata.labels = { app: '$docker', name:'$docker' }
        pod.spec = new V1PodSpec()
        pod.spec.containers = []
        
        // let containers = await dockerApi.listContainers( { all:false} )
        // for (var container of containers) {
        //     let c = new V1Container()
        //     let name =  container.Names ? container.Names[0] : container.Id
        //     c.name = name.replaceAll('/','')
        //     pod.spec.containers.push(c)
        // }
        selectedPods.push(pod)
    }
    else {
        var allPods=await coreApi.listPodForAllNamespaces() //+++ can be optimized if instanceConfig.namespace is specified

        for (var pod of allPods.body.items) {
            var podName = pod.metadata?.name!
            var podNamespace = pod.metadata?.namespace!

            let existClusterScope = accessKeyResources.find(resource => resource.scope==='cluster') !== null
            if (!existClusterScope) {
                if (instanceConfig.namespace!=='' && instanceConfig.namespace.split(',').includes(podNamespace)) {
                    if (! validNamespaces.includes(podNamespace)) continue
                }

                //+++ other filters (not just 'pod') pending implementation (that is, obtain a list of pods checking groups, for example)
                // if (metricsConfig.pod!=='' && metricsConfig.pod.split(',').includes(podName)) {
                //     if (! validPodNames.includes(podName)) continue
                // }

                if (instanceConfig.pod!=='' && instanceConfig.pod.split(',').includes(podName)) {
                    if (! validPodNames.includes(podName)) continue
                }

                let podResource = accessKeyResources.find(resource => resource.pod===podName)
                if (!podResource) continue

                var haveLevel = getChannelScopeLevel(channels, instanceConfig.channel)
                var requiredLevel = getChannelScopeLevel(channels, instanceConfig.channel)
                if (haveLevel<requiredLevel) {
                    console.log(`Insufficent level ${haveLevel} < ${requiredLevel}`)
                    continue
                }
            }
            selectedPods.push(pod)
        }
    }
    return selectedPods
}

const processReconnect = async (webSocket: WebSocket, instanceConfig: InstanceConfig) => {
    console.log(`Trying to reconnect ${instanceConfig.instance} with key ${instanceConfig.reconnectKey}`)
    for (var channel of channels.values()) {
        if (channel.containsInstance(instanceConfig.instance)) {
            // +++ reconnect process has to be optimized (differentiating between onError and onClose)
            var updated = channel.updateConnection(webSocket, instanceConfig.instance)
            if (updated) {
                sendInstanceConfigSignalMessage(webSocket, InstanceConfigActionEnum.RECONNECT, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Reconnect successful')
                return
            }
            else {
                sendInstanceConfigSignalMessage(webSocket, InstanceConfigActionEnum.RECONNECT, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'An error has ocurred while updating connection')
                return
            }
        }
    }
    sendInstanceConfigSignalMessage(webSocket, InstanceConfigActionEnum.RECONNECT, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance has not been found')
}

const processStartInstanceConfig = async (webSocket: WebSocket, instanceConfig: InstanceConfig, accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validPodNames: string[]) => {
    console.log('Starting instance config for channel', instanceConfig.channel)
    var requestedValidatedPods = await getRequestedValidatedScopedPods(instanceConfig, accessKeyResources, validNamespaces, validPodNames)
    if (requestedValidatedPods.length===0) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested log config`, instanceConfig)
        return
    }
    
    instanceConfig.instance = uuidv4()
    instanceConfig.reconnectKey = uuidv4()
    switch (instanceConfig.view) {
        case 'namespace':
            for (let ns of validNamespaces) {
                watchPods(`/api/v1/namespaces/${ns}/${instanceConfig.objects}`, {}, webSocket, instanceConfig)
            }
            sendInstanceConfigSignalMessage(webSocket,InstanceConfigActionEnum.START, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
            break
        case 'group':
            for (let namespace of validNamespaces) {
                for (let group of instanceConfig.group.split(',')) {
                    let groupPods = (await getPodsFromGroup(coreApi, appsApi, namespace, group))
                    if (groupPods.pods.length > 0) {
                        let specificInstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.group = group
                        watchPods(`/api/v1/namespaces/${namespace}/${instanceConfig.objects}`, { labelSelector: groupPods.labelSelector }, webSocket, specificInstanceConfig)
                    }
                    else
                        console.log(`No pods on namespace ${namespace}`)
                }
            }
            sendInstanceConfigSignalMessage(webSocket,InstanceConfigActionEnum.START, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
            break
        case 'pod':
            for (let podName of instanceConfig.pod.split(',')) {
                let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    var metadataLabels = validPod.metadata?.labels
                    if (metadataLabels) {
                        var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificInstanceConfig: InstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.pod = podName
                        watchPods(`/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels for pod '${podName}'`, instanceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${podName}' (or pod does not exsist)`, instanceConfig)
                }
            }
            sendInstanceConfigSignalMessage(webSocket,InstanceConfigActionEnum.START, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
            break
        // case 'container':
        //     for (let container of instanceConfig.container.split(',')) {
        //         let [podName, containerName] = container.split('+')
        //         let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName)
        //         if (validPod) {
        //             let metadataLabels = validPod.metadata?.labels
        //             if (metadataLabels) {
        //                 let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
        //                 let specificInstanceConfig: InstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
        //                 specificInstanceConfig.container = container
        //                 watchPods(`/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig)
        //             }
        //             else {
        //                 sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels for container '${podName}/${containerName}'`, instanceConfig)
        //             }
        //         }
        //         else {
        //             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to container '${podName}/${containerName}'  (or pod does not exsist)`, instanceConfig)
        //         }
        //     }
        //     sendInstanceConfigSignalMessage(webSocket,InstanceConfigActionEnum.START, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
        //     break
        case 'container':
            console.log(requestedValidatedPods)
            for (let container of instanceConfig.container.split(',')) {
                let [podName, containerName] = container.split('+')
                let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName)
                //let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName && p.spec?.containers.find(c => c.name === containerName))
                console.log("podName+'/'+containerName")
                console.log(podName+'/'+containerName+':  '+validPod)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels
                    metadataLabels!['$dockerContainerName'] = containerName
                    console.log('metadataLabels')
                    console.log(metadataLabels)
                    if (metadataLabels) {
                        let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificInstanceConfig: InstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.container = container
                        watchPods(`/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels for container '${podName}/${containerName}'`, instanceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to container '${podName}/${containerName}'  (or pod does not exsist)`, instanceConfig)
                }
            }
            sendInstanceConfigSignalMessage(webSocket,InstanceConfigActionEnum.START, InstanceConfigFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
            break

        default:
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid view '${instanceConfig.view}'`, instanceConfig)
            break
    }
}

const processStopInstanceConfig = async (webSocket: WebSocket, instanceConfig: InstanceConfig) => {
    if (channels.has(instanceConfig.channel)) {
        channels.get(instanceConfig.channel)?.stopInstance(webSocket, instanceConfig)
    }
    else {
        console.log('Invalid channel on instance stop')
    }
}

const processPauseContinueInstanceConfig = async (instanceConfig: InstanceConfig, webSocket: WebSocket, action:InstanceConfigActionEnum) => {
    if (channels.has(instanceConfig.channel)) {
        channels.get(instanceConfig.channel)?.pauseContinueInstance(webSocket, instanceConfig, instanceConfig.action)            
    }
    else {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.channel} does not exist`, instanceConfig)
    }
}

// clients send requests to start receiving log
const processClientMessage = async (message:string, webSocket:WebSocket) => {
    const instanceConfig = JSON.parse(message) as InstanceConfig

    if (instanceConfig.flow !== InstanceConfigFlowEnum.REQUEST) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Invalid flow received', instanceConfig)
        return
    }

    if (instanceConfig.action === InstanceConfigActionEnum.PING) {
        var signalMessage:SignalMessage = {
            level: SignalMessageLevelEnum.INFO,
            channel: InstanceConfigChannelEnum.NONE,
            instance: '',
            type: InstanceMessageTypeEnum.SIGNAL,
            text: 'OK'
        }
        webSocket.send(JSON.stringify(signalMessage))
        return
    }

    if (instanceConfig.action === InstanceConfigActionEnum.RECONNECT) {
        if (!channels.get(instanceConfig.channel)?.getCapabilities().reconnectable) {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceConfig.channel} does not support reconnect`, instanceConfig)
            return
        }
        processReconnect (webSocket, instanceConfig)
        return
    }

    if (!instanceConfig.accessKey) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'No key received', instanceConfig)
        return
    }
    var accessKey = accessKeyDeserialize(instanceConfig.accessKey)
    if (accessKey.type.startsWith('bearer:')) {
        if (!validBearerKey(accessKey)) {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid bearer access key: ${instanceConfig.accessKey}`, instanceConfig)
            return
        }       
    }
    else {
        if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===instanceConfig.accessKey)) {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid API key: ${instanceConfig.accessKey}`, instanceConfig)
            return
        }
    }

    // +++ maybe we can perform this things later when knowing what the action is
    var accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resource)

    var requestedNamespaces = instanceConfig.namespace.split(',').filter(ns => ns!=='')
    var allowedNamespaces:string[] = []
    if (thisKwirthData.clusterType === ClusterTypeEnum.DOCKER) {
        allowedNamespaces = ['$docker']
        validNamespaces = ['$docker']
    }
    else {
        if (accessKeyResources.find(akr => akr.scope==='cluster')) {
            let res = await coreApi.listNamespace()
            allowedNamespaces = res.body.items.map(n => n.metadata?.name as string)
        }
        else {
            allowedNamespaces = accessKeyResources.filter(r => r.namespace!='').map(r => r.namespace)
        }
        allowedNamespaces = [...new Set(allowedNamespaces)]
        var validNamespaces = requestedNamespaces.filter(ns => allowedNamespaces.includes(ns))
        validNamespaces = [...new Set(validNamespaces)]
    }

    var requestedPodNames = instanceConfig.pod.split(',').filter(podName => podName!=='')
    var allowedPodNames:string[] = []
    var validPodNames:string[] = []
    if (thisKwirthData.clusterType === ClusterTypeEnum.DOCKER) {
        allowedPodNames =  ['$docker']
        validPodNames =  ['$docker']
    }
    else {
        if (accessKeyResources.find(akr => akr.scope === 'cluster')) {
            for (var ns of validNamespaces) {
                let res = await coreApi.listNamespacedPod(ns)
                allowedPodNames.push (...res.body.items.map(p => p.metadata?.name as string))
            }
            validPodNames = [...new Set(allowedPodNames)]
        }
        else {
            allowedPodNames = accessKeyResources.filter(r => r.pod!='').map(r => r.pod)
            validPodNames = requestedPodNames.filter(podName => allowedPodNames.includes(podName))
            validPodNames = [...new Set(validPodNames)]
        }
    }

    console.log('validNamespaces')
    console.log(validNamespaces)
    console.log('validPodNames')
    console.log(validPodNames)

    switch (instanceConfig.action) {
        case InstanceConfigActionEnum.START:
            if (channels.has(instanceConfig.channel)) {
                processStartInstanceConfig(webSocket, instanceConfig, accessKeyResources, validNamespaces, validPodNames)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid InstanceConfig channel: ${instanceConfig.channel}`, instanceConfig)
            }
            break
        case InstanceConfigActionEnum.STOP:
            if (channels.has(instanceConfig.channel)) {
                processStopInstanceConfig(webSocket, instanceConfig)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid InstanceConfig channel: ${instanceConfig.channel}`, instanceConfig)
            }
            break
        case InstanceConfigActionEnum.MODIFY:
            if (channels.has(instanceConfig.channel)) {
                if (!channels.get(instanceConfig.channel)?.getCapabilities().modifyable) {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceConfig.channel} does not support MODIFY`, instanceConfig)
                    return
                }
                channels.get(instanceConfig.channel)?.modifyInstance(webSocket, instanceConfig)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid InstanceConfig type: ${instanceConfig.channel}`, instanceConfig)
            }
            break
        case InstanceConfigActionEnum.PAUSE:
        case InstanceConfigActionEnum.CONTINUE:   
            if (channels.has(instanceConfig.channel)) {
                if (!channels.get(instanceConfig.channel)?.getCapabilities().pauseable) {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceConfig.channel} does not support PAUSE/CONTINUE`, instanceConfig)
                    return
                }    
                processPauseContinueInstanceConfig(instanceConfig, webSocket, instanceConfig.action)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid InstanceConfig type: ${instanceConfig.channel}`, instanceConfig)
            }
            break
        default:
            console.log (`Invalid action in instance config ${instanceConfig.action}`, instanceConfig.action)
            break
    }
}

// HTTP server
const app = express()
app.use(bodyParser.json())
app.use(cors())
const server = http.createServer(app)
const wss = new WebSocket.Server({ server })

wss.on('connection', (ws:WebSocket, req) => {
    console.log('Client connected')

    ws.on('message', (message:string) => {
        processClientMessage(message, ws)
    })

    ws.on('close', () => {
        console.log('Client disconnected')
        for (var channel of channels.keys()) {
            channels.get(channel)?.removeConnection(ws as any)
        }
    })
})

const getLastKwirthVersion = async (kwirthData:KwirthData) => {
    kwirthData.lastVersion=kwirthData.version
    try {
        var hubResp = await fetch ('https://hub.docker.com/v2/repositories/jfvilasoutlook/kwirth/tags?page_size=25&page=1&ordering=last_updated&name=')
        var json = await hubResp.json()
        if (json) {
            var results=json.results as any[]
            for (var result of results) {
                var regex = /^\d+\.\d+\.\d+$/
                if (regex.test(result.name)) {
                    if (versionGreatThan(result.name, kwirthData.version)) {
                        console.log(`New version available: ${result.name}`)
                        kwirthData.lastVersion=result.name
                        break
                    }
                }
            }
            console.log('No new Kwirth version found on Docker hub')
        }
    }
    catch (err) {
        console.log('Error trying to determine last Kwirth version')
        console.log(err)
    }
}

const runKubernetes = async (kwirthData: KwirthData, clusterInfo:ClusterInfo) => {
    secrets = new KubernetesSecrets(coreApi, kwirthData.namespace)
    configMaps = new KubernetesConfigMaps(coreApi, kwirthData.namespace)

    await getLastKwirthVersion(kwirthData)
    // serve front
    console.log(`SPA is available at: ${rootPath}/front`)
    app.get(`/`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

    app.get(`${rootPath}`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
    app.use(`${rootPath}/front`, express.static('./dist/front'))

    // serve config API
    var ka:ApiKeyApi = new ApiKeyApi(configMaps)
    app.use(`${rootPath}/key`, ka.route)
    var va:ConfigApi = new ConfigApi(coreApi, appsApi, ka, kwirthData, clusterInfo, channels)
    app.use(`${rootPath}/config`, va.route)
    var sa:StoreApi = new StoreApi(configMaps, ka)
    app.use(`${rootPath}/store`, sa.route)
    var ua:UserApi = new UserApi(secrets, ka)
    app.use(`${rootPath}/user`, ua.route)
    var la:LoginApi = new LoginApi(secrets, configMaps)
    app.use(`${rootPath}/login`, la.route)
    var mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, ka, kwirthData)
    app.use(`${rootPath}/managekwirth`, mk.route)
    var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi, ka, channels)
    app.use(`${rootPath}/managecluster`, mc.route)
    var ma:MetricsApi = new MetricsApi(clusterInfo, ka)
    app.use(`${rootPath}/metrics`, ma.route)

    // obtain remote ip
    app.use(requestIp.mw())
    
    // listen
    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`)
        console.log(`Context being used: ${kubeConfig.currentContext}`)
        if (kwirthData.inCluster) {
            console.log(`Kwirth is running INSIDE cluster`)
        }
        else {
            console.log(`Cluster name (according to kubeconfig context): ${kubeConfig.getCluster(kubeConfig.currentContext)?.name}. Kwirth is running OUTSIDE a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })
    process.on('exit', () => {
        console.log('exiting')
        saToken.deleteToken('kwirth-sa', kwirthData.namespace)
    })
}

const loadMetricsInfo = async (clusterInfo: ClusterInfo) => {
    console.log('Metrics information for cluster is being loaded asynchronously')
    await clusterInfo.metrics.loadClusterMetrics(Array.from(clusterInfo.nodes.values()))
    clusterInfo.vcpus = 0
    clusterInfo.memory = 0
    for (let node of clusterInfo.nodes.values()) {
        await clusterInfo.metrics.readNodeMetrics(node)
        clusterInfo.vcpus += node.machineMetricValues.get('machine_cpu_cores')?.value!
        clusterInfo.memory += node.machineMetricValues.get('machine_memory_bytes')?.value!
    }
    console.log('clusterInfo.memory', clusterInfo.memory)
    console.log('clusterInfo.vcpus', clusterInfo.vcpus)
    clusterInfo.startInterval(clusterInfo.metricsInterval)
}

const initCluster = async (token:string) : Promise<ClusterInfo> => {
    // load nodes
    var resp = await coreApi.listNode()
    var nodes:Map<string, NodeInfo> = new Map()
    for (var node of resp.body.items) {
        var nodeData:NodeInfo = {
            name: node.metadata?.name!,
            ip: node.status?.addresses!.find(a => a.type === 'InternalIP')?.address!,
            kubernetesNode: node,
            containerMetricValues: new Map(),
            prevContainerMetricValues: new Map(),
            machineMetricValues: new Map(),
            timestamp: 0,
            podMetricValues: new Map(),
            prevPodMetricValues: new Map(),
            prevMachineMetricValues: new Map()
        }
        nodes.set(nodeData.name, nodeData)
        console.log('Found node', nodeData.name)
    }
    console.log('Node config loaded')

    // inictialize cluster
    var clusterInfo = new ClusterInfo()
    clusterInfo.nodes = nodes
    clusterInfo.metrics = new Metrics(token)
    clusterInfo.metricsInterval = 60
    clusterInfo.token = token
    clusterInfo.coreApi = coreApi
    clusterInfo.appsApi = appsApi
    clusterInfo.logApi = logApi

    loadMetricsInfo(clusterInfo)

    return clusterInfo
}

const launchKubernetes = async() => {
    console.log('Start Kubernetes Kwirth')
    thisKwirthData = await getMyKubernetesData()
    if (thisKwirthData) {
        try {
            saToken = new ServiceAccountToken(coreApi, thisKwirthData.namespace)    
            await saToken.createToken('kwirth-sa',thisKwirthData.namespace)

            setTimeout ( async () => {
                console.log('Extracting token...')
                let token = await saToken.extractToken('kwirth-sa', thisKwirthData.namespace)

                if (token)  {
                    console.log('SA token obtained succesfully')
                    var clusterInfo = await initCluster(token)
                    clusterInfo.clusterType = thisKwirthData.clusterType

                    // load channel extensions
                    var logChannel = new LogChannel(clusterInfo)
                    var alertChannel = new AlertChannel(clusterInfo)
                    var metricsChannel = new MetricsChannel(clusterInfo)
                    channels.set('log', logChannel)
                    channels.set('alert', alertChannel)
                    channels.set('metrics', metricsChannel)

                    console.log(`Enabled channels for this run are: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
                    console.log(`Detected own namespace: ${thisKwirthData.namespace}`)
                    if (thisKwirthData.deployment !== '')
                        console.log(`Detected own deployment: ${thisKwirthData.deployment}`)
                    else
                        console.log(`No deployment detected. Kwirth is not running inside a cluster`)
                    runKubernetes(thisKwirthData, clusterInfo)
                }
                else {
                    console.log('SA token is invalid, exiting...')
                }
            }, 5000)
        }
        catch (err){
            console.log(err)
        }
    }
    else {
        console.log('Cannot get namespace, exiting...')
    }    
}

const runDocker = async (kwirthData: KwirthData, clusterInfo:ClusterInfo) => {
    thisKwirthData = kwirthData
    console.log(kwirthData)
    secrets = new DockerSecrets(coreApi, '/secrets')
    configMaps = new DockerConfigMaps(coreApi, '/configmaps')

    await getLastKwirthVersion(kwirthData)
    
    //serve front
    console.log(`SPA is available at: ${rootPath}/front`)
    app.get(`/`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

    app.get(`${rootPath}`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
    app.use(`${rootPath}/front`, express.static('./dist/front'))

    // serve config API
    var ka:ApiKeyApi = new ApiKeyApi(configMaps)
    app.use(`${rootPath}/key`, ka.route)
    var ca:ConfigApi = new ConfigApi(coreApi, appsApi, ka, kwirthData, clusterInfo, channels)
    ca.setDockerApi(dockerApi)
    app.use(`${rootPath}/config`, ca.route)
    var sa:StoreApi = new StoreApi(configMaps, ka)
    app.use(`${rootPath}/store`, sa.route)
    var ua:UserApi = new UserApi(secrets, ka)
    app.use(`${rootPath}/user`, ua.route)
    var la:LoginApi = new LoginApi(secrets, configMaps)
    app.use(`${rootPath}/login`, la.route)
    var mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, ka, kwirthData)
    app.use(`${rootPath}/managekwirth`, mk.route)
    var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi, ka, channels)
    app.use(`${rootPath}/managecluster`, mc.route)
    // var ma:MetricsApi = new MetricsApi(clusterInfo, ka)
    // app.use(`${rootPath}/metrics`, ma.route)

    // obtain remote ip
    app.use(requestIp.mw())
    
    // listen
    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`)
        console.log(`Context being used: ${kubeConfig.currentContext}`)
        if (kwirthData.inCluster) {
            console.log(`Kwirth is running INSIDE cluster`)
        }
        else {
            console.log(`Cluster name (according to kubeconfig context): ${kubeConfig.getCluster(kubeConfig.currentContext)?.name}. Kwirth is running OUTSIDE a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })
    process.on('exit', () => {
        console.log('exiting')
    })
}

const launchDocker = async() => {
    console.log('Start Docker Kwirth')
    let clusterInfo = new ClusterInfo()
    let kwirthData: KwirthData = {
        clusterName: 'inDocker',
        namespace: '',
        deployment: '',
        inCluster: false,
        version: VERSION,
        lastVersion: VERSION,
        clusterType: ClusterTypeEnum.DOCKER
    }
    clusterInfo.nodes = new Map()
    clusterInfo.metrics = new Metrics('')
    clusterInfo.metricsInterval = 60
    clusterInfo.token = ''
    clusterInfo.clusterType = ClusterTypeEnum.DOCKER
    clusterInfo.dockerApi = dockerApi

    // load channel extensions
    var logChannel = new LogChannel(clusterInfo)
    channels.set('log', logChannel)

    console.log(`Enabled channels for this run are: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
    runDocker(kwirthData, clusterInfo)
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

getExecutionEnvironment().then( async (exenv:string) => {
    switch (exenv) {
        case 'windocker':
        case 'linuxdocker':
            launchDocker()
            break
        case 'kubernetes':
            launchDocker()
            //launchKubernetes()
            break
        default:
            console.log('Unuspported execution environment. Existing...')
        }
})
.catch( (error) => {
    console.log ()
    console.log ('Cannot determine execution environment')
})
