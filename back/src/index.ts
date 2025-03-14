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
//import { LogConfig, LogMessage, MetricsConfigModeEnum, ServiceConfigActionEnum, ServiceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResource, parseResources, ResourceIdentifier, KwirthData, ServiceConfigChannelEnum, ServiceConfig, SignalMessage, SignalMessageLevelEnum, ServiceConfigViewEnum, ServiceMessageTypeEnum, AssetMetrics, AlarmConfig, AlarmMessage, AlarmSeverityEnum, ServiceConfigObjectEnum } from '@jfvilas/kwirth-common'
import { LogConfig, LogMessage, ServiceConfigActionEnum, ServiceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResources, ResourceIdentifier, KwirthData, ServiceConfigChannelEnum, ServiceConfig, SignalMessage, SignalMessageLevelEnum, ServiceConfigViewEnum, ServiceMessageTypeEnum, ServiceConfigObjectEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getServiceScopeLevel, validBearerKey } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'
//import { MetricsMessage } from '@jfvilas/kwirth-common'

import express, { Request, Response} from 'express'
//import { MetricsConfig } from '@jfvilas/kwirth-common'
import { ClusterInfo, NodeInfo } from './model/ClusterInfo'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuidv4 } from 'uuid'
//import { clearInterval } from 'timers'

import * as stream from 'stream'
import { PassThrough } from 'stream'; 
import { Metrics } from './tools/MetricsTools'
import { IChannel } from './model/IChannel'
import { AlertChannel } from './channels/AlertChannel'
import { MetricsChannel } from './channels/MetricsChannel'
import { LogChannel } from './channels/LogChannel'

const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883
//const buffer:Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages
//const websocketLog:Map<WebSocket, PassThrough>= new Map()  // list of intervals (and its associated metrics) that produce metrics streams
//const websocketAlarms:Map<WebSocket, {instanceId:string, logStream:PassThrough, working:boolean, paused:boolean, regExps:Map<AlarmSeverityEnum, RegExp[]>} []> = new Map()  // list of intervals (and its associated metrics) that produce metrics streams
//const websocketMetrics:Map<WebSocket, {instanceId:string, timeout: NodeJS.Timeout, working:boolean, paused:boolean, assets: AssetData[], metricsConfig:MetricsConfig} []> = new Map()  // list of intervals (and its associated metrics) that produce metrics streams

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

// split a block of stdout into several lines and send them over the websocket
// const sendLogData = (webSocket:WebSocket, podNamespace:string, podName:string, source:string, logConfig:LogConfig) => {
//     const logLines = source.split('\n')
//     var msg:LogMessage = {
//         namespace: podNamespace,
//         instance: logConfig.instance,
//         type: ServiceMessageTypeEnum.DATA,
//         pod: podName,
//         channel: ServiceConfigChannelEnum.LOG,
//         text: '',
//     }
//     for (var line of logLines) {
//         if (line.trim() !== '') {
//             msg.text=line
//             webSocket.send(JSON.stringify(msg))   
//         }
//     }
// }

// const sendAlarm = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alarmSeverity:AlarmSeverityEnum, line:string, instanceId: string) => {
//     // line includes timestam at front (beacuse of log stream configuration at startup)
//     var i = line.indexOf(' ')
//     var msg:AlarmMessage = {
//         namespace: podNamespace,
//         instance: instanceId,
//         type: ServiceMessageTypeEnum.DATA,
//         pod: podName,
//         container: containerName,
//         channel: ServiceConfigChannelEnum.ALARM,
//         text: line.substring(i+1),
//         timestamp: new Date(line.substring(0,i)),
//         severity: alarmSeverity
//     }
//     webSocket.send(JSON.stringify(msg))   
// }

// const processAlarmSeverity = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alarmSeverity:AlarmSeverityEnum, regexes:RegExp[], line:string, instaceId:string) => {
//     for (var regex of regexes) {
//         var i = line.indexOf(' ')
//         if (regex.test(line.substring(i))) {
//             sendAlarm(webSocket, podNamespace, podName, containerName, alarmSeverity, line, instaceId)
//         }
//     }
// }

// const sendAlarmData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, source:string, instanceId:string) => {
//     var instances = websocketAlarms.get(webSocket)
//     if (!instances) {
//         console.log('No instances found for sendAlarmData')
//         return
//     }
//     var instance = instances.find (i => i.instanceId === instanceId)
//     if (!instance) {
//         console.log(`No instance found for sendAlarmData instance ${instanceId}`)
//         return
//     }

//     if (instance.paused) return

//     const logLines = source.split('\n')
//     for (var line of logLines) {
//         if (line.trim() !== '') {
//             processAlarmSeverity(webSocket, podNamespace, podName, containerName, AlarmSeverityEnum.INFO, instance.regExps.get(AlarmSeverityEnum.INFO)!, line, instanceId)
//             processAlarmSeverity(webSocket, podNamespace, podName, containerName, AlarmSeverityEnum.WARNING, instance.regExps.get(AlarmSeverityEnum.WARNING)!, line, instanceId)
//             processAlarmSeverity(webSocket, podNamespace, podName, containerName, AlarmSeverityEnum.ERROR, instance.regExps.get(AlarmSeverityEnum.ERROR)!, line, instanceId)
//         }
//     }
// }

// const getAssetMetrics = (assetName:string, metricsConfig:MetricsConfig, assets:AssetData[]) : AssetMetrics => {
//     var assetMetrics:AssetMetrics={ assetName: assetName, values: [] }
//     for (var metricName of metricsConfig.metrics) {
//         var uniqueValues:number[]=[]
//         for (var asset of assets) {
//             var result = ClusterData.metrics.getContainerMetricValue(metricName, metricsConfig.view, asset)
//             uniqueValues.push(result)
//         }
//         var metricValue = ClusterData.metrics.getTotal(metricName,uniqueValues)
//         assetMetrics.values.push ( {metricName, metricValue})
//     }
//     return assetMetrics
// }

// const sendMetricsDataInstance = (webSocket:WebSocket, instanceId:string) => {
//     // get instance
//     var instances = websocketMetrics.get(webSocket)
//     if (!instances) {
//         console.log('No instances found for sendMetricsData')
//         return
//     }
//     var instance = instances.find (i => i.instanceId === instanceId)
//     if (!instance) {
//         console.log(`No instance found for sendMetricsData instance ${instanceId}`)
//         return
//     }
//     if (instance.working) {
//         console.log(`Previous instance of ${instanceId} is still running`)
//         return
//     }
//     if (instance.paused) {
//         console.log(`Instance ${instanceId} is paused, no SMD performed`)
//         return
//     }

//     instance.working=true
//     let metricsConfig = instance.metricsConfig

//     try {
//         var metricsMessage:MetricsMessage = {
//             channel: ServiceConfigChannelEnum.METRICS,
//             type: ServiceMessageTypeEnum.DATA,
//             instance: metricsConfig.instance,
//             assets: [],
//             namespace: metricsConfig.namespace,
//             pod: metricsConfig.pod,
//             timestamp: Date.now()
//         }

//         switch(metricsConfig.view) {
//             case ServiceConfigViewEnum.NAMESPACE:
//                 if (metricsConfig.aggregate) {
//                     var assetMetrics = getAssetMetrics(metricsConfig.namespace, metricsConfig, instance.assets)
//                     metricsMessage.assets.push(assetMetrics)
//                 }
//                 else {
//                     const groupNames = [...new Set(instance.assets.map(item => item.podGroup))]
//                     for (var containerName of groupNames) {
//                         var assets=instance.assets.filter(a => a.podGroup===containerName)
//                         var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
//                         metricsMessage.assets.push(assetMetrics)
//                     }
//                 }
//                 break
//             case ServiceConfigViewEnum.GROUP:
//                 if (metricsConfig.aggregate) {
//                     var assetMetrics = getAssetMetrics(metricsConfig.group, metricsConfig, instance.assets)
//                     metricsMessage.assets.push(assetMetrics)
//                 }
//                 else {
//                     const podNames = [...new Set(instance.assets.map(item => item.podName))]
//                     for (var containerName of podNames) {
//                         var assets=instance.assets.filter(a => a.podName===containerName)
//                         var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
//                         metricsMessage.assets.push(assetMetrics)
//                     }
//                 }
//                 break
//             case ServiceConfigViewEnum.POD:
//                 if (metricsConfig.aggregate) {
//                     var assetMetrics = getAssetMetrics(metricsConfig.pod, metricsConfig, instance.assets)
//                     metricsMessage.assets.push(assetMetrics)
//                 }
//                 else {
//                     const containerNames = [...new Set(instance.assets.map(item => item.containerName))]
//                     for (var containerName of containerNames) {
//                         var assets=instance.assets.filter(a => a.containerName===containerName)
//                         var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
//                         metricsMessage.assets.push(assetMetrics)
//                     }
//                 }
//                 break
//             case ServiceConfigViewEnum.CONTAINER:
//                 for (var asset of instance.assets) {
//                     var assetMetrics = getAssetMetrics(asset.containerName, metricsConfig, [asset])
//                     metricsMessage.assets.push(assetMetrics)
//                 }
//                 break
//             default:
//                 console.log(`Invalid view:`, metricsConfig.view)
//         }

//         try {
//             webSocket.send(JSON.stringify(metricsMessage))
//         }
//         catch (err) {
//             console.log('Socket error, we should forget interval')
//         }
//         instance.working=false
//     }
//     catch (err) {
//         console.log('Error reading metrics', err)
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.WARNING, `Cannot read metrics for instance ${instanceId}`,metricsConfig)
//     }
// }

const sendChannelSignal = (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, serviceConfig: ServiceConfig) => {
    switch(serviceConfig.channel) {
        // case ServiceConfigChannelEnum.LOG:
        // //case ServiceConfigChannelEnum.METRICS:
        // //case ServiceConfigChannelEnum.ALARM:
        //     var sgnMsg:SignalMessage = {
        //         level,
        //         channel: serviceConfig.channel,
        //         instance: serviceConfig.instance,
        //         type: ServiceMessageTypeEnum.SIGNAL,
        //         text
        //     }
        //     webSocket.send(JSON.stringify(sgnMsg))
        //     break
        default:
            if (channels.get(serviceConfig.channel)) {
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
            break
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
    console.log(`startPodService '${serviceConfig.channel}': ${podNamespace}/${podName}/${containerName} (view: ${serviceConfig.view})`)

    sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Container ADDED: ${podNamespace}/${podName}/${containerName}`, serviceConfig)
    switch(serviceConfig.channel) {
        // case ServiceConfigChannelEnum.LOG:
        //     // +++ maybe it would be useful to build an 'assets' array like we do in metrics
        //     startPodLog(webSocket, podNamespace, podName, containerName, serviceConfig as LogConfig)
        //     break
        // case ServiceConfigChannelEnum.ALARM:
        //     startPodAlarm(webSocket, podNamespace, podName, containerName, serviceConfig as AlarmConfig)
        //     break
        // case ServiceConfigChannelEnum.METRICS:
        //     startPodMetrics(webSocket, podNamespace, podName, containerName, serviceConfig as MetricsConfig)
        //     break
        default:
            if(channels.has(serviceConfig.channel)) {
                //+++ review this type matching error (webSocket)
                channels.get(serviceConfig.channel)?.startChannel(webSocket as any, serviceConfig, podNamespace, podName, containerName)
            }
            else {
                console.log(`Invalid channel`, serviceConfig.channel)
            }
    }
}

const updatePodService = async (eventType:string, podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    switch(serviceConfig.channel) {
        // case ServiceConfigChannelEnum.LOG:
        //     // nothing to do here
        //     break
        // case ServiceConfigChannelEnum.ALARM:
        //     // nothing to do here
        //     break
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

// get pods logs
// const startPodLog = async (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, logConfig:LogConfig) => {
//     try {
//         const logStream:PassThrough = new stream.PassThrough()
//         logStream.on('data', (chunk:any) => {
//             var text:string=chunk.toString('utf8')
//             if (buffer.get(webSocket)!==undefined) {
//                 // if we have some text from a previous incompleted chunk, we prepend it now
//                 text=buffer.get(webSocket)+text
//                 buffer.delete(webSocket)
//             }
//             if (!text.endsWith('\n')) {
//                 // it's an incomplete chunk, we cut on the last complete line and store the rest of data for prepending it to next chunk
//                 var i=text.lastIndexOf('\n')
//                 var next=text.substring(i)
//                 buffer.set(webSocket,next)
//                 text=text.substring(0,i)
//             }
//             sendLogData(webSocket, podNamespace, podName, text, logConfig)
//         })

//         var streamConfig = { 
//             follow: true, 
//             pretty: false, 
//             timestamps:logConfig.timestamp,
//             previous:Boolean(logConfig.previous),
//             tailLines:logConfig.maxMessages
//         }

//         if (!websocketLog.has(webSocket)) websocketLog.set(webSocket, logStream)
//         await logApi.log(podNamespace, podName, containerName, logStream,  streamConfig)
//     }
//     catch (err) {
//         console.log('Generic error starting pod log', err)
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), logConfig)
//     }
// }

// const startPodAlarm = async (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alarmConfig:AlarmConfig) => {
//     try {
//         // firstly we convert regex string into RegExp strings
//         var regexes: Map<AlarmSeverityEnum, RegExp[]> = new Map()

//         var regExps: RegExp[] = []
//         for (var regStr of alarmConfig.regexInfo)
//             regExps.push(new RegExp (regStr))
//         regexes.set(AlarmSeverityEnum.INFO,regExps)

//         regExps = []
//         for (var regStr of alarmConfig.regexWarning)
//             regExps.push(new RegExp (regStr))
//         regexes.set(AlarmSeverityEnum.WARNING,regExps)

//         regExps = []
//         for (var regStr of alarmConfig.regexError)
//             regExps.push(new RegExp (regStr))
//         regexes.set(AlarmSeverityEnum.ERROR,regExps)

//         const logStream:PassThrough = new stream.PassThrough()
//         logStream.on('data', (chunk:any) => {
//             var text:string=chunk.toString('utf8')
//             if (buffer.get(webSocket)!==undefined) {
//                 // if we have some text from a previous incompleted chunk, we prepend it now
//                 text=buffer.get(webSocket)+text
//                 buffer.delete(webSocket)
//             }
//             if (!text.endsWith('\n')) {
//                 // it's an incomplete chunk, we cut on the last complete line and store the rest of data for prepending it to next chunk
//                 var i=text.lastIndexOf('\n')
//                 var next=text.substring(i)
//                 buffer.set(webSocket,next)
//                 text=text.substring(0,i)
//             }
//             sendAlarmData(webSocket, podNamespace, podName, containerName, text, alarmConfig.instance)
//         })

//         if (!websocketAlarms.get(webSocket)) websocketAlarms.set(webSocket, [])
//         websocketAlarms.get(webSocket)?.push ({ instanceId: alarmConfig.instance, working:true, paused:false, logStream:logStream, regExps: regexes })   

//         var kubernetesStreamConfig = {
//             follow: true, 
//             pretty: false, 
//             timestamps: true
//         }
//         console.log('start streaming', podNamespace, podName, containerName)
//         await k8sLog.log(podNamespace, podName, containerName, logStream,  kubernetesStreamConfig)
//     }
//     catch (err) {
//         console.log('Generic error starting pod log', err)
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), alarmConfig)
//     }
// }

// start pods metrics
// const startPodMetrics = async (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, metricsConfig:MetricsConfig) => {
//     try {
//         switch (metricsConfig.mode) {
//             case MetricsConfigModeEnum.SNAPSHOT:
//                 // +++ pending implementation. implement when metric streaming is complete
//                 // snapshot is just obtaing metrics and sending response, no further actions will be taken
//                 break
//             case MetricsConfigModeEnum.STREAM:
//                 const podResponse = await coreApi.readNamespacedPod(podName, podNamespace)
//                 const owner = podResponse.body.metadata?.ownerReferences![0]!
//                 const gtype = owner.kind.toLocaleLowerCase().replace('set','')  // gtype is 'replica', 'stateful' or 'daemon'
//                 const podGroup = gtype+'+'+owner.name
//                 const podNode = podResponse.body.spec?.nodeName
//                 if (podNode) {
//                     console.log(`Start pod metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
//                     if (websocketMetrics.has(webSocket)) {
//                         var instances = websocketMetrics.get(webSocket)
//                         var instance = instances?.find((instance) => instance.instanceId === metricsConfig.instance)
//                         if (metricsConfig.view === ServiceConfigViewEnum.CONTAINER) {
//                             instance?.assets.push ({podNode, podNamespace, podGroup, podName, containerName})
//                         }
//                         else {
//                             if (!instance?.assets.find(a => a.podName === podName)) {
//                                 instance?.assets.push ({podNode, podNamespace, podGroup, podName, containerName})                            
//                             }
//                         }
//                     }
//                     else {
//                         websocketMetrics.set(webSocket, [])
//                         var interval=(metricsConfig.interval?metricsConfig.interval:60)*1000
//                         var timeout = setInterval(() => sendMetricsDataInstance(webSocket,metricsConfig.instance), interval)
//                         var instances=websocketMetrics.get(webSocket)
//                         instances?.push({instanceId:metricsConfig.instance, working:false, paused:false, timeout, assets:[{podNode, podNamespace, podGroup, podName, containerName}], metricsConfig})
//                     }
//                 }
//                 else {
//                     console.log(`Cannot determine node for ${podNamespace}/${podName}}, will not be added`)
//                 }
//                 break
//             default:
//                 sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${metricsConfig.mode}`, metricsConfig.mode)
//                 break
//         }
//     }
//     catch (err) {
//         console.log('Generic error starting metrics service', err)
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), metricsConfig)
//     }
// }

// watches for pod changes (add, delete...) inside the group pointed by the requestor
const watchPods = (apiPath:string, labelSelector:any, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    const watch = new Watch(kubeConfig)

    console.log('************************towatch')
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
                        console.log(sccontainers)
                        console.log(scpods)
                        console.log(containerName)
                        console.log(podName)
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

// const startLogConfig = async (logConfig: LogConfig, webSocket: WebSocket, accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validPodNames: string[]) => {
//     switch (logConfig.scope) {
//         case 'view':
//         case 'filter':
//             var requestedValidatedPods = await getRequestedValidatedScopedPods(logConfig, accessKeyResources, validNamespaces, validPodNames)
//             if (requestedValidatedPods.length===0) {
//                 sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: there are no filters that match requested log config`, logConfig)
//             }
//             else {
//                 switch (logConfig.view) {
//                     case 'namespace':
//                         logConfig.instance = uuidv4()
//                         for (var ns of validNamespaces) {
//                             watchPods(`/api/v1/namespaces/${ns}/pods`, {}, webSocket, logConfig)
//                         }
//                         sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
//                         break
//                     case 'group':
//                         logConfig.instance = uuidv4()
//                         for (var ns of validNamespaces) {
//                             var pods = (await getPodsFromGroup(coreApi, appsApi, ns, logConfig.group))
//                             if (pods.pods.length >= 0) watchPods(`/api/v1/namespaces/${ns}/pods`, { labelSelector: pods.labelSelector }, webSocket, logConfig)
//                         }
//                         sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
//                         break
//                     case 'pod':
//                     case 'container':
//                         var validPod=requestedValidatedPods.find(p => p.metadata?.name === logConfig.pod)
//                         if (validPod) {
//                             var podLogConfig:LogConfig = {
//                                 channel: ServiceConfigChannelEnum.LOG,
//                                 object: ServiceConfigObjectEnum.PODS,
//                                 action: ServiceConfigActionEnum.START,
//                                 flow: ServiceConfigFlowEnum.REQUEST,
//                                 instance: uuidv4(),
//                                 accessKey: '',
//                                 timestamp: logConfig.timestamp,
//                                 previous: logConfig.previous,
//                                 maxMessages: logConfig.maxMessages,
//                                 scope: logConfig.scope,
//                                 namespace: validPod.metadata?.namespace!,
//                                 group: '',
//                                 pod: validPod.metadata?.name!,
//                                 container: logConfig.view === ServiceConfigViewEnum.CONTAINER ? logConfig.container : '',
//                                 view: logConfig.view,
//                             }

//                             var metadataLabels = validPod.metadata?.labels
//                             if (metadataLabels) {
//                                 var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
//                                 watchPods(`/api/v1/namespaces/${podLogConfig.namespace}/pods`, { labelSelector }, webSocket, podLogConfig)
//                                 logConfig.instance = uuidv4()
//                                 sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
//                             }
//                             else {
//                                 sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, logConfig)
//                             }
//                         }
//                         else {
//                             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${logConfig.pod}'`, logConfig)
//                         }
//                         break
//                     default:
//                         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid view '${logConfig.view}'`, logConfig)
//                         break
//                 }
//             }
//             break
//         default:
//             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: invalid scope '${logConfig.scope}'`, logConfig)
//             return
//     }
// }

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
        // case 'pod':
        // case 'container':
        //     serviceConfig.instance = uuidv4()
        //     for (var pod of serviceConfig.pod.split(',')) {
        //         var validPod=requestedValidatedPods.find(p => p.metadata?.name === pod)
        //         if (validPod) {
        //             var metadataLabels = validPod.metadata?.labels
        //             if (metadataLabels) {
        //                 var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
        //                 watchPods(`/api/v1/pods`, { labelSelector }, webSocket, serviceConfig)
        //                 sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, serviceConfig.channel, serviceConfig, 'Service Config accepted')
        //             }
        //             else {
        //                 sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: cannot get metadata labels`, serviceConfig)
        //             }
        //         }
        //         else {
        //             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey has no access to pod '${pod}'`, serviceConfig)
        //         }
        //     }
        //     break
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

// const processStartServiceConfig = async(serviceConfig: ServiceConfig, webSocket: WebSocket, accessKeyResources: ResourceIdentifier[], validNamespaces: string[], validPodNames: string[]) => {
//     switch (serviceConfig.channel) {
//         case ServiceConfigChannelEnum.LOG:
//             processStartLogConfig(serviceConfig as LogConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
//             break
//         case ServiceConfigChannelEnum.ALARM:
//             throw 'asdasdas'
//             //processStartAlarmConfig(serviceConfig as AlarmConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
//             break
//         case ServiceConfigChannelEnum.METRICS:
//             throw 'asdasdas'
//             //processStartMetricsConfig(serviceConfig as MetricsConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
//             break
//         default:
//             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
//             break
//     }
// }

// const removeLog = (webSocket:WebSocket) => {
//     if (websocketLog.has(webSocket)) {
//         var passThrough = websocketLog.get(webSocket)
//         if (passThrough) {
//             passThrough.removeAllListeners()
//         }
//         else {
//             console.log('There are passthorugh on websocket')
//         }
//     }
//     else {
//         console.log('WebSocket not found on alarms')
//     }
// }

// const removeAlarm = (webSocket:WebSocket, instanceId:string) => {
//     if (websocketAlarms.has(webSocket)) {
//         var instances = websocketAlarms.get(webSocket)
//         if (instances) {
//             var instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
//             while (instanceIndex>=0) {
//                 if (instanceIndex>=0) {
//                     var instance = instances[instanceIndex]
//                     if (instance.logStream)
//                         instance.logStream.removeAllListeners()
//                     else
//                         console.log(`Alarm logStream not found of instance id ${instanceId}`)
//                     instances.splice(instanceIndex,1)
//                 }
//                 else{
//                     console.log(`Instance ${instanceId} not found, cannot delete alarm`)
//                 }
//                 instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
//             }
//         }
//         else {
//             console.log('There are no alarm Instances on websocket')
//         }
//     }
//     else {
//         console.log('WebSocket not found on alarms')
//     }
// }

// const removeMetrics = (webSocket:WebSocket, instance:string) => {
//     if (websocketMetrics.has(webSocket)) {
//         var instances = websocketMetrics.get(webSocket)
//         if (instances) {
//             var instanceIndex = instances.findIndex(t => t.instanceId === instance)
//             if (instanceIndex>=0) {
//                 clearInterval(instances[instanceIndex].timeout)
//                 instances.splice(instanceIndex,1)
//             }
//             else{
//                 console.log('Instance not found, cannot delete')
//             }
//         }
//         else {
//             console.log('There are no Instances on websocket')
//         }
//     }
//     else {
//         console.log('WebSocket not found on intervals')
//     }
// }

// const processStopLogConfig = async (logConfig: LogConfig, webSocket: WebSocket) => {
//     var stream=websocketLog.get(webSocket)
//     if (stream) {
//         stream.removeAllListeners()
//     }
//     else {
//         console.log('LogStream not found')
//     }
//     sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Log service stopped')
// }

// const processStopAlarmConfig = async (alarmgConfig: AlarmConfig, webSocket: WebSocket) => {
//     if (websocketAlarms.get(webSocket)?.find(i => i.instanceId === alarmgConfig.instance)) {
//         removeAlarm(webSocket,alarmgConfig.instance)
//         sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALARM, alarmgConfig, 'Alarm service stopped')
//     }
//     else {
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey doesn't allow ot there are no instances`, alarmgConfig)
//     }
// }

// const processStopMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket) => {
//     removeMetrics(webSocket,metricsConfig.instance)
//     sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Metrics service stopped')
// }

const processStopServiceConfig = async (webSocket: WebSocket, serviceConfig: ServiceConfig) => {
    switch (serviceConfig.channel) {
        // case ServiceConfigChannelEnum.LOG:
        //     processStopLogConfig(serviceConfig as LogConfig, webSocket)
        //     break
        // case ServiceConfigChannelEnum.ALARM:
        //     processStopAlarmConfig(serviceConfig as AlarmConfig, webSocket)
        //     break
        // case ServiceConfigChannelEnum.METRICS:
        //     processStopMetricsConfig(serviceConfig as MetricsConfig, webSocket)
        //     break
        default:
            if (channels.get(serviceConfig.channel)) {
                channels.get(serviceConfig.channel)?.stopChannel(webSocket as any, serviceConfig)
            }
            else {
                console.log('Invalid channel on service stop')
            }
            break
    }
}

// const processModifyMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket) => {
//     let runningInstances = websocketMetrics.get(webSocket)
//     let instance = runningInstances?.find(i => i.instanceId===metricsConfig.instance)
//     if (instance) {
//         // only modifiable propertis of the metrics config
//         instance.metricsConfig.metrics = metricsConfig.metrics
//         instance.metricsConfig.interval = metricsConfig.interval
//         instance.metricsConfig.aggregate = metricsConfig.aggregate
//         sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.MODIFY, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Metrics modified')
//     }
//     else {
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${metricsConfig.instance} not found`, metricsConfig)
//     }
// }

// +++ test modify instance (only metrics interval or aggregate can be modified)
// const processModifyServiceConfig = async (serviceConfig: ServiceConfig, webSocket: WebSocket) => {
//     switch (serviceConfig.channel) {
//         // case ServiceConfigChannelEnum.LOG:
//         // //case ServiceConfigChannelEnum.ALARM:
//         //     sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Modify process no implemented for channel ${serviceConfig.channel}`,serviceConfig)
//         //     break
//         // case ServiceConfigChannelEnum.METRICS:
//         //     processModifyMetricsConfig(serviceConfig as MetricsConfig, webSocket)
//         //     break
//         default:
//             sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Unsupported channel: ${serviceConfig.channel}`,serviceConfig)
//             break
//     }
// }

// const processPauseContinueAlarmConfig = async (alarmConfig: AlarmConfig, webSocket: WebSocket, action:ServiceConfigActionEnum) => {
//     let alarmInstances = websocketAlarms.get(webSocket)
//     let alarmInstance = alarmInstances?.find(i => i.instanceId === alarmConfig.instance)
//     if (alarmInstance) {
//         if (action === ServiceConfigActionEnum.PAUSE) {
//             alarmInstance.paused = true
//             sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.PAUSE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALARM, alarmConfig, 'Alarm paused')
//         }
//         if (action === ServiceConfigActionEnum.CONTINUE) {
//             alarmInstance.paused = false
//             sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.CONTINUE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALARM, alarmConfig, 'Alarm continued')
//         }
//     }
//     else {
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${alarmConfig.instance} not found`,alarmConfig)
//     }
// }

// const processPauseContinueMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket, action:ServiceConfigActionEnum) => {
//     let runningInstances = websocketMetrics.get(webSocket)
//     let instance = runningInstances?.find(i => i.instanceId===metricsConfig.instance)
//     if (instance) {
//         if (action === ServiceConfigActionEnum.PAUSE) {
//             instance.paused = true
//             sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.PAUSE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Metrics paused')
//         }
//         if (action === ServiceConfigActionEnum.CONTINUE) {
//             instance.paused = false
//             sendServiceConfigSignalMessage(webSocket,ServiceConfigActionEnum.CONTINUE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Metrics continued')
//         }
//     }
//     else {
//         sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${metricsConfig.instance} not found`, metricsConfig)
//     }
// }

const processPauseContinueServiceConfig = async (serviceConfig: ServiceConfig, webSocket: WebSocket, action:ServiceConfigActionEnum) => {
    switch (serviceConfig.channel) {
        // case ServiceConfigChannelEnum.LOG:
        //     break
        // case ServiceConfigChannelEnum.ALARM:
        //     processPauseContinueAlarmConfig(serviceConfig as AlarmConfig, webSocket, action)
        //     break
        // case ServiceConfigChannelEnum.METRICS:
        //     processPauseContinueMetricsConfig(serviceConfig as MetricsConfig, webSocket, action)
        //     break
        default:
            if (channels.get(serviceConfig.channel)) {
                channels.get(serviceConfig.channel)?.pauseContinueChannel(webSocket as any, serviceConfig, serviceConfig.action)            
            }
            else {
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.channel} does not exist`, serviceConfig)
            }
            break

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
        validPodNames = [...new Set(allowedPodNames)]    
    }
    else {
        allowedPodNames = accessKeyResources.filter(r => r.pod!='').map(r => r.pod)
        validPodNames = requestedPodNames.filter(podName => allowedPodNames.includes(podName))
        validPodNames = [...new Set(validPodNames)]
    }

    console.log('validNamespaces')
    console.log(validNamespaces)
    console.log('validPodNames')
    console.log(validPodNames)

    switch (serviceConfig.action) {
        case ServiceConfigActionEnum.START:
            switch (serviceConfig.channel) {
                // case ServiceConfigChannelEnum.LOG:
                //     startLogConfig(serviceConfig as LogConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
                //     break
                //case ServiceConfigChannelEnum.ALARM:
                // case ServiceConfigChannelEnum.METRICS:
                //     processStartServiceConfig(serviceConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
                //     break
                default:
                    if (channels.has(serviceConfig.channel)) {
                        processStartServiceConfig(serviceConfig, webSocket, accessKeyResources, validNamespaces, validPodNames)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
                    }
                    break
            }
            break
        case ServiceConfigActionEnum.STOP:
            switch (serviceConfig.channel) {
                // case ServiceConfigChannelEnum.LOG:
                // //case ServiceConfigChannelEnum.ALARM:
                // //case ServiceConfigChannelEnum.METRICS:
                //     processStopServiceConfig(webSocket, serviceConfig)
                //     break
                default:
                    if (channels.has(serviceConfig.channel)) {
                        processStopServiceConfig(webSocket, serviceConfig)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig channel: ${serviceConfig.channel}`, serviceConfig)
                    }
                    break
            }
            break
        case ServiceConfigActionEnum.MODIFY:
            switch (serviceConfig.channel) {
                // case ServiceConfigChannelEnum.LOG:
                // //case ServiceConfigChannelEnum.ALARM:
                // //case ServiceConfigChannelEnum.METRICS:
                //     processModifyServiceConfig(serviceConfig, webSocket)
                //     break
                default:
                    if (channels.get(serviceConfig.channel)) {
                        channels.get(serviceConfig.channel)?.modifyService(webSocket as any, serviceConfig)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig type: ${serviceConfig.channel}`, serviceConfig)
                    }
                    break
            }
            break
        case ServiceConfigActionEnum.PAUSE:
        case ServiceConfigActionEnum.CONTINUE:
            switch (serviceConfig.channel) {
                // case ServiceConfigChannelEnum.LOG:
                // //case ServiceConfigChannelEnum.ALARM:
                // //case ServiceConfigChannelEnum.METRICS:
                //     processPauseContinueServiceConfig(serviceConfig, webSocket, serviceConfig.action)
                //     break
                default:
                    if (channels.has(serviceConfig.channel)) {
                        processPauseContinueServiceConfig(serviceConfig, webSocket, serviceConfig.action)
                    }
                    else {
                        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid ServiceConfig type: ${serviceConfig.channel}`, serviceConfig)
                    }
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
    // if (websocketMetrics.has(ws)) {
    //     let instances=websocketMetrics.get(ws)
    //     if (instances) {
    //         for (var i=0;i<instances.length;i++) {
    //             console.log(`Interval for instance ${instances[i].instanceId} has been removed`)
    //             removeMetrics(ws,instances[i].instanceId)
    //         }
    //     }
    //     websocketMetrics.delete(ws)
    // }
    // if (websocketAlarms.has(ws)) {
    //     let instances=websocketAlarms.get(ws)
    //     if (instances) {
    //         for (var i=0;i<instances.length;i++) {
    //             console.log(`Alarm for instance ${instances[i].instanceId} has been removed`)
    //             removeAlarm(ws,instances[i].instanceId)
    //         }
    //     }
    //     websocketAlarms.delete(ws)
    // }
    // if (websocketLog.has(ws)) {
    //     let passThorugh = websocketLog.get(ws)
    //     if (passThorugh) {
    //         console.log(`PassThrough for websocket has been removed`)
    //         removeLog(ws)
    //     }
    //     websocketLog.delete(ws)
    // }
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
    var va:ConfigApi = new ConfigApi(coreApi, appsApi, kwirthData, channels)
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
    var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi, channels)
    app.use(`${rootPath}/managecluster`, mc.route)
    var ma:MetricsApi = new MetricsApi(clusterInfo)
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
            console.log(`Cluster name (according to kubeconfig context): ${kubeConfig.getCluster(kubeConfig.currentContext)?.name}`)
            console.log(`Kwirth is NOT running inside a cluster`)
        }
        console.log(`KWI1500I Control is being given to Kwirth`)
    })
    process.on('exit', () => {
        console.log('exiting')
        saToken.deleteToken('kwirth-sa',kwirthData.namespace)
    })
}
const initCluster = async (token:string) : Promise<ClusterInfo> => {
    var metricsInterval:number = 60
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

    var metrics = new Metrics(token)
    await metrics.loadMetrics(Array.from(nodes.values()))

    var clusterInfo:ClusterInfo = {
        nodes,
        metrics,
        metricsInterval,
        token,
        coreApi,
        appsApi, 
        logApi
    }
    setInterval( () => {
        metrics.readClusterMetrics(clusterInfo)
    }, metricsInterval * 1000)

    return clusterInfo
}


////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`)
console.log(`Kwirth started at ${new Date().toISOString()}`)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// serve front application
getMyKubernetesData()
.then ( async (kwirthData) => {
    try {
        saToken = new ServiceAccountToken(coreApi, kwirthData.namespace)
        // serv accnt tokens are not created immediately, so we need to wait some time (5 segs)
        // +++ review these async calls
        saToken.createToken('kwirth-sa',kwirthData.namespace).then ( () => {
            setTimeout ( () => {
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

                        console.log(`Enabled channels: ${Array.from(channels.keys()).map(c => `'${c}'`).join(',')}`)
                        console.log(`Detected own namespace: ${kwirthData.namespace}`)
                        console.log(`Detected own deployment: ${kwirthData.deployment}`)
                        launch(kwirthData, clusterInfo)
                    }
                    else {
                        console.log('SA token is invalid')
                    }
                })
                .catch ( (err) => {
                    console.log('Could not get SA token, metrics will not be available')
                })
            }, 1000)
        })
    }
    catch (err){
        console.log(err)
    }
})
.catch ( (err) => {
    console.log('Cannot get namespace, exiting...')
})
