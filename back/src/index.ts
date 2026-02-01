import { CoreV1Api, AppsV1Api, KubeConfig, KubernetesObjectApi, Log, Watch, Exec, V1Pod, CustomObjectsApi, RbacAuthorizationV1Api, ApiextensionsV1Api, VersionApi, NetworkingV1Api, StorageV1Api, BatchV1Api, AutoscalingV2Api, NodeV1Api, SchedulingV1Api, CoordinationV1Api, AdmissionregistrationV1Api, PolicyV1Api } from '@kubernetes/client-node'
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
import { accessKeyDeserialize, accessKeySerialize, parseResources, ResourceIdentifier, IInstanceConfig, ISignalMessage, IInstanceConfigResponse, IInstanceMessage, KwirthData, IRouteMessage, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ESignalMessageLevel, ESignalMessageEvent, EInstanceConfigView, EClusterType } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { AuthorizationManagement } from './tools/AuthorizationManagement'

import express, { NextFunction, Request, Response} from 'express'
import cookieParser from 'cookie-parser'
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware'
import { ClusterInfo } from './model/ClusterInfo'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuid } from 'uuid'

import { MetricsTools } from './tools/MetricsTools'
import { LogChannel } from './channels/log/LogChannel'
import { AlertChannel } from './channels/alert/AlertChannel'
import { MetricsChannel } from './channels/metrics/MetricsChannel'
import { ISecrets } from './tools/ISecrets'
import { IConfigMaps } from './tools/IConfigMap'
import { DockerSecrets } from './tools/DockerSecrets'
import { DockerConfigMaps } from './tools/DockerConfigMaps'
import { DockerTools } from './tools/DockerTools'
import { OpsChannel } from './channels/ops/OpsChannel'
import { TrivyChannel } from './channels/trivy/TrivyChannel'
import { IChannel } from './channels/IChannel'
import { EchoChannel } from './channels/echo/EchoChannel'
import { FilemanChannel } from './channels/fileman/FilemanChannel'

import { IncomingMessage } from 'http'
import { MagnifyChannel } from './channels/magnify/MagnifyChannel'
import { EventsTools } from './tools/EventsTools'

import fileUpload from 'express-fileupload'
import v8 from 'node:v8'
import http from 'http'
import bodyParser from 'body-parser'
import cors from 'cors'
import { Application } from 'express-serve-static-core'

const isElectron = false
const app : Application = express()

interface IRunningInstance {
    electronContext?: string
    clusterInfo: ClusterInfo
    kwirthData: KwirthData
    secrets: ISecrets
    configMaps: IConfigMaps
}
var runningInstances:IRunningInstance[] = []

const envRootPath = process.env.ROOTPATH || ''
const envMasterKey = process.env.MASTERKEY || 'Kwirth4Ever'
const envForward = (process.env.FORWARD || 'true').toLowerCase() === 'true'
const PORT = +(process?.env?.PORT || '3883')
const envMetricsInterval = process.env.METRICSINTERVAL? +process.env.METRICSINTERVAL : 15
const envChannelLogEnabled = (process.env.CHANNEL_LOG || 'true').toLowerCase() === 'true'
const envChannelMetricsEnabled = (process.env.CHANNEL_METRICS || 'true').toLowerCase() === 'true'
const envChannelAlertEnabled = (process.env.CHANNEL_ALERT || 'true').toLowerCase() === 'true'
const envChannelOpsEnabled = (process.env.CHANNEL_OPS || 'true').toLowerCase() === 'true'
const envChannelTrivyEnabled = (process.env.CHANNEL_TRIVY || 'true').toLowerCase() === 'true'
const envChannelEchoEnabled = (process.env.CHANNEL_ECHO || 'true').toLowerCase() === 'true'
const envChannelFilemanEnabled = (process.env.CHANNEL_FILEMAN || 'true').toLowerCase() === 'true'
const envChannelMagnifyEnabled = (process.env.CHANNEL_MAGNIFY || 'true').toLowerCase() === 'true'

const getExecutionEnvironment = async ():Promise<string> => {
    console.log('Detecting execution environment...')

    console.log('Trying Electron...')
    
    if (isElectron) {
        return 'electron'
    }
    // we keep this order of detection, since kubernetes also has a docker engine
    console.log('Trying Kubernetes...')
    try {
        let kc = new KubeConfig()
        kc.loadFromDefault()
        let coreApi = kc.makeApiClient(CoreV1Api)
        await coreApi.listPodForAllNamespaces()
        return 'kubernetes'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }

    console.log('Trying Linux docker...')
    try {
        let dockerApiLinux = new Docker({ socketPath: '/var/run/docker.sock'})
        await dockerApiLinux.listContainers( { all:false } )
        return 'linuxdocker'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }

    console.log('Trying Windows docker...')
    try {
        let dockerApiWindows = new Docker({ socketPath: '//./pipe/docker_engine' })
        await dockerApiWindows.listContainers( { all:false } )
        return 'windowsdocker'
    }
    catch (err) {
        console.log(err)
        console.log('================================================')
    }
    return 'undetected'
}

const getKubernetesKwirthData = async ():Promise<KwirthData> => {
    let podName=process.env.HOSTNAME
    let kc = new KubeConfig()
    kc.loadFromDefault()
    let coreApi = kc.makeApiClient(CoreV1Api)
    let appsApi = kc.makeApiClient(AppsV1Api)

    const pods = await coreApi.listPodForAllNamespaces()
    const pod = pods.items.find(p => p.metadata?.name === podName)  
    if (pod && pod.metadata?.namespace) {
        let depName = (await AuthorizationManagement.getPodControllerName(appsApi, pod, true)) || ''
        return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true, isElectron:false, version:VERSION, lastVersion: VERSION, clusterType: EClusterType.KUBERNETES, metricsInterval:15, channels: [] }
    }
    else {
        // kwirth is supposed to be running outside of cluster, so we look for kwirth users config in order to detect namespace
        let allSecrets = (await coreApi.listSecretForAllNamespaces()).items
        let usersSecret = allSecrets.find(s => s.metadata?.name === 'kwirth-users')
        if (!usersSecret) usersSecret = allSecrets.find(s => s.metadata?.name === 'kwirth.users')
        if (usersSecret) {
            // this namespace will be used to access secrets and configmaps
            return { clusterName: 'inCluster', namespace:usersSecret.metadata?.namespace!, deployment:'', inCluster:false, isElectron:isElectron, version:VERSION, lastVersion: VERSION, clusterType: EClusterType.KUBERNETES, metricsInterval:15, channels: [] }
        }
        else {
            console.log('Cannot determine namespace while running outside cluster')
            process.exit(1)
        }
    }
}

const createRunningInstance = async (context:string|undefined, kwirthData:KwirthData):Promise<IRunningInstance> => {
    let kc = new KubeConfig()
    kc.loadFromDefault()
    if (context) kc.setCurrentContext(context)

    let coreApi = kc.makeApiClient(CoreV1Api)

    console.log('Creating token...')
    let saToken = new ServiceAccountToken(coreApi, kwirthData.namespace)
    await saToken.createToken('kwirth-sa',kwirthData.namespace)
    let token = undefined
    while (!token) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        token = await saToken.extractToken('kwirth-sa', kwirthData.namespace)
    }
    if (!token) {
        console.log('No token.')
        process.exit(1)
    }
    else {
        console.log('Got token...')
    }

    let clusterInfo = new ClusterInfo()
    clusterInfo.kubeConfig = kc
    clusterInfo.coreApi= coreApi
    clusterInfo.versionApi = kc.makeApiClient(VersionApi)    
    clusterInfo.appsApi= kc.makeApiClient(AppsV1Api)
    clusterInfo.networkApi= kc.makeApiClient(NetworkingV1Api)
    clusterInfo.crdApi= kc.makeApiClient(CustomObjectsApi)
    clusterInfo.rbacApi= kc.makeApiClient(RbacAuthorizationV1Api)
    clusterInfo.extensionApi= kc.makeApiClient(ApiextensionsV1Api)
    clusterInfo.storageApi= kc.makeApiClient(StorageV1Api)
    clusterInfo.batchApi= kc.makeApiClient(BatchV1Api)
    clusterInfo.autoscalingApi= kc.makeApiClient(AutoscalingV2Api)
    clusterInfo.schedulingApi= kc.makeApiClient(SchedulingV1Api)
    clusterInfo.coordinationApi= kc.makeApiClient(CoordinationV1Api)
    clusterInfo.admissionApi= kc.makeApiClient(AdmissionregistrationV1Api)
    clusterInfo.policyApi= kc.makeApiClient(PolicyV1Api)
    clusterInfo.nodeApi = kc.makeApiClient(NodeV1Api)
    clusterInfo.objectsApi = KubernetesObjectApi.makeApiClient(kc)
    clusterInfo.execApi = new Exec(clusterInfo.kubeConfig)
    clusterInfo.logApi = new Log(clusterInfo.kubeConfig)
    clusterInfo.saToken = saToken
    clusterInfo.token = token!

    clusterInfo.setKubernetesClusterName()
    clusterInfo.nodes = await clusterInfo.getNodes()
    
    let ri:IRunningInstance = {
        kwirthData: kwirthData,
        clusterInfo: clusterInfo,
        secrets: new KubernetesSecrets(coreApi, kwirthData.namespace),
        configMaps: new KubernetesConfigMaps(coreApi, kwirthData.namespace),
    }
    return ri
}

const sendChannelSignal = (webSocket: WebSocket, level: ESignalMessageLevel, text: string, instanceMessage: IInstanceMessage, localChannels:Map<string,IChannel>) => {
    if (localChannels.has(instanceMessage.channel)) {
        let signalMessage:ISignalMessage = {
            action: instanceMessage.action,
            flow: EInstanceMessageFlow.RESPONSE,
            level,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            type: EInstanceMessageType.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }
    else {
        console.log(`Unsupported channel '${instanceMessage.channel}' for sending signals`)
    }
}

const sendChannelSignalAsset = (webSocket: WebSocket, level: ESignalMessageLevel, event: ESignalMessageEvent, text: string, instanceMessage: IInstanceMessage, localChannels:Map<string,IChannel>, namespace:string, pod:string, container?:string) => {
    if (localChannels.has(instanceMessage.channel)) {
        let signalMessage:ISignalMessage = {
            action: EInstanceMessageAction.NONE,
            flow: EInstanceMessageFlow.UNSOLICITED,
            level,
            channel: instanceMessage.channel,
            instance: instanceMessage.instance,
            type: EInstanceMessageType.SIGNAL,
            namespace,
            pod,
            ...(container? {container}: {}),
            event,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }
    else {
        console.log(`Channel '${instanceMessage.channel}' is unsupported sneding asset info`)
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Channel '${instanceMessage.channel}' is unsupported sending asset info`, instanceMessage, localChannels)
    }
}

const sendInstanceConfigSignalMessage = (ws:WebSocket, action:EInstanceMessageAction, flow: EInstanceMessageFlow, channel: string, instanceMessage:IInstanceMessage, text:string, data?:any) => {
    let resp:IInstanceConfigResponse = {
        action,
        flow,
        channel,
        instance: instanceMessage.instance,
        ...(data!==undefined? {data}: {}),
        type: EInstanceMessageType.SIGNAL,
        text
    }
    ws.send(JSON.stringify(resp))
}

const addObject = async (webSocket:WebSocket, instanceConfig:IInstanceConfig, podNamespace:string, podName:string, containerName:string, localChannels:Map<string,IChannel>) => {
    try {
        console.log(`Object review '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)

        let valid = AuthorizationManagement.checkAkr(localChannels, instanceConfig, podNamespace, podName, containerName)
        if (!valid) {
            console.log(`No AKR found for object : ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
            return
        }

        console.log(`Level is enough for adding object: ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)

        if(localChannels.has(instanceConfig.channel)) {
            let channel = localChannels.get(instanceConfig.channel)!
            if (channel?.containsAsset(webSocket, podNamespace, podName, containerName)) {
                console.log(`Existing asset '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
            }
            else {
                console.log(`addObject '${instanceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view}) (instance: ${instanceConfig.instance})`)
                await channel.addObject(webSocket, instanceConfig, podNamespace, podName, containerName)
                sendChannelSignalAsset(webSocket, ESignalMessageLevel.INFO, ESignalMessageEvent.ADD, `Container ADDED: ${podNamespace}/${podName}/${containerName}`, instanceConfig, localChannels, podNamespace, podName, containerName)
            }
        }
        else {
            console.log(`Invalid channel`, instanceConfig.channel)
        }
    }
    catch (err) {
        console.error('Error adding object', err)
    }
}

const deleteObject = async (webSocket:WebSocket, _eventType:string, podNamespace:string, podName:string, containerName:string, instanceConfig:IInstanceConfig, localChannels:Map<string,IChannel>) => {
    if(localChannels.has(instanceConfig.channel)) {
        localChannels.get(instanceConfig.channel)?.deleteObject(webSocket, instanceConfig, podNamespace, podName, containerName)
        sendChannelSignalAsset(webSocket, ESignalMessageLevel.INFO, ESignalMessageEvent.DELETE, `Container DELETED: ${podNamespace}/${podName}/${containerName}`, instanceConfig, localChannels, podNamespace, podName, containerName)
    }
    else {
        console.log(`Invalid channel`, instanceConfig.channel)
    }
}

const processEvent = async (eventType:string, obj: any, webSocket:WebSocket, instanceConfig:IInstanceConfig, podNamespace:string, podName:string, containers:string[], localChannels:Map<string,IChannel>) => {
    // +++ if (eventType === 'ADDED' && (obj.status.phase.toLowerCase()==='running' || obj.status.phase.toLowerCase()==='succeeded')) {
    if (eventType === 'ADDED') {
        console.log('eventype',eventType, podNamespace, podName, obj.status.phase)
        for (let container of containers) {
            let containerName = container
            switch (instanceConfig.view) {
                case EInstanceConfigView.NAMESPACE:
                    console.log('Namespace event')
                    console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on namespace`)
                    await addObject(webSocket, instanceConfig, podNamespace, podName, containerName, localChannels)
                    break
                case EInstanceConfigView.GROUP:
                    console.log('Group event')
                    let [_groupType, groupName] = instanceConfig.group.split('+')
                    // we rely on kubernetes naming conventions here (we could query k8 api to discover group the pod belongs to)
                    if (podName.startsWith(groupName)) {  
                        console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on group`)
                        await addObject(webSocket, instanceConfig, podNamespace, podName, containerName, localChannels)
                        break
                    }
                    console.log(`Excluded group: ${groupName}`)
                    break
                case EInstanceConfigView.POD:
                    console.log('Pod event')
                    if ((instanceConfig.namespace==='' || (instanceConfig.namespace!=='' && instanceConfig.namespace.split(',').includes(podNamespace))) && instanceConfig.pod.split(',').includes(podName)) {
                        if (instanceConfig.pod.split(',').includes(podName)) {
                            console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on pod`)
                            await addObject(webSocket, instanceConfig, podNamespace, podName, containerName, localChannels)
                            break
                        }
                    }
                    console.log(`Excluded pod: ${podName}`)
                    break
                case EInstanceConfigView.CONTAINER:
                    console.log('Container event')
                    // container has the form: podname+containername (includes a plus sign as separating char)
                    let instanceContainers = Array.from (new Set (instanceConfig.container.split(',').map (c => c.split('+')[1])))
                    let instancePods = Array.from (new  Set (instanceConfig.container.split(',').map (c => c.split('+')[0])))
                    if (instanceContainers.includes(containerName) && instancePods.includes(podName)) {
                        if (instanceConfig.container.split(',').includes(podName+'+'+containerName)) {
                            console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName} on container`)
                            await addObject(webSocket, instanceConfig, podNamespace, podName, containerName, localChannels)
                            break
                        }
                    }
                    console.log(`Excluded container: ${containerName}`)
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
            processEvent('ADDED', obj, webSocket, instanceConfig, podNamespace, podName, containerNames, localChannels)
        }
        else {
            // modifyObject(webSocket, eventType, podNamespace, podName, '', instanceConfig)
            // sendChannelSignalAsset(webSocket, SignalMessageLevelEnum.INFO, SignalMessageEventEnum.OTHER, `Pod MODIFIED: ${podNamespace}/${podName}`, instanceConfig, podNamespace, podName, '')
        }
    }
    else if (eventType === 'DELETED') {
        console.log('eventype', eventType, podNamespace, podName, obj.status.phase)
        deleteObject(webSocket, eventType, podNamespace, podName, '', instanceConfig, localChannels)
    }
    else {
        console.log(`Pod ${eventType} is unmanaged`)
        sendChannelSignalAsset(webSocket, ESignalMessageLevel.INFO, ESignalMessageEvent.OTHER, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, instanceConfig, localChannels, podNamespace, podName)
    }
}

const watchDockerPods = async (_apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:IInstanceConfig, localClusterInfo:ClusterInfo, localChannels:Map<string,IChannel>) => {
    //launch included containers

    if (instanceConfig.view==='pod') {
        let kvps:string[] = queryParams.labelSelector.split(',')
        const jsonObject: { [key: string]: string } = {}
        kvps.forEach(kvp => {
            const [key, value] = kvp.split('=')
            jsonObject[key] = value
        })

        let containers = await localClusterInfo.dockerTools.getContainers(jsonObject['kwirthDockerPodName'])
        for (let container of containers) {
            processEvent('ADDED', null, webSocket, instanceConfig, '$docker', jsonObject['kwirthDockerPodName'], [ container ], localChannels )
        }
    }
    else if (instanceConfig.view==='container') {
        let kvps:string[] = queryParams.labelSelector.split(',')
        const jsonObject: { [key: string]: string } = {}
        kvps.forEach(kvp => {
            const [key, value] = kvp.split('=')
            jsonObject[key] = value
        })
        let podName=jsonObject['kwirthDockerPodName']
        let containerName = jsonObject['kwirthDockerContainerName']
        let id = await localClusterInfo.dockerTools.getContainerId(podName, containerName )
        if (id) {
            processEvent('ADDED', null, webSocket, instanceConfig, '$docker', podName, [ containerName ], localChannels)
        }
        else {
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Container ${podName}/${containerName} does not exist.`, instanceConfig, localChannels)
        }
    }
}

const watchKubernetesPods = async (kubeConfig:KubeConfig, apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:IInstanceConfig, localChannels:Map<string,IChannel>) => {
    const watch = new Watch(kubeConfig)

    await watch.watch(apiPath, queryParams, (eventType:string, obj:any) => {
        let podName:string = obj.metadata.name
        let podNamespace:string = obj.metadata.namespace

        // +++ review event management
        // if (obj.status.phase.toLowerCase()!=='running') {
        //     console.log('Not running pod:', podNamespace+'/'+podName, obj.status.phase.toLowerCase())
        //     return
        // }
        // console.log('Add containers if needed')
        let containerNames = obj.spec.containers.map( (c: any) => c.name)
        processEvent(eventType, obj, webSocket, instanceConfig, podNamespace, podName, containerNames, localChannels)
    },
    (err) => {
        if (err !== null) {
            console.log('Generic error starting watchPods')
            console.log(err)
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, JSON.stringify(err), instanceConfig, localChannels)
        }
        else {
            // watch method launches a 'done' invocation several minutes after starting streaming, I don't know why.
        }
    })
}

const watchPods = async (localClusterInfo:ClusterInfo, localKwirthData:KwirthData, apiPath:string, queryParams:any, webSocket:WebSocket, instanceConfig:IInstanceConfig, localChannels:Map<string,IChannel>) => {
    if (localKwirthData.clusterType === EClusterType.DOCKER) {
        watchDockerPods(apiPath, queryParams, webSocket, instanceConfig, localClusterInfo, localChannels)
    }
    else {
        await watchKubernetesPods(localClusterInfo.kubeConfig, apiPath, queryParams, webSocket, instanceConfig, localChannels)
    }
}

const getRequestedValidatedScopedPods = async (localClusterInfo:ClusterInfo, localKwirthData:KwirthData, instanceConfig:IInstanceConfig, localChannels:Map<string,IChannel>, accessKeyResources:ResourceIdentifier[], validNamespaces:string[], validPodNames:string[], validContainers:string[], ) => {
    let selectedPods:V1Pod[] = []
    let allPods:V1Pod[] = []

    if (localKwirthData.clusterType === EClusterType.DOCKER)
        allPods = await localClusterInfo.dockerTools.getAllPods()
    else {
        for (let ns of validNamespaces) {
            allPods.push(...(await localClusterInfo.coreApi.listNamespacedPod({namespace: ns})).items)
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

            let foundKeyResource = false
            for (let c of containerNames) {
                if (AuthorizationManagement.checkAkr(localChannels, instanceConfig, podNamespace, podName, c)) {
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

const processReconnect = async (webSocket: WebSocket, instanceMessage: IInstanceMessage, localChannels:Map<string,IChannel>) => {
    console.log(`Trying to reconnect instance '${instanceMessage.instance}' on channel ${instanceMessage.channel}`)
    for (let channel of localChannels.values()) {
        console.log('Review channel for reconnect:', channel.getChannelData().id)
        if (channel.containsInstance(instanceMessage.instance)) {
            console.log('Found channel', channel.getChannelData().id)
            let updated = channel.updateConnection(webSocket, instanceMessage.instance)
            if (updated) {
                sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.RECONNECT, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Reconnect successful')
                return
            }
            else {
                sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.RECONNECT, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'An error has ocurred while updating connection')
                return
            }
        }
        else {
            console.log(`Instance '${instanceMessage.instance}' not found on channel ${channel.getChannelData().id} for reconnect`)
        }
    }
    console.log(`Instance '${instanceMessage.instance}' found for reconnect in no channels`)
    sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.RECONNECT, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for reconnect', false)
}

const processStartInstanceConfig = async (localClusterInfo:ClusterInfo, localKwirthData:KwirthData, webSocket: WebSocket, instanceConfig: IInstanceConfig,localChannels:Map<string,IChannel>,  accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validPodNames: string[], validContainers: string[]) => {
    console.log(`Trying to perform instance config for channel '${instanceConfig.channel}' with view '${instanceConfig.view}'`)
    let requestedValidatedPods = await getRequestedValidatedScopedPods(localClusterInfo, localKwirthData, instanceConfig, localChannels, accessKeyResources, validNamespaces, validPodNames, validContainers)
    if (requestedValidatedPods.length === 0) {
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: there are no filters that match requested instance config`, instanceConfig, localChannels)
        return
    }
    
    // we confirm startInstance is ok prior to launching watchPods (because client needs to know instanceId)
    instanceConfig.instance = uuid()

    switch (instanceConfig.view) {
        case EInstanceConfigView.NAMESPACE:
            for (let ns of validNamespaces) {
                await watchPods(localClusterInfo, localKwirthData, `/api/v1/namespaces/${ns}/${instanceConfig.objects}`, {}, webSocket, instanceConfig, localChannels)
            }
            break
        case EInstanceConfigView.GROUP:
            for (let namespace of validNamespaces) {
                for (let gTypeName of instanceConfig.group.split(',')) {
                    let groupPods = await AuthorizationManagement.getPodLabelSelectorsFromGroup(localClusterInfo.coreApi, localClusterInfo.appsApi, localClusterInfo.batchApi, namespace, gTypeName)
                    if (groupPods.pods.length > 0) {
                        let specificInstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.group = gTypeName
                        await watchPods(localClusterInfo, localKwirthData, `/api/v1/namespaces/${namespace}/${instanceConfig.objects}`, { labelSelector: groupPods.labelSelector }, webSocket, specificInstanceConfig, localChannels)
                    }
                    else
                        console.log(`No pods on namespace ${namespace}`)
                }
            }
            break
        case EInstanceConfigView.POD:
            for (let podName of instanceConfig.pod.split(',')) {
                let validPod = requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels
                    if (metadataLabels) {
                        if (localKwirthData.clusterType === EClusterType.DOCKER) {
                            metadataLabels['kwirthDockerPodName'] = podName
                        }

                        let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificInstanceConfig: IInstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.pod = podName
                        await watchPods(localClusterInfo, localKwirthData, `/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig, localChannels)
                    }
                    else {
                        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: cannot get metadata labels for pod '${podName}'`, instanceConfig, localChannels)
                    }
                }
                else {
                    sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: your accesskey has no access to pod '${podName}' (or pod does not exsist) for pod access`, instanceConfig, localChannels)
                }
            }
            break
        case EInstanceConfigView.CONTAINER:
            for (let container of instanceConfig.container.split(',')) {
                let [podName, containerName] = container.split('+')
                let validPod = requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels

                    if (metadataLabels) {
                        if (localKwirthData.clusterType === EClusterType.DOCKER) {
                            metadataLabels['kwirthDockerContainerName'] = containerName
                            metadataLabels['kwirthDockerPodName'] = podName
                        }
    
                        let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificInstanceConfig: IInstanceConfig = JSON.parse(JSON.stringify(instanceConfig))
                        specificInstanceConfig.container = container
                        await watchPods(localClusterInfo, localKwirthData, `/api/v1/${instanceConfig.objects}`, { labelSelector }, webSocket, specificInstanceConfig, localChannels)
                    }
                    else {
                        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: cannot get metadata labels for container '${podName}/${containerName}'`, instanceConfig, localChannels)
                    }
                }
                else {
                    sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: your accesskey has no access to container '${podName}' (or pod does not exsist) for container access`, instanceConfig, localChannels)
                }
            }
            break
        default:
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Access denied: invalid view '${instanceConfig.view}'`, instanceConfig, localChannels)
            break
    }
    sendInstanceConfigSignalMessage(webSocket,EInstanceMessageAction.START, EInstanceMessageFlow.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance Config accepted')
}

const processStopInstanceConfig = async (webSocket: WebSocket, instanceConfig: IInstanceConfig, localChannels:Map<string,IChannel>) => {
    if (localChannels.has(instanceConfig.channel)) {
        localChannels.get(instanceConfig.channel)?.stopInstance(webSocket, instanceConfig)
    }
    else {
        console.log('Invalid channel on instance stop')
    }
}

const processPauseContinueInstanceConfig = async (instanceConfig: IInstanceConfig, webSocket: WebSocket, _action:EInstanceMessageAction, localChannels:Map<string,IChannel>) => {
    if (localChannels.has(instanceConfig.channel)) {
        localChannels.get(instanceConfig.channel)?.pauseContinueInstance(webSocket, instanceConfig, instanceConfig.action)
    }
    else {
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Instance ${instanceConfig.channel} does not exist`, instanceConfig, localChannels)
    }
}

const processPing = (webSocket:WebSocket, instanceMessage:IInstanceMessage, localChannels:Map<string,IChannel>): void => {
    if (!localChannels.has(instanceMessage.channel)) {
        sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.PING, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Channel not found for ping')
        return
    }
    let channel = localChannels.get(instanceMessage.channel)!
    if (channel.containsConnection(webSocket)) {
        let refreshed = channel.refreshConnection(webSocket)
        if (refreshed) {
            sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.PING, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'OK')
            return
        }
        else {
            sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.PING, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'An error has ocurred while refreshing connection')
            return
        }
    }
    else {
        console.log(`Ping socket not found on channel ${instanceMessage.channel}`)
    }
    sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.PING, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
}

const processChannelCommand = async (webSocket: WebSocket, instanceMessage: IInstanceMessage,  localChannels:Map<string,IChannel>, podNamespace?:string, podName?:string, containerName?:string): Promise<void> => {
    try {
        let channel = localChannels.get(instanceMessage.channel)
        if (channel) {
            let instance = channel.containsInstance(instanceMessage.instance)
            if (instance) {
                channel.processCommand(webSocket, instanceMessage, podNamespace, podName, containerName)
            }
            else {
                // we have no instance, may be an IMMED command
                if (instanceMessage.flow === EInstanceMessageFlow.IMMEDIATE) {
                    console.log(`Process IMMEDIATE command`)
                    channel.processCommand(webSocket, instanceMessage, podNamespace, podName, containerName)
                }
                else {
                    console.log(`Instance '${instanceMessage.instance}' not found for command`)
                    sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for command')
                }
            }   
        }
        else {
            console.log(`Channel not found`)
            sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
        }
    }
    catch (err) {
        console.error('Error on processCommand')
        console.error(err)
    }
}

const processChannelRoute = async (localClusterInfo:ClusterInfo, localKwirthData:KwirthData, webSocket: WebSocket, instanceMessage: IInstanceMessage, localChannels:Map<string,IChannel>): Promise<void> => {
    let channel = localChannels.get(instanceMessage.channel)
    if (channel) {
        let instance = channel.containsInstance(instanceMessage.instance)
        if (instance) {
            let routeMessage = instanceMessage as IRouteMessage
            if (localChannels.has(routeMessage.destChannel)) {
                if (localChannels.get(routeMessage.destChannel)?.getChannelData().routable) {
                    console.log(`Routing message to channel ${routeMessage.destChannel}`)
                    processClientMessage (webSocket, JSON.stringify(routeMessage.data), localClusterInfo, localKwirthData, localChannels)
                }
                else {
                    console.log(`Destination channel (${routeMessage.destChannel}) for 'route' command doesn't support routing`)
                }
            }
            else {
                console.log(`Destination channel '${routeMessage.destChannel}' does not exist for instance '${instanceMessage.instance}'`)
                sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, `Dest channel ${routeMessage.destChannel} does not exist`)
            }
        }
        else {
            console.log(`Instance '${instanceMessage.instance}' not found on channel ${channel.getChannelData().id} for route`)
            sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Instance has not been found for routing')
        }   
    }
    else {
        console.log(`Socket not found for routing`)
        sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceMessage.channel, instanceMessage, 'Socket has not been found')
    }
}

const processChannelWebsocket = async (localClusterInfo:ClusterInfo, webSocket: WebSocket, instanceConfig: IInstanceConfig, localChannels:Map<string,IChannel>): Promise<void> => {
    let channel = localChannels.get(instanceConfig.channel)
    if (channel) {
        let instance = channel.containsInstance(instanceConfig.instance)
        if (instance) {
            let response: IInstanceConfigResponse = {
                text: 'WebSocket accepted',
                action: EInstanceMessageAction.WEBSOCKET,
                flow: EInstanceMessageFlow.RESPONSE,
                type: EInstanceMessageType.DATA,
                channel: channel.getChannelData().id,
                data: uuid(),
                instance: instanceConfig.instance
            }
            localClusterInfo.pendingWebsocket.push({
                channel: channel.getChannelData().id,
                instance: instanceConfig.instance,
                challenge: response.data,
                instanceConfig: instanceConfig
            })
            webSocket.send(JSON.stringify(response))
        }
        else {
            console.log(`Instance '${instanceConfig.instance}' not found on channel ${channel.getChannelData().id} for route`)
            sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceConfig.channel, instanceConfig, 'Instance has not been found for WEBSOCKET request')
        }   
    }
    else {
        console.log(`Socket not found for routing`)
        sendInstanceConfigSignalMessage(webSocket, EInstanceMessageAction.COMMAND, EInstanceMessageFlow.RESPONSE, instanceConfig.channel, instanceConfig, 'Socket has not been found')
    }
}

const processClientMessage = async (webSocket:WebSocket, message:string, localClusterInfo:ClusterInfo, localKwirthData:KwirthData, localChannels:Map<string,IChannel>) => {
    const instanceMessage = JSON.parse(message) as IInstanceMessage

    if (instanceMessage.flow !== EInstanceMessageFlow.REQUEST && instanceMessage.flow !== EInstanceMessageFlow.IMMEDIATE) {
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, 'Invalid flow received', instanceMessage, localChannels)
        return
    }

    if (instanceMessage.action === EInstanceMessageAction.PING) {
        processPing(webSocket, instanceMessage, localChannels)
        return
    }

    if (!localChannels.has(instanceMessage.channel)) {
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, 'Unsupported channel in this Kwirth deployment', instanceMessage, localChannels)
        return
    }

    console.log('Received request:', instanceMessage.flow, instanceMessage.action, instanceMessage.channel)
    if (instanceMessage.action === EInstanceMessageAction.RECONNECT) {
        console.log('Reconnect received')
        if (!localChannels.get(instanceMessage.channel)?.getChannelData().reconnectable) {
            console.log(`Reconnect capability not enabled for channel ${instanceMessage.channel} and instance ${instanceMessage.instance}`)
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Channel ${instanceMessage.channel} does not support reconnect`, instanceMessage, localChannels)
            return
        }
        processReconnect (webSocket, instanceMessage, localChannels)
        return
    }

    if (instanceMessage.action === EInstanceMessageAction.ROUTE) {
        let routeMessage = instanceMessage as IRouteMessage
        console.log(`Route received from channel ${instanceMessage.channel} to ${routeMessage.destChannel}`)
        processChannelRoute (localClusterInfo, localKwirthData, webSocket, instanceMessage, localChannels)
        return
    }

    const instanceConfig = JSON.parse(message) as IInstanceConfig
    if (!instanceConfig.accessKey) {
        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, 'No access key received', instanceConfig, localChannels)
        return
    }

    let accessKey = accessKeyDeserialize(instanceConfig.accessKey)
    if (accessKey.type.toLowerCase().startsWith('bearer:')) {
        if (!AuthorizationManagement.validBearerKey(envMasterKey, accessKey)) {
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Invalid bearer access key: ${instanceConfig.accessKey}`, instanceConfig, localChannels)
            return
        }       
    }
    else {
        if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===instanceConfig.accessKey)) {
            sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Invalid API key: ${instanceConfig.accessKey}`, instanceConfig, localChannels)
            return
        }
    }

    // +++ maybe we can perform this things later when knowing what the action is
    let accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resources)

    let validNamespaces:string[] = []
    if (instanceConfig.namespace) validNamespaces = await AuthorizationManagement.getValidNamespaces(localClusterInfo.coreApi, accessKey, instanceConfig.namespace.split(','))
    console.log('validNamespaces:', validNamespaces)

    let validGroups:string[] = []
    if (instanceConfig.group) validGroups = await AuthorizationManagement.getValidGroups(localClusterInfo.coreApi, localClusterInfo.appsApi, localClusterInfo.batchApi, accessKey, validNamespaces, instanceConfig.group.split(','))
    console.log('validGroups:', validGroups)

    let validPodNames:string[] = []
    if (localKwirthData.clusterType === EClusterType.DOCKER) {
        validPodNames = await localClusterInfo.dockerTools.getAllPodNames()
    }
    else {
        if (instanceConfig.pod) validPodNames = await AuthorizationManagement.getValidPods(localClusterInfo.coreApi, localClusterInfo.appsApi, validNamespaces, accessKey, instanceConfig.pod.split(','))
    }
    console.log('validPods:', validPodNames)

    let validContainers:string[] = []
    if (instanceConfig.container) validContainers = await  AuthorizationManagement.getValidContainers(localClusterInfo.coreApi, accessKey, validNamespaces, validPodNames, instanceConfig.container.split(','))
    console.log('validContainers:', validContainers)
    
    switch (instanceConfig.action) {
        case EInstanceMessageAction.COMMAND:
            if (instanceMessage.flow === EInstanceMessageFlow.IMMEDIATE) {
                console.log('Processing immediate request')
                if (validNamespaces.includes(instanceConfig.namespace)) {
                    if (validPodNames.includes(instanceConfig.pod)) {
                        if (instanceConfig.container !== '' && instanceConfig.container) {
                            let containerAuthorized = accessKeyResources.some (r => r.namespaces === instanceConfig.namespace && r.pods === instanceConfig.pod && r.containers === instanceConfig.container)
                            if (containerAuthorized) {
                                processChannelCommand(webSocket, instanceConfig, localChannels, instanceConfig.namespace, instanceConfig.pod, instanceConfig.container)
                            }
                            else {
                                sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Not authorized send immediate command to container ${instanceConfig.namespace}/${instanceConfig.pod}/${instanceConfig.container}`, instanceConfig, localChannels)
                            }
                        }
                        else {
                            processChannelCommand(webSocket, instanceConfig, localChannels, instanceConfig.namespace, instanceConfig.pod)
                        }
                    }
                    else {
                        sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Not authorized send immediate command to pod ${instanceConfig.namespace}/${instanceConfig.pod}`, instanceConfig, localChannels)
                    }
                }
                else {
                    sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Not authorized send immediate command to namespace  ${instanceConfig.namespace}`, instanceConfig, localChannels)
                }
            }
            else {
                processChannelCommand(webSocket, instanceConfig, localChannels)
            }
            break
        case EInstanceMessageAction.WEBSOCKET:
            processChannelWebsocket (localClusterInfo, webSocket, instanceConfig, localChannels)
            break

        case EInstanceMessageAction.START:
            processStartInstanceConfig(localClusterInfo, localKwirthData, webSocket, instanceConfig, localChannels, accessKeyResources, validNamespaces, validPodNames, validContainers)
            break
        case EInstanceMessageAction.STOP:
            processStopInstanceConfig(webSocket, instanceConfig, localChannels)
            break
        case EInstanceMessageAction.MODIFY:
            if (localChannels.get(instanceConfig.channel)?.getChannelData().modifyable) {
                localChannels.get(instanceConfig.channel)?.modifyInstance(webSocket, instanceConfig)
            }
            else {
                sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Channel ${instanceConfig.channel} does not support MODIFY`, instanceConfig, localChannels)
            }
            break
        case EInstanceMessageAction.PAUSE:
        case EInstanceMessageAction.CONTINUE:   
            if (localChannels.get(instanceConfig.channel)?.getChannelData().pauseable) {
                processPauseContinueInstanceConfig(instanceConfig, webSocket, instanceConfig.action, localChannels)
            }
            else {
                sendChannelSignal(webSocket, ESignalMessageLevel.ERROR, `Channel ${instanceConfig.channel} does not support PAUSE/CONTINUE`, instanceConfig, localChannels)
            }
            break
        default:
            console.log (`Invalid action in instance config: '${instanceConfig.action}'`)
            break
    }
}

const onSelectContext = async (contextName:string, kwirthData:KwirthData) => {
    if (!isElectron) return

    let ri = runningInstances.find(r => r.electronContext === contextName)
    if (ri) {

        // +++los servidores http y ws tienesn que ser unicos *****. y se configura el node para que las peticoines apuntent a uno u toro contexto

    }
    else {
        let runningInstance = await createRunningInstance('k3d-kwirth', kwirthData)
        prepareKubernetes(kwirthData, runningInstance, new Map()) // +++ no hay que guardar los channel en algun lado?
    }
}

const runKubernetes = async (ri:IRunningInstance, server:http.Server<typeof IncomingMessage, typeof http.ServerResponse>, expressApp:Application, localChannels:Map<string,IChannel>) => {
    const processHttpChannelRequest = async (channel: IChannel, endpointName:string,req:Request, res:Response) : Promise<void> => {
        try {
            let accessKey = await AuthorizationManagement.getKey(req,res,apiKeyApi)
            if (accessKey) {
                channel.endpointRequest(endpointName, req, res, accessKey)
            }
            else {
                res.status(400).send()
            }
        }
        catch (err) {
            console.log('Error on GET endpoint')
            console.log(err)
            res.status(400).send()
        }
    }

    let lastVersion = await getLastKwirthVersion(ri.kwirthData)
    if (lastVersion) ri.kwirthData.lastVersion = lastVersion

    // serve front
    console.log(`SPA is available at: ${envRootPath}/front`)  //+++ envrootpath
    expressApp.get(`/`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })
    expressApp.get(`/healthz`, (_req:Request,res:Response) => { res.status(200).send() })
    expressApp.get(`${envRootPath}`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })
    expressApp.use(`${envRootPath}/front`, express.static('./front'))

    // +++ show root contents for debuggunng purposes
    const fs = require('fs')
    fs.readdir('.', (err:any, archivos:any) => {
        if (err) {
            console.error('Error reading folder data:', err)
            return
        }
        console.log("File list at project root:")
        archivos.forEach((archivo:any) => {
            console.log('- ' + archivo)
        })
    })

    // serve config API
    let apiKeyApi:ApiKeyApi = new ApiKeyApi(ri.configMaps, envMasterKey)
    expressApp.use(`${envRootPath}/key`, apiKeyApi.route)
    let configApi:ConfigApi = new ConfigApi(apiKeyApi, ri.kwirthData, ri.clusterInfo, onSelectContext)
    expressApp.use(`${envRootPath}/config`, configApi.route)
    let storeApi:StoreApi = new StoreApi(ri.configMaps, apiKeyApi)
    expressApp.use(`${envRootPath}/store`, storeApi.route)
    let userApi:UserApi = new UserApi(ri.secrets, apiKeyApi)
    expressApp.use(`${envRootPath}/user`, userApi.route)
    let loginApi:LoginApi = new LoginApi(ri.secrets, ri.configMaps)
    expressApp.use(`${envRootPath}/login`, loginApi.route)
    let manageKwirthApi:ManageKwirthApi = new ManageKwirthApi(ri.clusterInfo.coreApi, ri.clusterInfo.appsApi, ri.clusterInfo.batchApi, apiKeyApi, ri.kwirthData)
    expressApp.use(`${envRootPath}/managekwirth`, manageKwirthApi.route)
    let manageCluster:ManageClusterApi = new ManageClusterApi(ri.clusterInfo.coreApi, ri.clusterInfo.appsApi, apiKeyApi, localChannels)
    expressApp.use(`${envRootPath}/managecluster`, manageCluster.route)
    let metricsApi:MetricsApi = new MetricsApi(ri.clusterInfo, apiKeyApi)
    expressApp.use(`${envRootPath}/metrics`, metricsApi.route)

    for (let channel of localChannels.values()) {
        let channelData = channel.getChannelData()
        if (channelData.endpoints.length>0) {
            for (let endpoint of channelData.endpoints) {
                console.log(`Will listen on ${envRootPath}/channel/${channelData.id}/${endpoint.name}`)  // envrootpath
                const router = express.Router()
                router.route('*')
                    .all( async (req:Request,res:Response, next) => {
                        if (endpoint.requiresAccessKey) {
                            if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                        }
                        next()
                    })
                    .get( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('GET'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .post( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('POST'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .put( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('PUT'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .delete( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('DELETE'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                expressApp.use(`${envRootPath}/channel/${channelData.id}/${endpoint.name}`, router)
            }
        }
    }
    
    // listen
    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`)
        console.log(`Context being used: ${ri.clusterInfo.kubeConfig.currentContext}`)
        if (ri.kwirthData.inCluster) {
            console.log(`Kwirth is running INSIDE cluster`)
        }
        else {
            console.log(`Cluster name (according to kubeconfig context): ${ri.clusterInfo.kubeConfig.getCluster(ri.clusterInfo.kubeConfig.currentContext)?.name}.`)
            console.log(`Kwirth is running OUTSIDE a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })

    process.on('uncaughtException', (err, origin) => {
        console.error('********************************************************************************')
        console.error('🚨 UNCAUGHT EXCEPTION - CRASH DETECTED 🚨')
        console.error(`Origin: ${origin}`)
        console.error('Last error:', err.stack || err)
        console.error('********************************************************************************')
        process.exit(1)
    })

    process.on('exit', async () => {
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('exiting on node exit')
        await new Promise((resolve) => setTimeout(resolve, 10000))
        ri.clusterInfo.saToken.deleteToken('kwirth-sa', ri.kwirthData.namespace)
    })
}

const initKubernetesCluster = async (localClusterInfo:ClusterInfo, metricsRequired:boolean, eventsRequired: boolean) : Promise<void> => {
    console.log('Node info loaded')

    console.log('Source Info')
    console.log('  Name:', localClusterInfo.name)
    console.log('  Type:', localClusterInfo.type)
    console.log('  Flavour:', localClusterInfo.flavour)
    console.log('  Nodes:', localClusterInfo.nodes.size)

    if (metricsRequired) {
        localClusterInfo.metrics = new MetricsTools(localClusterInfo)
        localClusterInfo.metricsInterval = envMetricsInterval //+++
        localClusterInfo.metrics.startMetrics()
        console.log('  vCPU:', localClusterInfo.vcpus)
        console.log('  Memory (GB):', localClusterInfo.memory/1024/1024/1024)
    }

    if (eventsRequired) {
        localClusterInfo.events = new EventsTools(localClusterInfo)
        localClusterInfo.events.startEvents()
    }
}

const prepareKubernetes = async (localKwirthData:KwirthData, runningInstance:IRunningInstance, localChannels:Map<string, IChannel>) => {
    if (envChannelLogEnabled) localChannels.set('log', new LogChannel(runningInstance.clusterInfo))
    if (envChannelAlertEnabled) localChannels.set('alert', new AlertChannel(runningInstance.clusterInfo))
    if (envChannelMetricsEnabled) localChannels.set('metrics', new MetricsChannel(runningInstance.clusterInfo))
    if (envChannelOpsEnabled) localChannels.set('ops', new OpsChannel(runningInstance.clusterInfo))
    if (envChannelTrivyEnabled) localChannels.set('trivy', new TrivyChannel(runningInstance.clusterInfo))
    if (envChannelEchoEnabled) localChannels.set('echo', new EchoChannel(runningInstance.clusterInfo))
    if (envChannelFilemanEnabled) localChannels.set('fileman', new FilemanChannel(runningInstance.clusterInfo))
    if (envChannelMagnifyEnabled) localChannels.set('magnify', new MagnifyChannel(runningInstance.clusterInfo, localKwirthData))

    localKwirthData.channels =  Array.from(localChannels.keys()).map(k => {
        return localChannels.get(k)?.getChannelData()!
    })

    // Detect if any channel requires metrics
    let metricsRequired = Array.from(localChannels.values()).reduce( (prev, current) => { return prev || current.getChannelData().metrics}, false)
    let eventsRequired = Array.from(localChannels.values()).reduce( (prev, current) => { return prev || current.getChannelData().events}, false)
    console.log('Metrics required: ', metricsRequired)
    console.log('Events required: ', eventsRequired)

    await initKubernetesCluster(runningInstance.clusterInfo, metricsRequired, eventsRequired)
    runningInstance.clusterInfo.type = localKwirthData.clusterType

    console.log(`Enabled channels for this (kubernetes) run are: ${Array.from(localChannels.keys()).map(c => `'${c}'`).join(',')}`)
    console.log(`Detected own namespace: ${localKwirthData.namespace}`)
    if (localKwirthData.deployment !== '')
        console.log(`Detected own deployment: ${localKwirthData.deployment}`)
    else
        console.log(`No deployment detected. Kwirth is not running inside a cluster`)

    console.log('Final xkwirthData', localKwirthData)

    if (envForward) {
        if (runningInstance.kwirthData.inCluster) {
            console.log('FORWARD for inCluster is being configured...')
            configureForward(runningInstance.clusterInfo, app)
        }
        else if (runningInstance.kwirthData.isElectron) {
            console.log('FORWARD for electron should be implemented')
        }
        else {
            console.log('FORWARD not avialable (not inCluster and not isElectron)')
        }
    }
    else {
        console.log('No FORWARD mechanism will be available.')
    }
}

const launchKubernetes = async (localKwirthData:KwirthData, expressApp:Application) => {
    console.log('Start Kubernetes Kwirth')
    if (localKwirthData) {
        console.log('Initial kwirthData', localKwirthData)
        try {

            let runningInstance = await createRunningInstance(undefined, localKwirthData)
            
            let localChannels = new Map()
            prepareKubernetes(localKwirthData, runningInstance, localChannels)
            let httpServer = createHttpServers(runningInstance.clusterInfo, localKwirthData, localChannels, app, processClientMessage)
            runKubernetes(runningInstance, httpServer, expressApp, localChannels)
        }
        catch (err){
            console.log(err)
        }
    }
    else {
        console.log('Cannot get kwirthdata, exiting...')
    }    
}

const runDocker = async (server:http.Server<typeof IncomingMessage, typeof http.ServerResponse>, localDockerApi:Docker, localClusterInfo:ClusterInfo, localKwirthData:KwirthData,  localChannels:Map<string,IChannel>) => {
    let localSecrets = new DockerSecrets(localClusterInfo.coreApi, '/secrets')
    let localConfigMaps = new DockerConfigMaps(localClusterInfo.coreApi, '/configmaps')

    let lastVersion = await getLastKwirthVersion(localKwirthData)
    if (lastVersion) localKwirthData.lastVersion = lastVersion
    
    //serve front
    console.log(`SPA is available at: ${envRootPath}/front`)
    app.get(`/`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })

    app.get(`${envRootPath}`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })
    app.use(`${envRootPath}/front`, express.static('./front'))

    // serve config API
    let ka:ApiKeyApi = new ApiKeyApi(localConfigMaps, envMasterKey)
    app.use(`${envRootPath}/key`, ka.route)
    let ca:ConfigApi = new ConfigApi(ka, localKwirthData, localClusterInfo)
    ca.setDockerApi(localDockerApi)
    app.use(`${envRootPath}/config`, ca.route)
    let sa:StoreApi = new StoreApi(localConfigMaps, ka)
    app.use(`${envRootPath}/store`, sa.route)
    let ua:UserApi = new UserApi(localSecrets, ka)
    app.use(`${envRootPath}/user`, ua.route)
    let la:LoginApi = new LoginApi(localSecrets, localConfigMaps)
    app.use(`${envRootPath}/login`, la.route)
    let mk:ManageKwirthApi = new ManageKwirthApi(localClusterInfo.coreApi, localClusterInfo.appsApi, localClusterInfo.batchApi, ka, localKwirthData)
    app.use(`${envRootPath}/managekwirth`, mk.route)
    let mc:ManageClusterApi = new ManageClusterApi(localClusterInfo.coreApi, localClusterInfo.appsApi, ka, localChannels)
    app.use(`${envRootPath}/managecluster`, mc.route)

    // obtain remote ip
    //app.use(requestIp.mw())
    
    // listen
    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`)
        console.log(`Context being used: ${localClusterInfo.kubeConfig.currentContext}`)
        if (localKwirthData.inCluster) {
            console.log(`Kwirth is running INSIDE cluster`)
        }
        else {
            console.log(`Cluster name (according to kubeconfig context): ${localClusterInfo.kubeConfig.getCluster(localClusterInfo.kubeConfig.currentContext)?.name}.`)
            console.log(`Kwirth is running OUTSIDE a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })
    process.on('exit', () => {
        console.log('exiting')
    })
}

const launchDocker = async(localKwirthData:KwirthData) => {
    console.log('Start Docker Kwirth')
    let localDockerApi =new Docker()
    let localClusterInfo = new ClusterInfo()
    localClusterInfo.nodes = new Map()
    localClusterInfo.metrics = new MetricsTools(localClusterInfo)
    localClusterInfo.metricsInterval = 15
    localClusterInfo.token = ''
    localClusterInfo.dockerApi = localDockerApi
    localClusterInfo.dockerTools = new DockerTools(localClusterInfo)
    localClusterInfo.name = 'docker'
    localClusterInfo.type = EClusterType.DOCKER
    localClusterInfo.flavour = 'docker'
    const localChannels:Map<string,IChannel> = new Map()
    let logChannel = new LogChannel(localClusterInfo)
    localChannels.set('log', logChannel)

    let httpServer = createHttpServers(localClusterInfo, localKwirthData, localChannels, app, processClientMessage)

    // load channel extensions

    console.log(`Enabled channels for this (docker) run are: ${Array.from(localChannels.keys()).map(c => `'${c}'`).join(',')}`)
    runDocker(httpServer, localDockerApi, localClusterInfo, localKwirthData, localChannels)
}

const runElectron = async (ri:IRunningInstance, server:http.Server<typeof IncomingMessage, typeof http.ServerResponse>, expressApp:Application, localChannels:Map<string,IChannel>) => {
    const processHttpChannelRequest = async (channel: IChannel, endpointName:string,req:Request, res:Response) : Promise<void> => {
        try {
            let accessKey = await AuthorizationManagement.getKey(req,res,apiKeyApi)
            if (accessKey) {
                channel.endpointRequest(endpointName, req, res, accessKey)
            }
            else {
                res.status(400).send()
            }
        }
        catch (err) {
            console.log('Error on GET endpoint')
            console.log(err)
            res.status(400).send()
        }
    }

    // serve front
    console.log(`SPA is available at: ${envRootPath}/front`)  //+++ envrootpath
    expressApp.get(`/`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })
    expressApp.get(`/healthz`, (_req:Request,res:Response) => { res.status(200).send() })
    expressApp.get(`${envRootPath}`, (_req:Request,res:Response) => { res.redirect(`${envRootPath}/front`) })
    expressApp.use(`${envRootPath}/front`, express.static('./front'))


    // serve config API
    let apiKeyApi:ApiKeyApi = new ApiKeyApi(ri.configMaps, envMasterKey)
    expressApp.use(`${envRootPath}/key`, apiKeyApi.route)
    let configApi:ConfigApi = new ConfigApi(apiKeyApi, ri.kwirthData, ri.clusterInfo, onSelectContext)
    expressApp.use(`${envRootPath}/config`, configApi.route)
    let storeApi:StoreApi = new StoreApi(ri.configMaps, apiKeyApi)
    expressApp.use(`${envRootPath}/store`, storeApi.route)
    let userApi:UserApi = new UserApi(ri.secrets, apiKeyApi)
    expressApp.use(`${envRootPath}/user`, userApi.route)
    let loginApi:LoginApi = new LoginApi(ri.secrets, ri.configMaps)
    expressApp.use(`${envRootPath}/login`, loginApi.route)
    let manageKwirthApi:ManageKwirthApi = new ManageKwirthApi(ri.clusterInfo.coreApi, ri.clusterInfo.appsApi, ri.clusterInfo.batchApi, apiKeyApi, ri.kwirthData)
    expressApp.use(`${envRootPath}/managekwirth`, manageKwirthApi.route)
    let manageCluster:ManageClusterApi = new ManageClusterApi(ri.clusterInfo.coreApi, ri.clusterInfo.appsApi, apiKeyApi, localChannels)
    expressApp.use(`${envRootPath}/managecluster`, manageCluster.route)
    let metricsApi:MetricsApi = new MetricsApi(ri.clusterInfo, apiKeyApi)
    expressApp.use(`${envRootPath}/metrics`, metricsApi.route)

    for (let channel of localChannels.values()) {
        let channelData = channel.getChannelData()
        if (channelData.endpoints.length>0) {
            for (let endpoint of channelData.endpoints) {
                console.log(`Will listen on ${envRootPath}/channel/${channelData.id}/${endpoint.name}`)  // envrootpath
                const router = express.Router()
                router.route('*')
                    .all( async (req:Request,res:Response, next) => {
                        if (endpoint.requiresAccessKey) {
                            if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                        }
                        next()
                    })
                    .get( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('GET'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .post( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('POST'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .put( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('PUT'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                    .delete( async (req:Request, res:Response) => {
                        if (endpoint.methods.includes('DELETE'))
                            processHttpChannelRequest(channel, endpoint.name, req, res)
                        else
                            res.status(405).send()
                    })
                expressApp.use(`${envRootPath}/channel/${channelData.id}/${endpoint.name}`, router)
            }
        }
    }
    
    // listen
    server.listen(PORT, () => {
        console.log(`Server is listening on port ${PORT}`)
        console.log(`Context being used: ${ri.clusterInfo.kubeConfig.currentContext}`)
        if (ri.kwirthData.inCluster) {
            console.log(`Kwirth is running INSIDE cluster`)
        }
        else {
            console.log(`Cluster name (according to kubeconfig context): ${ri.clusterInfo.kubeConfig.getCluster(ri.clusterInfo.kubeConfig.currentContext)?.name}.`)
            console.log(`Kwirth is running OUTSIDE a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })

    process.on('uncaughtException', (err, origin) => {
        console.error('********************************************************************************')
        console.error('🚨 UNCAUGHT EXCEPTION - CRASH DETECTED 🚨')
        console.error(`Origin: ${origin}`)
        console.error('Last error:', err.stack || err)
        console.error('********************************************************************************')
        process.exit(1)
    })

    process.on('exit', async () => {
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('********************************************************************************')
        console.log('exiting on node exit')
        await new Promise((resolve) => setTimeout(resolve, 10000))
        //+++localSaToken.deleteToken('kwirth-sa', kwirthData.namespace)
    })
}

const launchElectron = async (localKwirthData:KwirthData, expressApp:Application) => {
    console.log('Start Electron Kwirth')
    if (localKwirthData) {
        console.log('Initial kwirthData', localKwirthData)
        try {
            let runningInstance = await createRunningInstance('k3d-kwirth', localKwirthData)
            let httpServer = createHttpServers(runningInstance.clusterInfo, localKwirthData, new Map(), app, processClientMessage)
            // no channels on first run
            runElectron(runningInstance, httpServer, expressApp, new Map())
        }
        catch (err){
            console.log(err)
        }
    }
    else {
        console.log('Cannot get kwirthdata, exiting...')
    }    
}

const startNodeTasks = () => {
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

const configureForward = (localClusterInfo:ClusterInfo, expressApp:Application) => {
    expressApp.use(cookieParser())
    expressApp.use(cors({
        allowedHeaders: ['Content-Type', 'Authorization', 'x-kwirth-app'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }))

    const getDynamicTarget = (req: Request): string => {
        let dest= req.cookies['x-kwirth-forward']
        return 'http://'+dest
    }

    const dynamicProxy = createProxyMiddleware({
        target: 'https://www.w3.org/',        // Initial value (required but usesless)
        router: getDynamicTarget,             // decide target for each request
        changeOrigin: true,
        on: {
            proxyReq: fixRequestBody,         // Keep PUT/POST body integrity
        },
    })

    async function getPodIp(coreApi:CoreV1Api, namespace:string, podName:string) {
        try {
            const response = await coreApi.readNamespacedPod({
                name: podName,
                namespace: namespace
            })
            
            const podIp = response!.status?.podIP
            
            if (podIp) {
                return podIp
            }
            else {
                console.log('Pod exists, but it seems to not to have an assigned IP')
            }
        }
        catch (err) {
            console.error('Error getting pod')
        }
    }

    expressApp.use(async (req: Request, res: Response, next: NextFunction) => {
        if (req.url.startsWith(`/healthz`) || req.url.startsWith(`/health`)) {
            return next()
        }
        if (!req.url.startsWith('/kwirth')) {
            if (req.cookies['x-kwirth-refresh']==='1') {
                res.cookie('x-kwirth-refresh', '2', { path: '/' })
                res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
                res.set('Pragma', 'no-cache')
                res.set('Expires', '0')
                res.redirect('/')
                return
            }
            let dest = req.cookies['x-kwirth-forward']
            console.log(`[PROXY] dynamic routing to `+dest)
            return dynamicProxy(req, res, next)
        }
        if (req.url.startsWith('/kwirth/port-forward/pod')) {
            let namespace=req.url.split('/')[4]
            let podname=req.url.split('/')[5]
            let port=req.url.split('/')[6]
            console.log(`[PROXY] Launch port forward for pod `, namespace, '/', podname)
            let ip = await getPodIp(localClusterInfo.coreApi, namespace, podname)
            console.log(`[PROXY] IP `, ip)
            res.cookie('x-kwirth-forward', ip+':'+port, { path: '/' })
            res.cookie('x-kwirth-refresh', '1', { path: '/' })
            res.redirect('/')
            return
        }
        next()
    })
}

const createHttpServers = (localClusterInfo:ClusterInfo, localKwirthData:KwirthData, localChannels:Map<string, IChannel>, expressApp:Application, localProcessClientMessage:(webSocket: WebSocket, message: string, localClusterInfo:ClusterInfo, localKwirthData:KwirthData, localChannels:Map<string,IChannel>) => Promise<void>) => {

    // create HTTP and WS servers
    const httpServer = http.createServer(expressApp)
    const wsServer = new WebSocketServer({ server: httpServer, skipUTF8Validation:true  })
    wsServer.on('connection', (webSocket:WebSocket, req:IncomingMessage) => {
        const ipHeader = req.headers['x-forwarded-for']
        const ip = (Array.isArray(ipHeader) ? ipHeader[0] : ipHeader || req.socket.remoteAddress || '').split(',')[0].trim()
        console.log(`Client connected from ${ip}`)

        // This block precesses web socket connections for channels
        if (req.url) {
            const fullUrl = new URL(req.url, `http://${req.headers.host}`)
            const challenge = fullUrl.searchParams.get('challenge')
            if (challenge) {
                let websocketRequestIndex = localClusterInfo.pendingWebsocket.findIndex(i => i.challenge === challenge)
                if (websocketRequestIndex>=0) {
                    let websocketRequest = localClusterInfo.pendingWebsocket[websocketRequestIndex]
                    console.log('Websocket request received for channel', websocketRequest.channel)
                    if (!localChannels.has(websocketRequest.channel)) {
                        webSocket.close()
                        console.log('Channel not found', websocketRequest.channel)
                        return
                    }
                    let channel = localChannels.get(websocketRequest.channel)!
                    console.log('Websocket connection request routed to', websocketRequest.channel)
                    channel.websocketRequest(webSocket, websocketRequest.instance, websocketRequest.instanceConfig)
                    localClusterInfo.pendingWebsocket.splice(websocketRequestIndex,1)
                    return
                }
                else {
                    console.log('Instance not found for completing webscoket request:', challenge)
                    webSocket.close()
                    return
                }
            }
        }

        // this block correpsonds to general websocket requests
        webSocket.onmessage = (event) => {
            localProcessClientMessage(webSocket, event.data, localClusterInfo, localKwirthData, localChannels)
        }

        webSocket.onclose = () => {
            // we do not remove connectios for the client to reconnect. previous code was:
            // for (var channel of channels.keys()) {
            //     channels.get(channel)?.removeConnection(ws)
            // }
            console.log('Client disconnected')
            for (let channel of localChannels.values()) {
                if (channel.containsConnection(webSocket)) {
                    console.log(`Connection from IP ${ip} to channel ${channel.getChannelData().id} has been interrupted.`)
                }
            }
        }
    })
    return httpServer
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////// START ///////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

showLogo()
startNodeTasks()

getExecutionEnvironment().then( async (exenv:string) => {
    let kwirthData:KwirthData
    switch (exenv) {
        case 'electron':
            kwirthData = {
                namespace: '',
                deployment: '',
                isElectron: true,
                inCluster: false,
                version: VERSION,
                lastVersion: VERSION,
                clusterName: 'inElectron',
                clusterType: EClusterType.KUBERNETES,
                metricsInterval: 15,
                channels: []
            }
            break
        case 'windowsdocker':
        case 'linuxdocker':
            kwirthData = {
                namespace: '',
                deployment: '',
                isElectron: isElectron,
                inCluster: false,
                version: VERSION,
                lastVersion: VERSION,
                clusterName: 'inDocker',
                clusterType: EClusterType.DOCKER,
                metricsInterval:15,
                channels: []
            }
            break
        case 'kubernetes':
            kwirthData = await getKubernetesKwirthData()
            break
        default:
            console.log(`Unsupported execution environment '${exenv}'. Exiting...`)
            process.exit()
    }

    app.use(bodyParser.json())
    app.use(cors())
    app.use(fileUpload())

    switch (exenv) {
        case 'electron':
            launchElectron(kwirthData, app)
            break
        case 'windowsdocker':
        case 'linuxdocker':
            launchDocker(kwirthData)
            break
        case 'kubernetes':
            launchKubernetes(kwirthData, app)
            break
        default:
            console.log('Unsupported execution environment. Exiting...')
            process.exit()
    }

 })
.catch( (err) => {
    console.log (err)
    console.log ('Cannot determine execution environment')
    process.exit()
})
