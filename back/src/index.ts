import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod, CustomObjectsApi } from '@kubernetes/client-node'
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
import { LogConfig, LogMessage, MetricsConfigModeEnum, ServiceConfigActionEnum, ServiceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResource, ResourceIdentifier, KwirthData, ServiceConfigChannelEnum, ServiceConfig, SignalMessage, SignalMessageLevelEnum, ServiceConfigViewEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getServiceScopeLevel } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'
import { MetricsMessage } from '@jfvilas/kwirth-common'

import express, { Request, Response} from 'express'
import { MetricsConfig } from '@jfvilas/kwirth-common'
import { ClusterData } from './tools/ClusterData'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { Metrics } from './tools/Metrics'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuidv4 } from 'uuid'
import { clearInterval } from 'timers'
const stream = require('stream')
const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883
const buffer:Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages
const websocketIntervals:Map<WebSocket, NodeJS.Timeout[]>= new Map()  // list of intervals (and its associated metrics) that produce metrics streams

// Kubernetes API access
const kc = new KubeConfig()
kc.loadFromDefault()
const coreApi = kc.makeApiClient(CoreV1Api)
const appsApi = kc.makeApiClient(AppsV1Api)
const customApi = kc.makeApiClient(CustomObjectsApi)
const k8sLog = new Log(kc)

var secrets:Secrets
var configMaps:ConfigMaps
var metrics:Metrics
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

// split a block of stdout into several lines and send them over the websocket
const sendLogData = (webSocket:WebSocket, namespace:string, pod:string, source:string, logConfig:LogConfig) => {
    const logLines = source.split('\n')
    var msg:LogMessage = {
        namespace,
        instance: logConfig.instance,
        type: 'data',
        pod,
        channel: ServiceConfigChannelEnum.LOG,
        text: '',
    }
    for (var line of logLines) {
        if (line.trim() !== '') {
            msg.text=line
            webSocket.send(JSON.stringify(msg))   
        }
    }
}

const sendMetricsData = async (webSocket:WebSocket, metricsConfig:MetricsConfig) => {
    console.log('smd')
    var metricsMessage:MetricsMessage = {
        channel: ServiceConfigChannelEnum.METRICS,
        type:'data',
        instance: metricsConfig.instance,
        value: [],
        namespace: metricsConfig.namespace,
        pod: metricsConfig.pod
    }
    try {
        // +++ we must get values from all nodes and do some magics with numbers
        // +++ maybe we need to take into account pod status (only running pods, for example)
        var sampledMetrics = []
        for (var nodeMetrics of Array.from(ClusterData.nodes.values())) {
            sampledMetrics.push(await metrics.getMetrics(nodeMetrics))
        }
        //console.log('sampledMetrics', sampledMetrics)

        // +++ maybe adding up values is not the only operation (what about min, max, avg...?)
        metricsMessage.value=[]
        for (var metricName of metricsConfig.metrics) {
            var total=0
            for (var sampledNodeMetrics of sampledMetrics) {
                total+=metrics.extractMetrics(sampledNodeMetrics, metricName, metricsConfig.pod, metricsConfig.container).value
            }
            metricsMessage.value.push(total)
        }
        //console.log('metricsMessage', metricsMessage)
        try {
            webSocket.send(JSON.stringify(metricsMessage))
        }
        catch (err) {
            console.log('socket error, we should forget interval')
        }
    }
    catch (err) {
        console.log('err reading metrics', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.WARNING, 'Cannot read metrics', metricsConfig)
    }
}

const sendChannelSignal = (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, serviceConfig: ServiceConfig) => {
    switch(serviceConfig.channel) {
        case ServiceConfigChannelEnum.LOG:
        case ServiceConfigChannelEnum.METRICS:
            var sgnMsg:SignalMessage= {
                level,
                channel: serviceConfig.channel,
                instance: serviceConfig.instance,
                type: 'signal',
                text
            }
            webSocket.send(JSON.stringify(sgnMsg))
            break
        default:
            console.log(`Unsupported channel ${serviceConfig.channel}`)
            break
    }
}

const sendServiceConfigAccept = (ws:WebSocket, action:ServiceConfigActionEnum, flow: ServiceConfigFlowEnum, channel: ServiceConfigChannelEnum, serviceConfig:ServiceConfig) => {
    var resp:any = {
        action,
        flow,
        channel,
        instance: serviceConfig.instance,
        type: 'signal',
        text: 'Service Config accepted'  // text is required for managing 'service accepts' the same as other signal messages
    }
    ws.send(JSON.stringify(resp))
}

const startPodService = (podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    console.log('startPodService: ', serviceConfig)
    switch(serviceConfig.channel) {
        case ServiceConfigChannelEnum.LOG:
            startPodLog(podNamespace, podName, containerName, webSocket, serviceConfig as LogConfig)
            break
        case ServiceConfigChannelEnum.METRICS:
            startPodMetrics(webSocket, serviceConfig as MetricsConfig)
            break
        default:
            console.log(`Invalid channel`, serviceConfig.channel)
    }
}

// get pods logs
const startPodLog = async (namespace:string, podName:string, containerName:string, webSocket:WebSocket, logConfig:LogConfig) => {
    try {
        const logStream = new stream.PassThrough()
        logStream.on('data', (chunk:any) => {
            var text:string=chunk.toString('utf8')
            if (buffer.get(webSocket)!==undefined) {
                // if we have some text from a previous incompleted chunk, we prepend it now
                text=buffer.get(webSocket)+text
                buffer.delete(webSocket)
            }
            if (!text.endsWith('\n')) {
                //incomplete chunk
                var i=text.lastIndexOf('\n')
                var next=text.substring(i)
                buffer.set(webSocket,next)
                text=text.substring(0,i)
            }
            sendLogData(webSocket, namespace, podName, text, logConfig)
        })

        var streamConfig = { 
            follow: true, 
            pretty: false, 
            timestamps:logConfig.timestamp,
            previous:Boolean(logConfig.previous),
            tailLines:logConfig.maxMessages
        }
        await k8sLog.log(namespace, podName, containerName, logStream,  streamConfig)
    }
    catch (err) {
        console.log('Generic error starting pod log', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), logConfig)
    }
}

// start pods metrics
const startPodMetrics = async (webSocket:WebSocket, metricsConfig:MetricsConfig) => {
    console.log(metricsConfig)
    try {
        switch (metricsConfig.mode) {
            case MetricsConfigModeEnum.SNAPSHOT:
                // +++ pending implementation. implement when metric streaming is complete
                break
            case MetricsConfigModeEnum.STREAM:
                console.log(metricsConfig)
                var interval=(metricsConfig.interval?metricsConfig.interval:10)*1000    //+++ pending get this from settings
                console.log(interval)
                var timeout = setInterval(() => sendMetricsData(webSocket,metricsConfig), interval)
                //clearInterval(timeout)
                if (!websocketIntervals.has(webSocket)) websocketIntervals.set(webSocket, [])
                var metricsIntervals=websocketIntervals.get(webSocket)
                metricsIntervals?.push(timeout)
                break
            default:
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${metricsConfig.mode}`, metricsConfig.mode)
        }
    }
    catch (err) {
        console.log('Generic error starting metrics service', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), metricsConfig)
    }
}

const watchPods = (apiPath:string, filter:any, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    const watch = new Watch(kc)

    watch.watch(apiPath, filter, (eventType:string, obj:any) => {
        const podName = obj.metadata.name
        const podNamespace = obj.metadata.namespace
        if (eventType === 'ADDED' || eventType === 'MODIFIED') {
            console.log(`${eventType}: ${podNamespace}/${podName}`)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, serviceConfig)

            for (var container of obj.spec.containers) {
                if (serviceConfig.view==='container') {
                    if (container.name===serviceConfig.container) 
                        startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Requested container not valid: ${container.name}`, serviceConfig)
                    }
                }
                else {
                    startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                }
            }
        }
        else if (eventType === 'DELETED') {
            console.log(`Pod deleted` )
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod DELETED: ${podNamespace}/${podName}`, serviceConfig)
        }
    },
    (err) => {
        console.log('Generic error starting watch', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), serviceConfig)
    })
}

// validates the permission level requested qith the one stated in the accessKey
const checkPermissionLevel = (sconfig:ServiceConfig) => {
    var resource=parseResource(accessKeyDeserialize(sconfig.accessKey).resource)
    var haveLevel=getServiceScopeLevel(sconfig.channel, resource.scope)
    var requiredLevel=getServiceScopeLevel(sconfig.channel, sconfig.scope)
    console.log(`Check permission level: have ${resource.scope}(${haveLevel}) >= required ${sconfig.scope}(${requiredLevel}) ? ${haveLevel>=requiredLevel}`)
    return (haveLevel>=requiredLevel)
}

// creates a list of pods that the requestor has access to
const getSelectedPods = async (resId:ResourceIdentifier, validNamespaces:string[], validPodNames:string[]) => {
    var allPods=await coreApi.listPodForAllNamespaces() //+++ can be optimized if config.namespace is specified
    var selectedPods:V1Pod[]=[]
    for (var pod of allPods.body.items) {
        var valid=true
        if (resId.namespace!=='') valid &&= validNamespaces.includes(pod.metadata?.namespace!)
        //+++ other filters pending implementation
        if (resId.pod) valid &&= validPodNames.includes(pod.metadata?.name!)
        if (valid) {
            selectedPods.push(pod)
        }
        else {
            // an empty array is returned in this case, so caller must decide how to handle this
            console.log(`Access denied: access to ${pod.metadata?.namespace}/${pod.metadata?.name} has not been granted.`)
        }
    }
    return selectedPods
}

const processStartLogConfig = async (logConfig: LogConfig, webSocket: WebSocket, resourceId: ResourceIdentifier, validNamespaces: string[], validPodNames: string[]) => {
    switch (logConfig.scope) {
        case 'view':
        case 'filter':
            if (!logConfig.view) logConfig.view = ServiceConfigViewEnum.POD
            if (getServiceScopeLevel(logConfig.channel, resourceId.scope) < getServiceScopeLevel(logConfig.channel, logConfig.scope)) {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: scope 'filter'/'view' not allowed`, logConfig)
                return
            }
            var selectedPods=await getSelectedPods(resourceId, validNamespaces, validPodNames)
            if (selectedPods.length===0) {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested log config`, logConfig)
            }
            else {
                switch (logConfig.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, logConfig)
                        logConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig)
                        break
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, {}, webSocket, logConfig)
                        logConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig)
                        break
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, logConfig.namespace, logConfig.group)).labelSelector
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, { labelSelector }, webSocket, logConfig)
                        logConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig)
                        break
                    case 'pod':
                    case 'container':
                        var validPod=selectedPods.find(p => p.metadata?.name === logConfig.pod)
                        if (validPod) {
                            var podLogConfig:LogConfig={
                                action: ServiceConfigActionEnum.START,
                                flow: ServiceConfigFlowEnum.REQUEST,
                                channel: ServiceConfigChannelEnum.LOG,
                                instance: uuidv4(),
                                accessKey: '',
                                timestamp: logConfig.timestamp,
                                previous: logConfig.previous,
                                maxMessages: logConfig.maxMessages,
                                scope: logConfig.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: logConfig.view === 'container' ? logConfig.container : '',
                                view: logConfig.view,
                            }

                            var metadataLabels = validPod.metadata?.labels
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                                console.log(`Label selector: ${labelSelector}`)
                                watchPods(`/api/v1/namespaces/${podLogConfig.namespace}/pods`, { labelSelector }, webSocket, podLogConfig)
                                logConfig.instance = uuidv4()
                                sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig)
                            }
                            else {
                                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, logConfig)
                            }
                        }
                        else {
                            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${logConfig.pod}'`, logConfig)
                        }
                        break
                    default:
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid view '${logConfig.view}'`, logConfig)
                        break
                }
            }
            break
        default:
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid scope '${logConfig.scope}'`, logConfig)
            return
    }
}

const processStartMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket, resourceId: ResourceIdentifier, validNamespaces: string[], validPodNames: string[]) => {
    console.log('processStartMetricsConfig', metricsConfig)
    switch (metricsConfig.scope) {
        case 'snapshot':
        case 'stream':
            if (getServiceScopeLevel(metricsConfig.channel, resourceId.scope)<getServiceScopeLevel(metricsConfig.channel, metricsConfig.scope)) {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: scope '${metricsConfig.scope}' not allowed`, metricsConfig)
                return
            }
            var selectedPods=await getSelectedPods(resourceId, validNamespaces, validPodNames)
            if (selectedPods.length===0) {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested metrics config`, metricsConfig)
            }
            else {
                console.log('metricsConfig.view', metricsConfig.view)
                switch (metricsConfig.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig)
                        break
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, {}, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig)
                        break
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, metricsConfig.namespace, metricsConfig.group)).labelSelector
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, { labelSelector }, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig)
                        break
                    case 'pod':
                    case 'container':
                        var validPod=selectedPods.find(p => p.metadata?.name === metricsConfig.pod)
                        if (validPod) {
                            var podMetricsConfig:MetricsConfig={
                                action: ServiceConfigActionEnum.START,
                                flow: ServiceConfigFlowEnum.REQUEST,
                                channel: ServiceConfigChannelEnum.METRICS,
                                instance: uuidv4(),
                                accessKey: '',
                                interval: 10,  //+++ pending get this from settings
                                scope: metricsConfig.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: metricsConfig.view === 'container' ? metricsConfig.container : '',
                                view: metricsConfig.view,
                                //mode: MetricsConfigModeEnum[metricsConfig.scope.toString() as keyof typeof MetricsConfigModeEnum],
                                mode: metricsConfig.mode,
                                metrics: metricsConfig.metrics
                            }

                            var metadataLabels = validPod.metadata?.labels
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                                console.log(`Label selector: ${labelSelector}`)
                                watchPods(`/api/v1/namespaces/${podMetricsConfig.namespace}/pods`, { labelSelector }, webSocket, podMetricsConfig)
                                metricsConfig.instance = uuidv4()
                                sendServiceConfigAccept(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig)
                            }
                            else {
                                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, metricsConfig)
                            }
                        }
                        else {
                            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${metricsConfig.pod}'`, metricsConfig)
                        }
                        break
                    default:
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid view '${metricsConfig.view}'`, metricsConfig)
                        break
                }
            }
            break
        default:
            sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid scope '${metricsConfig.scope}'`, metricsConfig)
            return
    }
}

const processStopLogConfig = async (logConfig: Log, webSocket: WebSocket) => {
    // +++ pending impl. remove interval from intervals array
}

const processStopMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket) => {
    // +++ pending impl. remove interval from intervals array
}

// clients send requests to start receiving log
const processClientMessage = async (message:string, webSocket:WebSocket) => {
    const serviceConfig = JSON.parse(message) as ServiceConfig

    console.log('serviceConfig:',serviceConfig)
    if (serviceConfig.flow !== ServiceConfigFlowEnum.REQUEST) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Invalid flow received', serviceConfig)
        return
    }
    if (!serviceConfig.group) serviceConfig.group=serviceConfig.set
    if (!serviceConfig.accessKey) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'No key received', serviceConfig)
        return
    }
    if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===serviceConfig.accessKey)) {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid API key: ${serviceConfig.accessKey}`, serviceConfig)
        return
    }
    var accepted=checkPermissionLevel(serviceConfig)
    if (accepted) {
        console.log('Access accepted')
    }
    else {
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Access denied: permission denied', serviceConfig)
        return
    }
  
    var resource=parseResource(accessKeyDeserialize(serviceConfig.accessKey).resource)

    var allowedNamespaces=resource.namespace.split(',').filter(ns => ns!=='')
    var requestedNamespaces=serviceConfig.namespace.split(',').filter(ns => ns!=='')
    var validNamespaces=requestedNamespaces.filter(ns => allowedNamespaces.includes(ns))

    var allowedPods=resource.pod.split(',').filter(podName => podName!=='')
    var requestedPods=serviceConfig.pod.split(',').filter(podName => podName!=='')
    var validPodNames=requestedPods.filter(podName => allowedPods.includes(podName))

    // // transitional
    // if (!serviceConfig.channel) serviceConfig.channel=ServiceConfigChannelEnum.LOG

    switch (serviceConfig.action) {
        case ServiceConfigActionEnum.START:
            switch (serviceConfig.channel) {
                case ServiceConfigChannelEnum.LOG:
                    processStartLogConfig(serviceConfig as LogConfig, webSocket, resource, validNamespaces, validPodNames)
                    break
                case ServiceConfigChannelEnum.METRICS:
                    processStartMetricsConfig(serviceConfig as MetricsConfig, webSocket, resource, validNamespaces, validPodNames)
                    break
                default:
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
                    break
            }
            break
        case ServiceConfigActionEnum.STOP:
            switch (serviceConfig.channel) {
                case ServiceConfigChannelEnum.LOG:
                    //processStopLogConfig(serviceConfig as LogConfig, webSocket)
                    break
                case ServiceConfigChannelEnum.METRICS:
                    processStopMetricsConfig(serviceConfig as MetricsConfig, webSocket)
                    break
                default:
                    sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig type: ${serviceConfig.channel}`, serviceConfig)
                    break
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
    if (websocketIntervals.has(ws)) {
        console.log('intervalo eliminado')
        var timeout = websocketIntervals.get(ws)
        clearInterval(timeout![0])  // +++ we have plans to add several timeouts to each web socket, so entry to map can be ws, but Map value must be an array (with id!!!)
        websocketIntervals.delete(ws)
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

const launch = async (kwirthData: KwirthData) => {
  secrets = new Secrets(coreApi, kwirthData.namespace)
  configMaps = new ConfigMaps(coreApi, kwirthData.namespace)

  await getLastKwirthVersion(kwirthData)
  // serve front
  console.log(`SPA is available at: ${rootPath}/front`)
  app.get(`/`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })

  app.get(`${rootPath}`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) })
  app.use(`${rootPath}/front`, express.static('./dist/front'))

  // serve config API
  var va:ConfigApi = new ConfigApi(coreApi, appsApi, kwirthData)
  app.use(`${rootPath}/config`, va.route)
  var ka:ApiKeyApi = new ApiKeyApi(configMaps)
  app.use(`${rootPath}/key`, ka.route)
  var sa:StoreApi = new StoreApi(configMaps)
  app.use(`${rootPath}/store`, sa.route)
  var ua:UserApi = new UserApi(secrets)
  app.use(`${rootPath}/user`, ua.route)
  var la:LoginApi = new LoginApi(secrets, configMaps)
  app.use(`${rootPath}/login`, la.route)
  var mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, kwirthData)
  app.use(`${rootPath}/managekwirth`, mk.route)
  var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi)
  app.use(`${rootPath}/managecluster`, mc.route)
  var ma:MetricsApi = new MetricsApi(metrics)
  app.use(`${rootPath}/metrics`, ma.route)

  // obtain remote ip
  app.use(requestIp.mw())
  
  // listen
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`)
    console.log(`Context being used: ${kc.currentContext}`)
    if (kwirthData.inCluster) {
        console.log(`Kwirth is running INSIDE cluster`)
    }
    else {
        console.log(`Cluster name (according to kubeconfig context): ${kc.getCluster(kc.currentContext)?.name}`)
        console.log(`Kwirth is NOT running on a cluster`)
    }
    console.log(`KWI1500I Control is being given to Kwirth`)
  })
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// serve front application

getMyKubernetesData()
    .then ( async (kwirthData) => {
        try {
            await new ClusterData(coreApi).init()
            var sat = new ServiceAccountToken(coreApi, kwirthData.namespace)
            var token= await sat.getToken('kwirth-sa',kwirthData.namespace)
            console.log(token)
            metrics = new Metrics(customApi,token!)
        }
        catch (err){
            console.log(err)
        }
        console.log('Detected own namespace: '+kwirthData.namespace)
        console.log('Detected own deployment: '+kwirthData.deployment)
        launch(kwirthData)
    })
    .catch ( (err) => {
        console.log('Cannot get namespace, using "default"')
        launch ({
            version: VERSION,
            lastVersion: VERSION,
            clusterName: 'error-starting',
            inCluster: false,
            namespace: 'default',
            deployment: ''
        })
    })
