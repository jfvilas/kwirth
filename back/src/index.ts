import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, Exec, V1Pod, CustomObjectsApi, RbacAuthorizationV1Api, ApiextensionsV1Api, KubernetesObject } from '@kubernetes/client-node'
import Docker from 'dockerode'
import { ConfigApi } from './api/ConfigApi'
import { KubernetesSecrets } from './tools/KubernetesSecrets'
import { KubernetesConfigMaps } from './tools/KubernetesConfigMaps'
import { VERSION } from './version'
import { getLastKwirthVersion, showLogo } from './tools/branding/Branding'

// HTTP server for serving front, api and websockets
import { StoreApi } from './api/StoreApi'
import { UserApi } from './api/UserApi'
import { ApiKeyApi } from './api/ApiKeyApi'
import { LoginApi } from './api/LoginApi'

// HTTP server & websockets
import { WebSocketServer } from 'ws'
import { ManageKwirthApi } from './api/ManageKwirthApi'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, accessKeyDeserialize, accessKeySerialize, parseResources, ResourceIdentifier, InstanceConfig, ISignalMessage, SignalMessageLevelEnum, InstanceConfigViewEnum, InstanceMessageTypeEnum, ClusterTypeEnum, InstanceConfigResponse, IInstanceMessage, KwirthData, IRouteMessage, SignalMessageEventEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { AuthorizationManagement } from './tools/AuthorizationManagement'

import express, { Request, Response} from 'express'
import { ClusterInfo } from './model/ClusterInfo'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuid } from 'uuid'

import { MetricsTools as Metrics } from './tools/Metrics'
import { LogChannel } from './channels/log/LogChannel'
import { AlertChannel } from './channels/alert/AlertChannel'
import { MetricsChannel } from './channels/metrics/MetricsChannel'
import { ISecrets } from './tools/ISecrets'
import { IConfigMaps } from './tools/IConfigMap'
import { DockerSecrets } from './tools/DockerSecrets'
import { DockerConfigMaps } from './tools/DockerConfigMaps'
import { DockerTools } from './tools/KwirthApi'
import { OpsChannel } from './channels/ops/OpsChannel'
import { TrivyChannel } from './channels/trivy/TrivyChannel'
import { IChannel } from './channels/IChannel'
import { EchoChannel } from './channels/echo/EchoChannel'
import { FilemanChannel } from './channels/fileman/FilemanChannel'

import fileUpload from 'express-fileupload'

const v8 = require('node:v8')
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
const crdApi = kubeConfig.makeApiClient(CustomObjectsApi)
const rbacApi = kubeConfig.makeApiClient(RbacAuthorizationV1Api)
const extensionApi = kubeConfig.makeApiClient(ApiextensionsV1Api)
const execApi = new Exec(kubeConfig)
const logApi = new Log(kubeConfig)
var dockerApi: Docker = new Docker()
var kwirthData: KwirthData
var clusterInfo: ClusterInfo = new ClusterInfo()

var saToken: ServiceAccountToken
var secrets: ISecrets
var configMaps: IConfigMaps
const rootPath = process.env.ROOTPATH || ''
const masterKey = process.env.MASTERKEY || 'Kwirth4Ever'
const channelLogEnabled = (process.env.CHANNEL_LOG || 'true').toLowerCase() === 'true'
const channelMetricsEnabled = (process.env.CHANNEL_METRICS || 'true').toLowerCase() === 'true'
const channelAlertEnabled = (process.env.CHANNEL_ALERT || '').toLowerCase() === 'true'
const channelOpsEnabled = (process.env.CHANNEL_OPS || 'true').toLowerCase() === 'true'
const channelTrivyEnabled = (process.env.CHANNEL_TRIVY || 'true').toLowerCase() === 'true'
const channelEchoEnabled = (process.env.CHANNEL_ECHO || 'true').toLowerCase() === 'true'
const channelFilemanEnabled = (process.env.CHANNEL_FILEMAN || 'true').toLowerCase() === 'true'

// discover where we are running in: docker, kubernetes...
const getExecutionEnvironment = async ():Promise<string> => {
    console.log('Detecting execution environment...')

    // we keep this order of detection, since kubernetes also has a docker engine
    console.log('Trying Kubernetes...')
    try {
        await coreApi.listPodForAllNamespaces()
        return 'kubernetes'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }

    console.log('Trying Linux...')
    try {
        dockerApi = new Docker({ socketPath: '/var/run/docker.sock'})
        await dockerApi.listContainers( { all:false } )
        return 'linux'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }

    console.log('Trying Windows...')
    try {
        dockerApi = new Docker({ socketPath: '//./pipe/docker_engine' })
        await dockerApi.listContainers( { all:false } )
        return 'windows'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }

    dockerApi = new Docker()
    return 'undetected'
}

// get the namespace where Kwirth is running on
const getKubernetesData = async ():Promise<KwirthData> => {
    let podName=process.env.HOSTNAME
    const pods = await coreApi.listPodForAllNamespaces()
    const pod = pods.body.items.find(p => p.metadata?.name === podName)  
    if (pod && pod.metadata?.namespace) {
        let depName = (await AuthorizationManagement.getPodControllerName(appsApi, pod, true)) || ''
        return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true, version:VERSION, lastVersion: VERSION, clusterType: ClusterTypeEnum.KUBERNETES, metricsInterval:15, channels: [] }
    }
    else {
        // kwirth is supposed to be running outsoud cluster, so we look for kwirth users config in order to detect namespace
        let secrets = (await coreApi.listSecretForAllNamespaces()).body.items
        let secret = secrets.find(s => s.metadata?.name === 'kwirth-users')
        if (secret) {
            // this namespace will be used to access secrets and configmaps
            return { clusterName: 'inCluster', namespace:secret.metadata?.namespace!, deployment:'', inCluster:false, version:VERSION, lastVersion: VERSION, clusterType: ClusterTypeEnum.KUBERNETES, metricsInterval:15, channels: [] }
        }
        else {
            console.log('Cannot determine namespace while running outside cluster')
            process.exit(1)
        }
    }
}

const sendChannelSignal = (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceMessage: IInstanceMessage) => {
    if (channels.has(instanceMessage.channel)) {
        let signalMessage:ISignalMessage = {
            action: instanceMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            level,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }
    else {
        console.log(`Unsupported channel ${instanceMessage.channel}`)
    }
}

const sendChannelSignalAsset = (webSocket: WebSocket, level: SignalMessageLevelEnum, event: SignalMessageEventEnum, text: string, instanceMessage: IInstanceMessage, namespace:string, pod:string, container?:string) => {
    if (channels.has(instanceMessage.channel)) {
        let signalMessage:ISignalMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            level,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            namespace,
            pod,
            ...(container? {container}: {}),
            event,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }
    else {
        console.log(`Unsupported channel ${instanceMessage.channel}`)
    }
}

const sendInstanceConfigSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, channel: string, instanceMessage:IInstanceMessage, text:string) => {
    let resp:InstanceConfigResponse = {
        action,
        flow,
        channel,
        instance: instanceMessage.instance,
        type: InstanceMessageTypeEnum.SIGNAL,
        text
    }
    ws.send(JSON.stringify(resp))
}

const addObject = (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) => {
    console.log(`objectReview '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)

    let valid = AuthorizationManagement.checkAkr(channels, instanceConfig, podNamespace, podName, containerName)
    if (!valid) {
        console.log(`No AKR found for object : ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
        return
    }

    console.log(`Level is enough for object: ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)

    if(channels.has(instanceConfig.channel)) {
        if (channels.get(instanceConfig.channel)?.containsAsset(webSocket, podNamespace,podName, containerName)) {
            console.log(`existingAsset '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
        }
        else {
            console.log(`addObject '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
            channels.get(instanceConfig.channel)?.addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
            sendChannelSignalAsset(webSocket, SignalMessageLevelEnum.INFO, SignalMessageEventEnum.ADD, `Container ADDED: ${podNamespace}/${podName}/${containerName}`, instanceConfig, podNamespace, podName, containerName)
        }
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

// const modifyObject = async (_webSocket:WebSocket, _eventType:string, _podNamespace:string, _podName:string, _containerName:string, instanceConfig:InstanceConfig) => {
//     if(channels.has(instanceConfig.channel)) {
//     }
//     else {
//         console.log(`Invalid channel`, instanceConfig.channel)
//     }
// }

const deleteObject = async (webSocket:WebSocket, _eventType:string, podNamespace:string, podName:string, containerName:string, instanceConfig:InstanceConfig) => {
    if(channels.has(instanceConfig.channel)) {
        channels.get(instanceConfig.channel)?.deleteObject(webSocket, instanceConfig, podNamespace, podName, containerName)
        sendChannelSignalAsset(webSocket, SignalMessageLevelEnum.INFO, SignalMessageEventEnum.DELETE, `Container DELETED: ${podNamespace}/${podName}/${containerName}`, instanceConfig, podNamespace, podName, containerName)
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

const processEvent = (eventType:string, obj: any, webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containers:string[]) => {
    if (eventType === 'ADDED' && obj.status.phase.toLowerCase()==='running') {
        console.log('eventype',eventType, podNamespace, podName, obj.status.phase)
        for (let container of containers) {
            let containerName = container
            switch (instanceConfig.view) {
                case InstanceConfigViewEnum.NAMESPACE:
                    console.log('Namespace event')
                    console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on namespace`)
                    addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
                    break
                case InstanceConfigViewEnum.GROUP:
                    console.log('Group event')
                    let [_groupType, groupName] = instanceConfig.group.split('+')
                    // we rely on kubernetes naming conventions here (we could query k8 api to discover group the pod belongs to)
                    if (podName.startsWith(groupName)) {  
                        console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on group`)
                        addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
                    }
                    break
                case InstanceConfigViewEnum.POD:
                    console.log('Pod event')
                    if ((instanceConfig.namespace==='' || (instanceConfig.namespace!=='' && instanceConfig.namespace.split(',').includes(podNamespace))) && instanceConfig.pod.split(',').includes(podName)) {
                        if (instanceConfig.pod.split(',').includes(podName)) {
                            console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on pod`)
                            addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
                        }
                    }
                    break
                case InstanceConfigViewEnum.CONTAINER:
                    console.log('Container event')
                    // container has the form: podname+containername (includes a plus sign as separating char)
                    let instanceContainers = Array.from (new Set (instanceConfig.container.split(',').map (c => c.split('+')[1])))
                    let instancePods = Array.from (new  Set (instanceConfig.container.split(',').map (c => c.split('+')[0])))
                    if (instanceContainers.includes(containerName) && instancePods.includes(podName)) {
                        if (instanceConfig.container.split(',').includes(podName+'+'+containerName)) {
                            console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on container`)
                            addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
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
        console.log('eventype',eventType, podNamespace, podName, obj.status.phase.toLowerCase())
        let containerNames = obj.spec.containers.map( (c: any) => c.name)
        if (obj.status.phase.toLowerCase()==='running') {
            processEvent('ADDED', obj, webSocket, instanceConfig, podNamespace, podName, containerNames)
        }
        else {
            // modifyObject(webSocket, eventType, podNamespace, podName, '', instanceConfig)
            // sendChannelSignalAsset(webSocket, SignalMessageLevelEnum.INFO, SignalMessageEventEnum.OTHER, `Pod MODIFIED: ${podNamespace}/${podName}`, instanceConfig, podNamespace, podName, '')
        }
    }
    else if (eventType === 'DELETED') {
        console.log('eventype', eventType, podNamespace, podName, obj.status.phase)
        deleteObject(webSocket, eventType, podNamespace, podName, '', instanceConfig)
    }
    else {
        console.log(`Pod ${eventType} is unmanaged`)
        //sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, instanceConfig)
        sendChannelSignalAsset(webSocket, SignalMessageLevelEnum.INFO, SignalMessageEventEnum.OTHER, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, instanceConfig, podNamespace, podName)
    }
}

const watchDockerPods = async (_apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    //launch included containers

    if (instanceConfig.view==='pod') {
        // get all containers in pod
        let ml = '{'+queryParams.labelSelector+'}'
        let kvps:string[] = queryParams.labelSelector.split(',')
        const jsonObject: { [key: string]: string } = {}
        kvps.forEach(kvp => {
            const [key, value] = kvp.split('=')
            jsonObject[key] = value
        })

        let containers = await clusterInfo.dockerTools.getContainers(jsonObject['kwirthDockerPodName'])
        for (let container of containers) {
            processEvent('ADDED', null, webSocket, instanceConfig, '$docker', jsonObject['kwirthDockerPodName'], [ container ] )
        }
    }
    else if (instanceConfig.view==='container') {
        let ml = '{'+queryParams.labelSelector+'}'
        let kvps:string[] = queryParams.labelSelector.split(',')
        const jsonObject: { [key: string]: string } = {}
        kvps.forEach(kvp => {
            const [key, value] = kvp.split('=')
            jsonObject[key] = value
        })
        let podName=jsonObject['kwirthDockerPodName']
        let containerName = jsonObject['kwirthDockerContainerName']
        let id = await clusterInfo.dockerTools.getContainerId(podName, containerName )
        if (id) {
            processEvent('ADDED', null, webSocket, instanceConfig, '$docker', podName, [ containerName ] )
        }
        else {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Container ${podName}/${containerName} does not exist.`, instanceConfig)
        }
    }
}

// watches for pod changes (add, delete...) inside the group pointed by the requestor
const watchKubernetesPods = (apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:InstanceConfig) => {
    const watch = new Watch(kubeConfig)

    watch.watch(apiPath, queryParams, (eventType:string, obj:any) => {
        let podName:string = obj.metadata.name
        let podNamespace:string = obj.metadata.namespace

        // +++ review event management
        // if (obj.status.phase.toLowerCase()!=='running') {
        //     console.log('Not running pod:', podNamespace+'/'+podName, obj.status.phase.toLowerCase())
        //     return
        // }
        // console.log('Add containers if needed')
        let containerNames = obj.spec.containers.map( (c: any) => c.name)
        processEvent(eventType, obj, webSocket, instanceConfig, podNamespace, podName, containerNames)
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
    if (kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
        watchDockerPods(apiPath, queryParams, webSocket, instanceConfig)
    }
    else {
        watchKubernetesPods(apiPath, queryParams, webSocket, instanceConfig)
    }
}

const getRequestedValidatedScopedPods = async (instanceConfig:InstanceConfig, accessKeyResources:ResourceIdentifier[], validNamespaces:string[], _validGroups:string[], validPodNames:string[], validContainers:string[]) => {
    let selectedPods:V1Pod[] = []
    let allPods:V1Pod[] = []

    if (kwirthData.clusterType === ClusterTypeEnum.DOCKER)
        allPods = await clusterInfo.dockerTools.getAllPods()
    else {
        for (let ns of validNamespaces) {
            allPods.push(...(await clusterInfo.coreApi.listNamespacedPod(ns)).body.items)
        }
    }

    for (let pod of allPods) {
        let podName = pod.metadata?.name!
        let podNamespace = pod.metadata?.namespace!
        let containerNames = pod.spec?.containers.map(c => c.name) || []

        let existClusterScope = accessKeyResources.some(resource => resource.scopes === 'cluster')
        if (!existClusterScope) {
            console.log('validPodNames:',validPodNames, '  podName:', podName)
            if (validPodNames.length>0 && !validPodNames.includes(podName)) continue

            if (instanceConfig.namespace!=='' && instanceConfig.namespace.split(',').includes(podNamespace)) {
                if (!validNamespaces.includes(podNamespace)) continue
            }

            if (instanceConfig.pod!=='' && instanceConfig.pod.split(',').includes(podName)) {
                if (!validPodNames.includes(podName)) continue
            }

            // +++
            // let foundKeyResource = false
            // for (let akr of accessKeyResources) {
            //     let haveLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, akr.scopes, Number.MIN_VALUE)
            //     let requestedLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, instanceConfig.scope, Number.MAX_VALUE)
            //     if (haveLevel<requestedLevel) {
            //         console.log(`Insufficent level ${haveLevel} < ${requestedLevel}`)
            //         continue
            //     }
            //     console.log(`Level is enough: ${akr.scopes} >= ${instanceConfig.scope}`)
            //     foundKeyResource = true
            //     break
            // }
            let foundKeyResource = false
            for (let c of containerNames) {
                if (AuthorizationManagement.checkAkr(channels, instanceConfig, podNamespace, podName, c)) {
                    foundKeyResource = true
                    break
                }
            }
            if (!foundKeyResource) continue
        }
        selectedPods.push(pod)
    }
    return selectedPods
}

const processReconnect = async (webSocket: WebSocket, instanceMessage: IInstanceMessage) => {
    console.log(`Trying to reconnect instance '${instanceMessage.instance}' on channel ${instanceMessage.channel}`)
    for (let channel of channels.values()) {
        console.log('Review channel for reconnect:', channel.getChannelData().id)
        if (channel.containsInstance(instanceMessage.instance)) {
            console.log('Found channel', channel.getChannelData().id)
            let updated = channel.updateConnection(webSocket, instanceMessage.instance)
            if (updated) {
                sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.RECONNECT, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Reconnect successful')
                return
            }
            else {
                sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.RECONNECT, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'An error has ocurred while updating connection')
                return
            }
        }
        else {
            console.log(`Instance '${instanceMessage.instance}' not found on channel ${channel.getChannelData().id} for reconnect`)
        }
    }
    console.log(`Instance '${instanceMessage.instance}' found for reconnect in no channels`)
    sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.RECONNECT, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for reconnect')
}

const processStartInstanceConfig = async (webSocket: WebSocket, instanceConfig: InstanceConfig, accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validGroups: string[], validPodNames: string[], validContainers: string[]) => {
    console.log('Trying to perform instance config for channel', instanceConfig.channel)
    let requestedValidatedPods = await getRequestedValidatedScopedPods(instanceConfig, accessKeyResources, validNamespaces, validGroups, validPodNames, validContainers)
    if (requestedValidatedPods.length === 0) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested instance config`, instanceConfig)
        return
    }
    
    // we confirm startInstance is ok prior to launching watchPods (because client needs to know instanceId)
    instanceConfig.instance = uuid()
    sendInstanceConfigSignalMessage(webSocket,InstanceMessageActionEnum.START, InstanceMessageFlowEnum.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')

    switch (instanceConfig.view) {
        case InstanceConfigViewEnum.NAMESPACE:
            for (let ns of validNamespaces) {
                watchPods(`/api/v1/namespaces/${ns}/${instanceConfig.objects}`, {}, webSocket, instanceConfig)
            }
            break
        case InstanceConfigViewEnum.GROUP:
            for (let namespace of validNamespaces) {
                for (let gTypeName of instanceConfig.group.split(',')) {
                    let groupPods = await AuthorizationManagement.getPodLabelSelectorsFromGroup(coreApi, appsApi, namespace, gTypeName)
                    if (groupPods.pods.length > 0) {
                        let specificInstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.group = gTypeName
                        watchPods(`/api/v1/namespaces/${namespace}/${instanceConfig.objects}`, { labelSelector: groupPods.labelSelector }, webSocket, specificInstanceConfig)
                    }
                    else
                        console.log(`No pods on namespace ${namespace}`)
                }
            }
            break
        case InstanceConfigViewEnum.POD:
            for (let podName of instanceConfig.pod.split(',')) {
                let validPod = requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels
                    if (metadataLabels) {
                        if (kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
                            metadataLabels['kwirthDockerPodName'] = podName
                        }

                        let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificInstanceConfig: InstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.pod = podName
                        watchPods(`/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels for pod '${podName}'`, instanceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${podName}' (or pod does not exsist) for pod access`, instanceConfig)
                }
            }
            break
        case InstanceConfigViewEnum.CONTAINER:
            for (let container of instanceConfig.container.split(',')) {
                let [podName, containerName] = container.split('+')
                let validPod = requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels

                    if (metadataLabels) {
                        if (kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
                            metadataLabels['kwirthDockerContainerName'] = containerName
                            metadataLabels['kwirthDockerPodName'] = podName
                        }
    
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
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${podName}' (or pod does not exsist) for container access`, instanceConfig)
                }
            }
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

const processPauseContinueInstanceConfig = async (instanceConfig: InstanceConfig, webSocket: WebSocket, _action:InstanceMessageActionEnum) => {
    if (channels.has(instanceConfig.channel)) {
        channels.get(instanceConfig.channel)?.pauseContinueInstance(webSocket, instanceConfig, instanceConfig.action)
    }
    else {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.channel} does not exist`, instanceConfig)
    }
}

const processPing = (webSocket:WebSocket, instanceMessage:IInstanceMessage): void => {
    if (!channels.has(instanceMessage.channel)) {
        sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.PING, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Channel not found for ping')
        return
    }
    let channel = channels.get(instanceMessage.channel)!
    if (channel.containsConnection(webSocket)) {
        let refreshed = channel.refreshConnection(webSocket)
        if (refreshed) {
            sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.PING, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'OK')
            return
        }
        else {
            sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.PING, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'An error has ocurred while refreshing connection')
            return
        }
    }
    else {
        console.log(`Ping socket not found on channel ${instanceMessage.channel}`)
    }
    sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.PING, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
}

const processChannelCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage, podNamespace?:string, podName?:string, containerName?:string): Promise<void> => {
    let channel = channels.get(instanceMessage.channel)
    if (channel) {
        let instance = channel.containsInstance(instanceMessage.instance)
        if (instance) {
            channel.processCommand(webSocket, instanceMessage, podNamespace, podName, containerName)
        }
        else {
            // we have no instance, may be an IMMED command
            if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
                console.log(`Process IMMEDIATE command`)
                channel.processCommand(webSocket, instanceMessage, podNamespace, podName, containerName)
            }
            else {
                console.log(`Instance '${instanceMessage.instance}' not found for command`)
                sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for command')
            }
        }   
    }
    else {
        console.log(`Channel not found`)
        sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
    }
}

const processChannelRoute = async (webSocket: WebSocket, instanceMessage: IInstanceMessage): Promise<void> => {
    let channel = channels.get(instanceMessage.channel)
    if (channel) {
        let instance = channel.containsInstance(instanceMessage.instance)
        if (instance) {
            let routeMessage = instanceMessage as IRouteMessage
            if (channels.has(routeMessage.destChannel)) {
                if (channels.get(routeMessage.destChannel)?.getChannelData().routable) {
                    console.log(`Routing message to channel ${routeMessage.destChannel}`)
                    processClientMessage (webSocket, JSON.stringify(routeMessage.data))
                }
                else {
                    console.log(`Dest channel (${routeMessage.destChannel}) for 'route' command doesn't support routing`)
                }
            }
            else {
                console.log(`Dest channel '${routeMessage.destChannel}' does not exist for instance '${instanceMessage.instance}'`)
                sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, `Dest channel ${routeMessage.destChannel} does not exist`)
            }
        }
        else {
            console.log(`Instance '${instanceMessage.instance}' not found on channel ${channel.getChannelData().id} for route`)
            sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for routing')
        }   
    }
    else {
        console.log(`Socket not found for routing`)
        sendInstanceConfigSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
    }
}

// clients send requests to start receiving log
const processClientMessage = async (webSocket:WebSocket, message:string) => {
    const instanceMessage = JSON.parse(message) as IInstanceMessage

    if (instanceMessage.flow !== InstanceMessageFlowEnum.REQUEST && instanceMessage.flow !== InstanceMessageFlowEnum.IMMEDIATE) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Invalid flow received', instanceMessage)
        return
    }

    if (instanceMessage.action === InstanceMessageActionEnum.PING) {
        processPing(webSocket, instanceMessage)
        return
    }

    if (!channels.has(instanceMessage.channel)) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Unsupported channel in this Kwirth deployment', instanceMessage)
        return
    }

    console.log('Received request:', instanceMessage.flow, instanceMessage.action, instanceMessage.channel)
    if (instanceMessage.action=== InstanceMessageActionEnum.COMMAND) {
        console.log(message)
    }

    if (instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
        console.log('Reconnect received')
        if (!channels.get(instanceMessage.channel)?.getChannelData().reconnectable) {
            console.log(`Reconnect capability not enabled for channel ${instanceMessage.channel} and instance ${instanceMessage.instance}`)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceMessage.channel} does not support reconnect`, instanceMessage)
            return
        }
        processReconnect (webSocket, instanceMessage)
        return
    }

    if (instanceMessage.action === InstanceMessageActionEnum.ROUTE) {
        let routeMessage = instanceMessage as IRouteMessage
        console.log(`Route received from channel ${instanceMessage.channel} to ${routeMessage.destChannel}`)
        processChannelRoute (webSocket, instanceMessage)
        return
    }

    const instanceConfig = JSON.parse(message) as InstanceConfig
    if (!instanceConfig.accessKey) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'No access key received', instanceConfig)
        return
    }

    let accessKey = accessKeyDeserialize(instanceConfig.accessKey)
    if (accessKey.type.toLowerCase().startsWith('bearer:')) {
        if (!AuthorizationManagement.validBearerKey(masterKey, accessKey)) {
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
    let accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resources)

    let validNamespaces:string[] = []
    if (instanceConfig.namespace) validNamespaces = await AuthorizationManagement.getValidNamespaces(coreApi, accessKey, instanceConfig.namespace.split(','))
    console.log('validNamespaces:', validNamespaces)

    let validGroups:string[] = []
    if (instanceConfig.group) validGroups = await AuthorizationManagement.getValidGroups(appsApi, accessKey, validNamespaces, instanceConfig.group.split(','))
    console.log('validGroups:', validGroups)

    let validPodNames:string[] = []
    if (kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
        validPodNames = await clusterInfo.dockerTools.getAllPodNames()
    }
    else {
        if (instanceConfig.pod) validPodNames = await AuthorizationManagement.getValidPods(coreApi, appsApi, validNamespaces, accessKey, instanceConfig.pod.split(','))
    }
    console.log('validPods:', validPodNames)

    let validContainers:string[] = []
    if (instanceConfig.container) validContainers = await  AuthorizationManagement.getValidContainers(coreApi, accessKey, validNamespaces, validPodNames, instanceConfig.container.split(','))
    console.log('validContainers:', validContainers)
    
    switch (instanceConfig.action) {
        case InstanceMessageActionEnum.COMMAND:
            if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
                console.log('Processing immediate request')
                if (validNamespaces.includes(instanceConfig.namespace)) {
                    if (validPodNames.includes(instanceConfig.pod)) {
                        if (instanceConfig.container !== '' && instanceConfig.container) {
                            let containerAuthorized = accessKeyResources.some (r => r.namespaces === instanceConfig.namespace && r.pods === instanceConfig.pod && r.containers === instanceConfig.container)
                            if (containerAuthorized) {
                                processChannelCommand(webSocket, instanceConfig, instanceConfig.namespace, instanceConfig.pod, instanceConfig.container)
                            }
                            else {
                                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Not authorized send immediate command to container ${instanceConfig.namespace}/${instanceConfig.pod}/${instanceConfig.container}`, instanceConfig)
                            }
                        }
                        else {
                            processChannelCommand(webSocket, instanceConfig, instanceConfig.namespace, instanceConfig.pod)
                        }
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Not authorized send immediate command to pod ${instanceConfig.namespace}/${instanceConfig.pod}`, instanceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Not authorized send immediate command to namespace  ${instanceConfig.namespace}`, instanceConfig)
                }
            }
            else {
                processChannelCommand(webSocket, instanceConfig)
            }
            break
        case InstanceMessageActionEnum.START:
            processStartInstanceConfig(webSocket, instanceConfig, accessKeyResources, validNamespaces, validGroups, validPodNames, validContainers)
            break
        case InstanceMessageActionEnum.STOP:
            processStopInstanceConfig(webSocket, instanceConfig)
            break
        case InstanceMessageActionEnum.MODIFY:
            if (channels.get(instanceConfig.channel)?.getChannelData().modifyable) {
                channels.get(instanceConfig.channel)?.modifyInstance(webSocket, instanceConfig)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceConfig.channel} does not support MODIFY`, instanceConfig)
            }
            break
        case InstanceMessageActionEnum.PAUSE:
        case InstanceMessageActionEnum.CONTINUE:   
            if (channels.get(instanceConfig.channel)?.getChannelData().pauseable) {
                processPauseContinueInstanceConfig(instanceConfig, webSocket, instanceConfig.action)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Channel ${instanceConfig.channel} does not support PAUSE/CONTINUE`, instanceConfig)
            }
            break
        default:
            console.log (`Invalid action in instance config: '${instanceConfig.action}'`)
            break
    }
}

// HTTP server
const app = express()
app.use(bodyParser.json())
app.use(cors())
app.use(fileUpload())

const server = http.createServer(app)
const wss = new WebSocketServer({ server, skipUTF8Validation:true  })
wss.on('connection', (webSocket:WebSocket) => {
    console.log('Client connected')

    webSocket.onmessage = (event) => {
        processClientMessage(webSocket, event.data)
    }

    webSocket.onclose = () => {
        console.log('Client disconnected')
        // we do not remove connectios for the client to reconnect. previous code was:
        // for (var channel of channels.keys()) {
        //     channels.get(channel)?.removeConnection(ws)
        // }
    }
})

const runKubernetes = async () => {
    secrets = new KubernetesSecrets(coreApi, kwirthData.namespace)
    configMaps = new KubernetesConfigMaps(coreApi, kwirthData.namespace)

    let lastVersion = await getLastKwirthVersion(kwirthData)
    if (lastVersion) kwirthData.lastVersion = lastVersion

    // serve front
    console.log(`SPA is available at: ${rootPath}/front`)
    app.get(`/`, (_req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

    app.get(`/healthz`, (_req:Request,res:Response) => { res.status(200).send() })

    app.get(`${rootPath}`, (_req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
    app.use(`${rootPath}/front`, express.static('./dist/front'))

    // serve config API
    let ka:ApiKeyApi = new ApiKeyApi(configMaps, masterKey)
    app.use(`${rootPath}/key`, ka.route)
    let va:ConfigApi = new ConfigApi(ka, kwirthData, clusterInfo, channels)
    app.use(`${rootPath}/config`, va.route)
    let sa:StoreApi = new StoreApi(configMaps, ka)
    app.use(`${rootPath}/store`, sa.route)
    let ua:UserApi = new UserApi(secrets, ka)
    app.use(`${rootPath}/user`, ua.route)
    let la:LoginApi = new LoginApi(secrets, configMaps)
    app.use(`${rootPath}/login`, la.route)
    let mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, ka, kwirthData)
    app.use(`${rootPath}/managekwirth`, mk.route)
    let mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi, ka, channels)
    app.use(`${rootPath}/managecluster`, mc.route)
    let ma:MetricsApi = new MetricsApi(clusterInfo, ka)
    app.use(`${rootPath}/metrics`, ma.route)

    for (let channel of channels.values()) {
        let cdata = channel.getChannelData()
        if (cdata.endpoints.length>0) {
            for (let endpoint of cdata.endpoints) {
                console.log(`Will listen on ${rootPath}/channel/${cdata.id}/${endpoint.name}`)
                const router = express.Router()
                router.route('*')
                    .all( async (req:Request,res:Response, next) => {
                        if (endpoint.requiresAccessKey) {
                            if (! (await AuthorizationManagement.validKey(req,res, ka))) return
                        }
                        next()
                    })
                    .get( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('GET')) {
                            try {
                                channel.endpointRequest(endpoint.name, req, res)
                            }
                            catch (err) {
                                // res.status(400).send()
                                // console.log('Error obtaining available metrics list')
                                // console.log(err)
                            }
                        }
                        else {
                            res.status(405)
                        }
                    })
                    .post( async (req:Request, res:Response) => {
                        console.log('oost')
                        if (endpoint.methods.includes('POST')) {
                            try {
                                console.log('invok')
                                channel.endpointRequest(endpoint.name, req, res)
                            }
                            catch (err) {
                                console.log(err)
                                // res.status(400).send()
                                // console.log('Error obtaining available metrics list')
                                // console.log(err)
                            }
                        }
                        else {
                            res.status(405)
                        }
                    })
                    .put( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('PUT')) {
                            try {
                                channel.endpointRequest(endpoint.name, req, res)
                            }
                            catch (err) {
                                // res.status(400).send()
                                // console.log('Error obtaining available metrics list')
                                // console.log(err)
                            }
                        }
                        else {
                            res.status(405)
                        }
                    })
                    .delete( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('DELETE')) {
                            try {
                                channel.endpointRequest(endpoint.name, req, res)
                            }
                            catch (err) {
                                // res.status(400).send()
                                // console.log('Error obtaining available metrics list')
                                // console.log(err)
                            }
                        }
                        else {
                            res.status(405)
                        }
                    })
                app.use(`${rootPath}/channel/${cdata.id}/${endpoint.name}`, router)
            }
        }
    }
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

const initKubernetesCluster = async (token:string, metricsRequired:boolean) : Promise<void> => {
    // initialize cluster
    clusterInfo.token = token
    clusterInfo.kubeConfig = kubeConfig
    clusterInfo.coreApi = coreApi
    clusterInfo.appsApi = appsApi
    clusterInfo.execApi = execApi
    clusterInfo.logApi = logApi
    clusterInfo.crdApi = crdApi
    clusterInfo.rbacApi = rbacApi
    clusterInfo.extensionApi = extensionApi
    clusterInfo.dockerTools = new DockerTools(clusterInfo)

    await clusterInfo.loadKubernetesClusterName()
    clusterInfo.nodes = await clusterInfo.loadNodes()
    console.log('Node info loaded')

    console.log('Source Info')
    console.log('  Name:', clusterInfo.name)
    console.log('  Type:', clusterInfo.type)
    console.log('  Flavour:', clusterInfo.flavour)
    console.log('  Nodes:', clusterInfo.nodes.size)

    if (metricsRequired) {
        clusterInfo.metrics = new Metrics(clusterInfo)
        clusterInfo.metricsInterval = 15
        await clusterInfo.metrics.startMetrics()
        console.log('  vCPU:', clusterInfo.vcpus)
        console.log('  Memory (GB):', clusterInfo.memory/1024/1024/1024)
    }

}

const launchKubernetes = async() => {
    console.log('Start Kubernetes Kwirth')
    kwirthData = await getKubernetesData()
    if (kwirthData) {
        console.log('Initial kwirthData', kwirthData)
        try {
            saToken = new ServiceAccountToken(coreApi, kwirthData.namespace)    
            await saToken.createToken('kwirth-sa',kwirthData.namespace)

            setTimeout ( async () => {
                console.log('Extracting token...')
                let token = await saToken.extractToken('kwirth-sa', kwirthData.namespace)

                if (token)  {
                    console.log('SA token obtained succesfully')

                    // load channel extensions
                    if (channelLogEnabled) channels.set('log', new LogChannel(clusterInfo))
                    if (channelAlertEnabled) channels.set('alert', new AlertChannel(clusterInfo))
                    if (channelMetricsEnabled) channels.set('metrics', new MetricsChannel(clusterInfo))
                    if (channelOpsEnabled) channels.set('ops', new OpsChannel(clusterInfo))
                    if (channelTrivyEnabled) channels.set('trivy', new TrivyChannel(clusterInfo))
                    if (channelEchoEnabled) channels.set('echo', new EchoChannel(clusterInfo))
                    if (channelFilemanEnabled) channels.set('fileman', new FilemanChannel(clusterInfo))

                    kwirthData.channels =  Array.from(channels.keys()).map(k => {
                        return channels.get(k)?.getChannelData()!
                    })

                    // Detect if any channel requires metrics
                    let metricsRequired = Array.from(channels.values()).reduce( (prev, current) => { return prev || current.getChannelData().metrics}, false)
                    console.log('Metrics required: ', metricsRequired)

                    await initKubernetesCluster(token, metricsRequired)
                    clusterInfo.type = kwirthData.clusterType

                    console.log(`Enabled channels for this (kubernetes) run are: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
                    console.log(`Detected own namespace: ${kwirthData.namespace}`)
                    if (kwirthData.deployment !== '')
                        console.log(`Detected own deployment: ${kwirthData.deployment}`)
                    else
                        console.log(`No deployment detected. Kwirth is not running inside a cluster`)

                    console.log('Final kwirthData', kwirthData)
                    runKubernetes()
                }
                else {
                    console.log('SA token is invalid, exiting...')
                }
            }, 1000)
        }
        catch (err){
            console.log(err)
        }
    }
    else {
        console.log('Cannot get kwirthdata, exiting...')
    }    
}

const runDocker = async () => {
    secrets = new DockerSecrets(coreApi, '/secrets')
    configMaps = new DockerConfigMaps(coreApi, '/configmaps')

    let lastVersion = await getLastKwirthVersion(kwirthData)
    if (lastVersion) kwirthData.lastVersion = lastVersion
    
    //serve front
    console.log(`SPA is available at: ${rootPath}/front`)
    app.get(`/`, (_req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

    app.get(`${rootPath}`, (_req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
    app.use(`${rootPath}/front`, express.static('./dist/front'))

    // serve config API
    let ka:ApiKeyApi = new ApiKeyApi(configMaps, masterKey)
    app.use(`${rootPath}/key`, ka.route)
    let ca:ConfigApi = new ConfigApi(ka, kwirthData, clusterInfo, channels)
    ca.setDockerApi(dockerApi)
    app.use(`${rootPath}/config`, ca.route)
    let sa:StoreApi = new StoreApi(configMaps, ka)
    app.use(`${rootPath}/store`, sa.route)
    let ua:UserApi = new UserApi(secrets, ka)
    app.use(`${rootPath}/user`, ua.route)
    let la:LoginApi = new LoginApi(secrets, configMaps)
    app.use(`${rootPath}/login`, la.route)
    let mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, ka, kwirthData)
    app.use(`${rootPath}/managekwirth`, mk.route)
    let mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi, ka, channels)
    app.use(`${rootPath}/managecluster`, mc.route)

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
    kwirthData = {
        namespace: '',
        deployment: '',
        inCluster: false,
        version: VERSION,
        lastVersion: VERSION,
        clusterName: 'inDocker',
        clusterType: ClusterTypeEnum.DOCKER,
        metricsInterval:15,
        channels: []
    }
    clusterInfo.nodes = new Map()
    clusterInfo.metrics = new Metrics(clusterInfo)
    clusterInfo.metricsInterval = 15
    clusterInfo.token = ''
    clusterInfo.dockerApi = dockerApi
    clusterInfo.dockerTools = new DockerTools(clusterInfo)
    clusterInfo.name = 'docker'
    clusterInfo.type = ClusterTypeEnum.DOCKER
    clusterInfo.flavour = 'docker'

    // load channel extensions
    let logChannel = new LogChannel(clusterInfo)
    channels.set('log', logChannel)

    console.log(`Enabled channels for this (docker) run are: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
    runDocker()
}

const startTasks = () => {
    // launch GC every 15 secs
    if (global.gc) {
        console.log('GC will run every 15 secs asynchronously')
        setInterval ( () => {
            if (global.gc) global.gc()
       }, 15000)
    }
    else {
        console.log(`No GC will run. You'd better enable it by adding '--expose-gc' to your node start command`)
    }

    // show heap status every 5 mins
    setInterval ( () => {
        console.log(v8.getHeapStatistics())
    }, 300000)
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

showLogo()
startTasks()

getExecutionEnvironment().then( async (exenv:string) => {
    switch (exenv) {
        case 'windows':
        case 'linux':
            launchDocker()
            break
        case 'kubernetes':
            launchKubernetes()
            break
        default:
            console.log('Unuspported execution environment. Existing...')
        }
})
.catch( (error) => {
    console.log (error)
    console.log ('Cannot determine execution environment')
})
