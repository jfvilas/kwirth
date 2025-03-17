import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod } from '@kubernetes/client-node'
import { ConfigApi } from './api/ConfigApi'
import { Secrets } from './tools/Secrets'
import { ConfigMaps } from './tools/ConfigMaps'
import { VERSION } from './version'

// HTTP server for serving front, api and websockets
import { StoreApi } from './api/StoreApi'
import { UserApi } from './api/UserApi'
import { ApiKeyApi } from './api/ApiKeyApi'
import { LoginApi } from './api/LoginApi'

// HTTP server & websockets
import WebSocket from 'ws'
import { ManageKwirthApi } from './api/ManageKwirthApi'
import { ServiceConfigActionEnum, ServiceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResources, ResourceIdentifier, KwirthData, ServiceConfigChannelEnum, ServiceConfig, SignalMessage, SignalMessageLevelEnum, ServiceConfigViewEnum, ServiceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getServiceScopeLevel, validBearerKey } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'

import express, { Request, Response} from 'express'
import { ClusterInfo, NodeInfo } from './model/ClusterInfo'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuidv4 } from 'uuid'

import { Metrics } from './tools/MetricsTools'
import { IChannel } from './model/IChannel'
import { LogChannel } from './channels/LogChannel'
import { AlertChannel } from './channels/AlertChannel'
import { MetricsChannel } from './channels/MetricsChannel'

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

var saToken: ServiceAccountToken
var secrets: Secrets
var configMaps: ConfigMaps
const rootPath = process.env.KWIRTH_ROOTPATH || ''

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
        return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true, version:VERSION, lastVersion: VERSION }
    }
    else {
        // this namespace will be used to access secrets and configmaps
        return { clusterName: 'inCluster', namespace:'default', deployment:'', inCluster:false, version:VERSION, lastVersion: VERSION }
    }
}

const sendChannelSignal = (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, serviceConfig: ServiceConfig) => {
    if (channels.has(serviceConfig.channel)) {
        var sgnMsg:SignalMessage = {
            level,
            channel: serviceConfig.channel,
            instance: serviceConfig.instance,
            type: ServiceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }
    else {
        console.log(`Unsupported channel ${serviceConfig.channel}`)
    }
}

const sendServiceConfigSignalMessage = (ws:WebSocket, action:ServiceConfigActionEnum, flow: ServiceConfigFlowEnum, channel: string, serviceConfig:ServiceConfig, text:string) => {
    var resp:any = {
        action,
        flow,
        channel,
        instance: serviceConfig.instance,
        type: 'signal',
        text
    }
    ws.send(JSON.stringify(resp))
}

const startPodService = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, serviceConfig:ServiceConfig) => {
    console.log(`startPodService '${serviceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${serviceConfig.view}) (instance: ${serviceConfig.instance})`)

    sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Container ADDED: ${podNamespace}/${podName}/${containerName}`, serviceConfig)
    if(channels.has(serviceConfig.channel)) {
        channels.get(serviceConfig.channel)?.startInstance(webSocket, serviceConfig, podNamespace, podName, containerName)
    }
    else {
        console.log(`Invalid channel`, serviceConfig.channel)
    }
}

const updatePodService = async (eventType:string, podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    switch(serviceConfig.channel) {
        // +++ pending review
        // case ServiceConfigChannelEnum.METRICS:
        //     var metricsConfig = serviceConfig as MetricsConfig
        //     var instances = websocketMetrics.get(webSocket)
        //     var instance = instances?.find((instance) => instance.instanceId === metricsConfig.instance)
        //     if (instance) {
        //         if (eventType==='DELETED') {
        //             instance.assets = instance.assets.filter(c => c.podNamespace!==podNamespace && c.podName!==podName && c.containerName!==containerName)
        //         }
        //         if (eventType==='MODIFIED') {
        //             var thisPod = instance.assets.find(p => p.podNamespace===podNamespace && p.podName===podName && p.containerName===containerName)
        //         }
        //     }
        //     break
        default:
            console.log(`Invalid channel`, serviceConfig.channel)
    }
}

// watches for pod changes (add, delete...) inside the group pointed by the requestor
const watchPods = (apiPath:string, labelSelector:any, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    const watch = new Watch(kubeConfig)

    watch.watch(apiPath, labelSelector, (eventType:string, obj:any) => {
        let podName:string = obj.metadata.name
        let podNamespace:string = obj.metadata.namespace
        if (eventType === 'ADDED') {
            for (var container of obj.spec.containers) {
                let containerName = container.name
                switch (serviceConfig.view) {
                    case ServiceConfigViewEnum.NAMESPACE:
                        startPodService(webSocket, podNamespace, podName, containerName, serviceConfig)
                        break
                    case ServiceConfigViewEnum.GROUP:
                        var [_groupType, groupName] = serviceConfig.group.split('+')
                        if (podName.startsWith(groupName)) {  // we rely on kubernetes naming conventions here (we could query k8 api to discover group the pod belongs to)
                            startPodService(webSocket, podNamespace, podName, containerName, serviceConfig)
                        }
                        break
                    case ServiceConfigViewEnum.POD:
                        if ((serviceConfig.namespace==='' || (serviceConfig.namespace!=='' && serviceConfig.namespace.split(',').includes(podNamespace))) && serviceConfig.pod.split(',').includes(podName)) {
                            if (serviceConfig.pod.split(',').includes(podName)) {
                                console.log(`Pod ADDED: ${podNamespace}/${podName}/${containerName}`)
                                startPodService(webSocket, podNamespace, podName, containerName, serviceConfig)
                            }
                        }
                        break
                    case ServiceConfigViewEnum.CONTAINER:
                        var sccontainers = Array.from (new Set (serviceConfig.container.split(',').map (c => c.split('+')[1]))) // containr has the form: podname+containername (includes a plus sign as separating char)
                        var scpods = Array.from (new  Set (serviceConfig.container.split(',').map (c => c.split('+')[0]))) // containr has the form: podname+containername (includes a plus sign as separating char)                                                
                        if (sccontainers.includes(containerName) && scpods.includes(podName)) {
                            if (serviceConfig.container.split(',').includes(podName+'+'+containerName)) {
                                console.log(`Container ADDED: ${podNamespace}/${podName}/${containerName}`)
                                startPodService(webSocket, podNamespace, podName, containerName, serviceConfig)
                            }
                        }
                        else {
                            console.log(`Excluded container: ${containerName}`)
                        }
                        break
                    default:
                        console.log('Invalid serviceConfig view')
                        break
                }
            }
        }
        else if (eventType === 'DELETED' || eventType === 'MODIFIED') {
            updatePodService(eventType, podNamespace, podName, '', webSocket, serviceConfig)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, serviceConfig)
        }
        else {
            console.log(`Pod ${eventType} is unmanaged`)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, serviceConfig)
        }
    },
    (err) => {
        console.log('Generic error starting watchPods', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), serviceConfig)
    })
}

// +++ this function should be refactored to check only for requested resources included in serviceConfig, since, for example, a 'cluster' scope in
// accessKeyResources will create a list including all pods in the cluster
const getRequestedValidatedScopedPods = async (serviceConfig:ServiceConfig, accessKeyResources:ResourceIdentifier[], validNamespaces:string[], validPodNames:string[]) => {
    var allPods=await coreApi.listPodForAllNamespaces() //+++ can be optimized if config.namespace is specified
    var selectedPods:V1Pod[]=[]

    for (var pod of allPods.body.items) {
        var podName = pod.metadata?.name!
        var podNamespace = pod.metadata?.namespace!

        let existClusterScope = accessKeyResources.find(resource => resource.scope==='cluster') !== null
        if (!existClusterScope) {
            if (serviceConfig.namespace!=='' && serviceConfig.namespace.split(',').includes(podNamespace)) {
                if (! validNamespaces.includes(podNamespace)) continue
            }

            //+++ other filters (not just 'pod') pending implementation (that is, obtain a list of pods checking groups, for example)
            // if (metricsConfig.pod!=='' && metricsConfig.pod.split(',').includes(podName)) {
            //     if (! validPodNames.includes(podName)) continue
            // }

            if (serviceConfig.pod!=='' && serviceConfig.pod.split(',').includes(podName)) {
                if (! validPodNames.includes(podName)) continue
            }

            let podResource = accessKeyResources.find(resource => resource.pod===podName)
            if (!podResource) continue

            var haveLevel = getServiceScopeLevel(channels, serviceConfig.channel, podResource!.scope)
            var requiredLevel = getServiceScopeLevel(channels, serviceConfig.channel, podResource!.scope)
            if (haveLevel<requiredLevel) {
                console.log(`Insufficent level ${haveLevel} < ${requiredLevel}`)
                continue
            }
        }
        selectedPods.push(pod)
    }
    return selectedPods
}

const processStartServiceConfig = async (serviceConfig: ServiceConfig, webSocket: WebSocket, accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validPodNames: string[]) => {
    console.log('Starting service config for channel', serviceConfig.channel)
    var requestedValidatedPods = await getRequestedValidatedScopedPods(serviceConfig, accessKeyResources, validNamespaces, validPodNames)
    if (requestedValidatedPods.length===0) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested log config`, serviceConfig)
        return
    }
    switch (serviceConfig.view) {
        case 'namespace':
            serviceConfig.instance = uuidv4()
            for (let ns of validNamespaces) {
                watchPods(`/api/v1/namespaces/${ns}/pods`, {}, webSocket, serviceConfig)
            }
            sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, serviceConfig.channel, serviceConfig, 'Service Config accepted')
            break
        case 'group':
            serviceConfig.instance = uuidv4()
            for (let ns of validNamespaces) {
                for (let group of serviceConfig.group.split(',')) {
                    let groupPods = (await getPodsFromGroup(coreApi, appsApi, ns, group))
                    console.log('checking ', ns, group)
                    if (groupPods.pods.length > 0) {
                        console.log('START ', groupPods.labelSelector)
                        let specificServiceConfig = JSON.parse(JSON.stringify(serviceConfig))
                        specificServiceConfig.group = group
                        watchPods(`/api/v1/namespaces/${ns}/pods`, { labelSelector: groupPods.labelSelector }, webSocket, specificServiceConfig)
                    }
                    else
                        console.log('No pods on namespace ns')
                }
            }
            sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, serviceConfig.channel, serviceConfig, 'Service Config accepted')
            break
        case 'pod':
            serviceConfig.instance = uuidv4()
            for (let podName of serviceConfig.pod.split(',')) {
                let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    var metadataLabels = validPod.metadata?.labels
                    if (metadataLabels) {
                        var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificServiceConfig: ServiceConfig = JSON.parse(JSON.stringify(serviceConfig))
                        specificServiceConfig.pod = podName
                        watchPods(`/api/v1/pods`, { labelSelector }, webSocket, specificServiceConfig)
                        sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, serviceConfig.channel, serviceConfig, 'Service Config accepted')
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, serviceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${podName}'`, serviceConfig)
                }
            }
            break
        case 'container':
            serviceConfig.instance = uuidv4()
            for (let container of serviceConfig.container.split(',')) {
                let [podName, containerName] = container.split('+')
                let validPod=requestedValidatedPods.find(p => p.metadata?.name === podName)
                if (validPod) {
                    let metadataLabels = validPod.metadata?.labels
                    if (metadataLabels) {
                        let labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                        let specificServiceConfig: ServiceConfig = JSON.parse(JSON.stringify(serviceConfig))
                        specificServiceConfig.pod = podName // +++ sobra?
                        specificServiceConfig.container = container
                        watchPods(`/api/v1/pods`, { labelSelector }, webSocket, specificServiceConfig)
                        sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, serviceConfig.channel, serviceConfig, 'Service Config accepted')
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, serviceConfig)
                    }
                }
                else {
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${podName}'`, serviceConfig)
                }
            }
            break
        default:
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid view '${serviceConfig.view}'`, serviceConfig)
            break
    }
}

const processStopServiceConfig = async (webSocket: WebSocket, serviceConfig: ServiceConfig) => {
    if (channels.has(serviceConfig.channel)) {
        channels.get(serviceConfig.channel)?.stopInstance(webSocket, serviceConfig)
    }
    else {
        console.log('Invalid channel on service stop')
    }
}

const processPauseContinueServiceConfig = async (serviceConfig: ServiceConfig, webSocket: WebSocket, action:ServiceConfigActionEnum) => {
    if (channels.has(serviceConfig.channel)) {
        channels.get(serviceConfig.channel)?.pauseContinueChannel(webSocket, serviceConfig, serviceConfig.action)            
    }
    else {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.channel} does not exist`, serviceConfig)
    }
}

// clients send requests to start receiving log
const processClientMessage = async (message:string, webSocket:WebSocket) => {
    const serviceConfig = JSON.parse(message) as ServiceConfig

    if (serviceConfig.flow !== ServiceConfigFlowEnum.REQUEST) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Invalid flow received', serviceConfig)
        return
    }

    if (serviceConfig.action === ServiceConfigActionEnum.PING) {
        var signalMessage:SignalMessage = {
            level: SignalMessageLevelEnum.INFO,
            channel: ServiceConfigChannelEnum.NONE,
            instance: '',
            type: ServiceMessageTypeEnum.SIGNAL,
            text: 'OK'
        }
        webSocket.send(JSON.stringify(signalMessage))
        return
    }

    if (!serviceConfig.accessKey) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'No key received', serviceConfig)
        return
    }
    var accessKey = accessKeyDeserialize(serviceConfig.accessKey)
    if (accessKey.type.startsWith('bearer:')) {
        if (!validBearerKey(accessKey)) {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid bearer access key: ${serviceConfig.accessKey}`, serviceConfig)
            return
        }       
    }
    else {
        if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===serviceConfig.accessKey)) {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid API key: ${serviceConfig.accessKey}`, serviceConfig)
            return
        }
    }

    // +++ maybe we can perform this things later when knowing what the action is
    var accessKeyResources=parseResources(accessKeyDeserialize(serviceConfig.accessKey).resource)

    var requestedNamespaces=serviceConfig.namespace.split(',').filter(ns => ns!=='')
    var allowedNamespaces:string[] = []
    if (accessKeyResources.find(akr => akr.scope==='cluster')) {
        let res = await coreApi.listNamespace()
        allowedNamespaces = res.body.items.map(n => n.metadata?.name as string)
    }
    else {
        allowedNamespaces=accessKeyResources.filter(r => r.namespace!='').map(r => r.namespace)
    }
    allowedNamespaces = [...new Set(allowedNamespaces)]
    var validNamespaces=requestedNamespaces.filter(ns => allowedNamespaces.includes(ns))
    validNamespaces = [...new Set(validNamespaces)]

    var requestedPodNames=serviceConfig.pod.split(',').filter(podName => podName!=='')
    var allowedPodNames:string[] = []
    var validPodNames:string[] = []
    if (accessKeyResources.find(akr => akr.scope==='cluster')) {
        for (var ns of validNamespaces) {
            let res = await coreApi.listNamespacedPod(ns)
            allowedPodNames.push (...res.body.items.map(p => p.metadata?.name as string))
        }
        //validPodNames = Array.from(new Set(allowedPodNames))
        validPodNames = [...new Set(allowedPodNames)]
    }
    else {
        allowedPodNames = accessKeyResources.filter(r => r.pod!='').map(r => r.pod)
        validPodNames = requestedPodNames.filter(podName => allowedPodNames.includes(podName))
        //validPodNames = Array.from(new Set(validPodNames))
        validPodNames = [...new Set(validPodNames)]
    }

    console.log('validNamespaces')
    console.log(validNamespaces)
    console.log('validPodNames')
    console.log(validPodNames)

    switch (serviceConfig.action) {
        case ServiceConfigActionEnum.START:
            if (channels.has(serviceConfig.channel)) {
                processStartServiceConfig(serviceConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
            }
            break
        case ServiceConfigActionEnum.STOP:
            if (channels.has(serviceConfig.channel)) {
                processStopServiceConfig(webSocket, serviceConfig)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
            }
            break
        case ServiceConfigActionEnum.MODIFY:
            if (channels.has(serviceConfig.channel)) {
                channels.get(serviceConfig.channel)?.modifyService(webSocket, serviceConfig)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig type: ${serviceConfig.channel}`, serviceConfig)
            }
            break
        case ServiceConfigActionEnum.PAUSE:
        case ServiceConfigActionEnum.CONTINUE:
            if (channels.has(serviceConfig.channel)) {
                processPauseContinueServiceConfig(serviceConfig, webSocket, serviceConfig.action)
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig type: ${serviceConfig.channel}`, serviceConfig)
            }
            break
        default:
            console.log (`Invalid action in service config ${serviceConfig.action}`, serviceConfig.action)
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
            channels.get(channel)?.removeService(ws as any)
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

const launch = async (kwirthData: KwirthData, clusterInfo:ClusterInfo) => {
    secrets = new Secrets(coreApi, kwirthData.namespace)
    configMaps = new ConfigMaps(coreApi, kwirthData.namespace)

    await getLastKwirthVersion(kwirthData)
    // serve front
    console.log(`SPA is available at: ${rootPath}/front`)
    app.get(`/`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

    app.get(`${rootPath}`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
    app.use(`${rootPath}/front`, express.static('./dist/front'))

    // serve config API
    var ka:ApiKeyApi = new ApiKeyApi(configMaps)
    app.use(`${rootPath}/key`, ka.route)
    var va:ConfigApi = new ConfigApi(coreApi, appsApi, ka, kwirthData, channels)
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
        saToken.deleteToken('kwirth-sa',kwirthData.namespace)
    })
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
            metricValues: new Map(),
            prevValues: new Map(),
            machineMetrics: new Map(),
            timestamp: 0
        }
        nodes.set(nodeData.name, nodeData)
        console.log('Found node', nodeData.name)
    }
    console.log('Node config loaded')

    // inictialize cluster
    var clusterInfo = new ClusterInfo()
    clusterInfo.nodes = nodes
    clusterInfo.metrics = new Metrics(token)
    clusterInfo.interval = 60
    clusterInfo.token = token
    clusterInfo.coreApi = coreApi
    clusterInfo.appsApi = appsApi
    clusterInfo.logApi = logApi

    await clusterInfo.metrics.loadMetrics(Array.from(nodes.values()))
    clusterInfo.startInterval(clusterInfo.interval)

    return clusterInfo
}


////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// serve front application
getMyKubernetesData().then ( async (kwirthData) => {
    try {
        saToken = new ServiceAccountToken(coreApi, kwirthData.namespace)
        saToken.createToken('kwirth-sa',kwirthData.namespace).then ( () => {
            saToken.extractToken('kwirth-sa',kwirthData.namespace).then ( async (token) => {
                if (token)  {
                    console.log('SA token obtained succesfully')
                    var clusterInfo = await initCluster(token)

                    // load extensions
                    var logChannel = new LogChannel(clusterInfo)
                    var alertChannel = new AlertChannel(clusterInfo)
                    var metricsChannel = new MetricsChannel(clusterInfo)
                    channels.set('log', logChannel)
                    channels.set('alert', alertChannel)
                    channels.set('metrics', metricsChannel)

                    console.log(`Enabled channels for this run are: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
                    console.log(`Detected own namespace: ${kwirthData.namespace}`)
                    if (kwirthData.deployment !== '')
                        console.log(`Detected own deployment: ${kwirthData.deployment}`)
                    else
                        console.log(`No deployment detected. Kwirth is not running inside a cluster`)
                    launch(kwirthData, clusterInfo)
                }
                else {
                    console.log('SA token is invalid, exiting...')
                }
            })
            .catch ( (err) => {
                console.log('Could not get SA token, exiting...')
            })
        } )                    
    }
    catch (err){
        console.log(err)
    }
})
.catch ( (err) => {
    console.log('Cannot get namespace, exiting...')
})
