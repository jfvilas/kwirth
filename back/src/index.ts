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
import { LogConfig, LogMessage, MetricsConfigModeEnum, ServiceConfigActionEnum, ServiceConfigFlowEnum, versionGreatThan, accessKeyDeserialize, accessKeySerialize, parseResource, ResourceIdentifier, KwirthData, ServiceConfigChannelEnum, ServiceConfig, SignalMessage, SignalMessageLevelEnum, ServiceConfigViewEnum, ServiceMessageTypeEnum, AssetMetrics } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getServiceScopeLevel } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'
import { MetricsMessage } from '@jfvilas/kwirth-common'

import express, { Request, Response} from 'express'
import { MetricsConfig } from '@jfvilas/kwirth-common'
import { ClusterData } from './tools/ClusterData'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { MetricsApi } from './api/MetricsApi'
import { v4 as uuidv4 } from 'uuid'
import { clearInterval } from 'timers'

import * as stream from 'stream'
import { PassThrough } from 'stream'; 
import { AssetData } from './tools/Metrics'
import { assert } from 'console'
const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883
const buffer:Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages
const websocketIntervals:Map<WebSocket, {id:string, timeout: NodeJS.Timeout, working:boolean, prevValues: number[], assets: AssetData[]} []>= new Map()  // list of intervals (and its associated metrics) that produce metrics streams
const websocketLogStreams:Map<WebSocket, PassThrough>= new Map()  // list of intervals (and its associated metrics) that produce metrics streams

// Kubernetes API access
const kubeConfig = new KubeConfig()
kubeConfig.loadFromDefault()
const coreApi = kubeConfig.makeApiClient(CoreV1Api)
const appsApi = kubeConfig.makeApiClient(AppsV1Api)
//const customApi = kubeConfig.makeApiClient(CustomObjectsApi)
const k8sLog = new Log(kubeConfig)

var secrets:Secrets
var configMaps:ConfigMaps
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
const sendLogData = (webSocket:WebSocket, podNamespace:string, podName:string, source:string, logConfig:LogConfig) => {
    const logLines = source.split('\n')
    var msg:LogMessage = {
        namespace: podNamespace,
        instance: logConfig.instance,
        type: ServiceMessageTypeEnum.DATA,
        pod: podName,
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

const getAssetMetrics = (assetName:string, metricsConfig:MetricsConfig, assets:AssetData[]) : AssetMetrics => {
    var assetMetrics:AssetMetrics={ assetName: assetName, values: [] }
    for (var metricName of metricsConfig.metrics) {
        var uniqueValues:number[]=[]
        for (var asset of assets) {
            var result = ClusterData.metrics.getContainerMetricValue(metricName, metricsConfig.view, asset)
            uniqueValues.push(result)
        }
        var metricValue = ClusterData.metrics.getTotal(metricName,uniqueValues)
        assetMetrics.values.push ( {metricName, metricValue})
    }
    return assetMetrics
}

const sendMetricsData = (webSocket:WebSocket, metricsConfig:MetricsConfig) => {
    console.log('smd')
    var metricsMessage:MetricsMessage = {
        channel: ServiceConfigChannelEnum.METRICS,
        type: ServiceMessageTypeEnum.DATA,
        instance: metricsConfig.instance,
        assets: [],
        namespace: metricsConfig.namespace,
        pod: metricsConfig.pod,
        timestamp: Date.now()
    }
    try {
        // get instance
        var instances = websocketIntervals.get(webSocket)
        if (!instances) {
            console.log('No instances found for smd')
            return
        }
        var instance = instances.find (i => i.id === metricsConfig.instance)
        if (!instance) {
            console.log('No instance found for smd instance', metricsConfig.instance)
            return
        }
        if (instance.working) {
            console.log('Previous instance is still running')
            return
        }
        instance.working=true
        console.log('instance', instance)

        switch(metricsConfig.view) {
            case ServiceConfigViewEnum.NAMESPACE:
                if (metricsConfig.aggregate) {
                    var assetMetrics = getAssetMetrics(metricsConfig.namespace, metricsConfig, instance.assets)
                    metricsMessage.assets.push(assetMetrics)
                }
                else {
                    const groupNames = [...new Set(instance.assets.map(item => item.podGroup))]
                    for (var containerName of groupNames) {
                        var assets=instance.assets.filter(a => a.podGroup===containerName)
                        var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
                        metricsMessage.assets.push(assetMetrics)
                    }
                }
                break
            case ServiceConfigViewEnum.GROUP:
                if (metricsConfig.aggregate) {
                    var assetMetrics = getAssetMetrics(metricsConfig.group, metricsConfig, instance.assets)
                    metricsMessage.assets.push(assetMetrics)
                }
                else {
                    const podNames = [...new Set(instance.assets.map(item => item.podName))]
                    for (var containerName of podNames) {
                        var assets=instance.assets.filter(a => a.podName===containerName)
                        var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
                        metricsMessage.assets.push(assetMetrics)
                    }
                }
                break
            case ServiceConfigViewEnum.POD:
                if (metricsConfig.aggregate) {
                    var assetMetrics = getAssetMetrics(metricsConfig.pod, metricsConfig, instance.assets)
                    metricsMessage.assets.push(assetMetrics)
                }
                else {
                    const containerNames = [...new Set(instance.assets.map(item => item.containerName))]
                    for (var containerName of containerNames) {
                        var assets=instance.assets.filter(a => a.containerName===containerName)
                        var assetMetrics = getAssetMetrics(containerName, metricsConfig, assets)
                        metricsMessage.assets.push(assetMetrics)
                    }
                }
                break
            case ServiceConfigViewEnum.CONTAINER:
                for (var asset of instance.assets) {
                    var assetMetrics = getAssetMetrics(asset.containerName, metricsConfig, [asset])
                    metricsMessage.assets.push(assetMetrics)
                }
                break
            default:
                console.log(`Invalid view:`, metricsConfig.view)
        }

        try {
            webSocket.send(JSON.stringify(metricsMessage))
            //+++instance.prevValues = metricsMessage.value
        }
        catch (err) {
            console.log('Socket error, we should forget interval')
        }
        instance.working=false
    }
    catch (err) {
        console.log('Error reading metrics', err)
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
                type: ServiceMessageTypeEnum.SIGNAL,
                text
            }
            webSocket.send(JSON.stringify(sgnMsg))
            break
        default:
            console.log(`Unsupported channel ${serviceConfig.channel}`)
            break
    }
}

const sendServiceConfigMessage = (ws:WebSocket, action:ServiceConfigActionEnum, flow: ServiceConfigFlowEnum, channel: ServiceConfigChannelEnum, serviceConfig:ServiceConfig, text:string) => {
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

const startPodService = (podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    console.log(`startPodService ${serviceConfig.channel}: ${podNamespace}/${podName}/${containerName} (view: ${serviceConfig.view})`)
    if ((serviceConfig.view === ServiceConfigViewEnum.POD || serviceConfig.view === ServiceConfigViewEnum.CONTAINER) && serviceConfig.pod!==podName) {
        console.log('Pod excluded: ', podName)
        return
    }
    switch(serviceConfig.channel) {
        case ServiceConfigChannelEnum.LOG:
            // +++ maybe it would be useful to build an 'assets' array like we do in metrics
            startPodLog(webSocket, podNamespace, podName, containerName, serviceConfig as LogConfig)
            break
        case ServiceConfigChannelEnum.METRICS:
            startPodMetrics(webSocket, podNamespace, podName, containerName, serviceConfig as MetricsConfig)
            break
        default:
            console.log(`Invalid channel`, serviceConfig.channel)
    }
}

const updatePodService = async (eventType:string, podNamespace:string, podName:string, containerName:string, webSocket:WebSocket, serviceConfig:ServiceConfig) => {
    switch(serviceConfig.channel) {
        case ServiceConfigChannelEnum.LOG:
            // nothing to do here
            break
        case ServiceConfigChannelEnum.METRICS:
            var metricsConfig = serviceConfig as MetricsConfig
            var instances = websocketIntervals.get(webSocket)
            var instance = instances?.find((instance) => instance.id === metricsConfig.instance)
            if (instance) {
                if (eventType==='DELETED') instance.assets = instance.assets.filter(c => c.podNamespace!==podNamespace && c.podName!==podName && c.containerName!==containerName)
                if (eventType==='MODIFIED') {
                    var thisPod = instance.assets.find(p => p.podNamespace===podNamespace && p.podName===podName && p.containerName===containerName)
                    if (thisPod) thisPod.startTime = await getPodStartTime(podNamespace,podName)
                }
            }
            break
        default:
            console.log(`Invalid channel`, serviceConfig.channel)
    }
}

// get pods logs
const startPodLog = async (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, logConfig:LogConfig) => {
    try {
        const logStream:PassThrough = new stream.PassThrough()
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
            sendLogData(webSocket, podNamespace, podName, text, logConfig)
        })

        var streamConfig = { 
            follow: true, 
            pretty: false, 
            timestamps:logConfig.timestamp,
            previous:Boolean(logConfig.previous),
            tailLines:logConfig.maxMessages
        }

        if (!websocketLogStreams.has(webSocket))
            websocketLogStreams.set(webSocket, logStream)
        else
            console.log('WebSocket LogStream already exists')

        await k8sLog.log(podNamespace, podName, containerName, logStream,  streamConfig)
    }
    catch (err) {
        console.log('Generic error starting pod log', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), logConfig)
    }
}

const getPodStartTime = async (namespace:string, pod:string) => {
    var epoch:number=0
    try {
        const podResponse = await coreApi.readNamespacedPod(pod, namespace);
        const startTime = podResponse.body.status?.startTime;
        if (startTime!==undefined) epoch = startTime?.getTime()
    }
    catch (error) {
        console.error('Error obtaining pod information:', error);
    }
    return epoch
}

// start pods metrics
const startPodMetrics = async (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, metricsConfig:MetricsConfig) => {
    try {
        switch (metricsConfig.mode) {
            case MetricsConfigModeEnum.SNAPSHOT:
                // +++ pending implementation. implement when metric streaming is complete
                // snapshot is just obtaeing metrics and sending response, no further actionas will be taken
                break
            case MetricsConfigModeEnum.STREAM:
                const podResponse = await coreApi.readNamespacedPod(podName, podNamespace)
                const owner = podResponse.body.metadata?.ownerReferences![0]!
                var gtype='replica'
                if (owner.kind==='DaemonSet') gtype='daemon'
                if (owner.kind==='StatefulSet') gtype='stateful'
                const podGroup = gtype+'+'+owner.name
                const podNode = podResponse.body.spec?.nodeName
                if (podNode) {
                    var startTime= await getPodStartTime(podNamespace, podName)
                    if (websocketIntervals.has(webSocket)) {
                        var instances = websocketIntervals.get(webSocket)
                        var instance = instances?.find((instance) => instance.id === metricsConfig.instance)
                        instance?.assets.push ({podNode, podNamespace, podGroup, podName, containerName, startTime})
                    }
                    else {
                        websocketIntervals.set(webSocket, [])
                        var interval=(metricsConfig.interval?metricsConfig.interval:60)*1000
                        var timeout = setInterval(() => sendMetricsData(webSocket,metricsConfig), interval)
                        var instances=websocketIntervals.get(webSocket)
                        instances?.push({id:metricsConfig.instance, working:false, timeout, prevValues:[],  assets:[{podNode, podNamespace, podGroup, podName, containerName,startTime}]})
                    }
                }
                else {
                    console.log(`Cannot determine node for ${podNamespace}/${podName}}, will not be added`)
                }
                break
            default:
                sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${metricsConfig.mode}`, metricsConfig.mode)
                break
        }
    }
    catch (err) {
        console.log('Generic error starting metrics service', err)
        sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), metricsConfig)
    }
}

// watches for pod changes (add, delete...) inside the group pointed by the requestor
const watchPods = (apiPath:string, filter:any, webSocket:WebSocket, serviceConfig:any) => {
    const watch = new Watch(kubeConfig)

    watch.watch(apiPath, filter, (eventType:string, obj:any) => {
        const podName:string = obj.metadata.name
        const podNamespace:string = obj.metadata.namespace
        if (eventType === 'ADDED') {
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, serviceConfig)

            for (var container of obj.spec.containers) {
                switch (serviceConfig.view) {
                    case ServiceConfigViewEnum.NAMESPACE:
                        startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                        break
                    case ServiceConfigViewEnum.GROUP:
                        var [groupType, groupName] = serviceConfig.group.split('+')
                        if (podName.startsWith(groupName)) {
                            startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                        }
                        break
                    case ServiceConfigViewEnum.POD:
                        if (podName === serviceConfig.pod) {
                            startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                        }
                        break
                    case ServiceConfigViewEnum.CONTAINER:
                        if (container.name === serviceConfig.container) {
                            startPodService(podNamespace, podName, container.name, webSocket, serviceConfig)
                        }
                        break
                    default:
                        console.log('Invalid serviceConfig view')
                        break
                }
            }
        }
        else if (eventType === 'DELETED' || eventType === 'MODIFIED') {
            console.log(`Pod ${eventType}`)
            updatePodService(eventType, podNamespace, podName, '', webSocket, serviceConfig)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Pod ${eventType}: ${podNamespace}/${podName}`, serviceConfig)
        }
        else {
            console.log(`Pod ${eventType} is unmanaged`)
            sendChannelSignal(webSocket, SignalMessageLevelEnum.INFO, `Received unmanaged event (${eventType}): ${podNamespace}/${podName}`, serviceConfig)
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
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
                        break
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, {}, webSocket, logConfig)
                        logConfig.instance = uuidv4()
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
                        break
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, logConfig.namespace, logConfig.group)).labelSelector
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, { labelSelector }, webSocket, logConfig)
                        logConfig.instance = uuidv4()
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
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
                                container: logConfig.view === ServiceConfigViewEnum.CONTAINER ? logConfig.container : '',
                                view: logConfig.view,
                            }

                            var metadataLabels = validPod.metadata?.labels
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                                watchPods(`/api/v1/namespaces/${podLogConfig.namespace}/pods`, { labelSelector }, webSocket, podLogConfig)
                                logConfig.instance = uuidv4()
                                sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, logConfig, 'Service Config accepted')
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
                switch (metricsConfig.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Service config accepted')
                        break
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, {}, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Service config accepted')
                        break
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, metricsConfig.namespace, metricsConfig.group)).labelSelector
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, { labelSelector }, webSocket, metricsConfig)
                        metricsConfig.instance = uuidv4()
                        sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Service config accepted')
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
                                scope: metricsConfig.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: metricsConfig.view === ServiceConfigViewEnum.CONTAINER ? metricsConfig.container : '',
                                view: metricsConfig.view,
                                mode: metricsConfig.mode,
                                interval: metricsConfig.interval,
                                metrics: metricsConfig.metrics,
                                aggregate: metricsConfig.aggregate
                            }

                            var metadataLabels = validPod.metadata?.labels
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                                watchPods(`/api/v1/namespaces/${podMetricsConfig.namespace}/pods`, { labelSelector }, webSocket, podMetricsConfig)
                                metricsConfig.instance = uuidv4()
                                sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.START, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, metricsConfig, 'Service config accepted')
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

const removeMetricsInterval = (webSocket:WebSocket, instance:string) => {
    if (websocketIntervals.has(webSocket)) {
        var instances = websocketIntervals.get(webSocket)
        if (instances) {
            var instanceIndex = instances.findIndex(t => t.id === instance)
            if (instanceIndex>=0) {
                clearInterval(instances[instanceIndex].timeout)
                instances.splice(instanceIndex,1)
            }
            else{
                console.log('Instance not found, cannot delete')
            }
        }
        else {
            console.log('There are no Instances on websocket')
        }
    }
    else {
        console.log('WebSocket not found on intervals')
    }
}

const processStopServiceConfig = async (serviceConfig: ServiceConfig, webSocket: WebSocket) => {
    switch (serviceConfig.channel) {
        case ServiceConfigChannelEnum.LOG:
            var stream=websocketLogStreams.get(webSocket)
            if (stream) {
                stream.destroy()
            }
            else {
                console.log('LogStream not found')
            }
            sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, serviceConfig, 'Log service stopped')
            break;
        case ServiceConfigChannelEnum.METRICS:
            removeMetricsInterval(webSocket,serviceConfig.instance)
            sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, serviceConfig, 'Metrics service stopped')
            break
        default:
            console.log('Invalid channel on service stop')
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
    if (!serviceConfig.group) serviceConfig.group=serviceConfig.set  // transitional
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
                    processStopServiceConfig(serviceConfig, webSocket)
                    break
                case ServiceConfigChannelEnum.METRICS:
                    processStopServiceConfig(serviceConfig, webSocket)
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
        var instances=websocketIntervals.get(ws)
        if (instances) {
            for (var i=0;i<instances.length;i++) {
                console.log(`Interval for instance ${instances[i].id} has been removed`)
                removeMetricsInterval(ws,instances[i].id)
            }
        }
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
  var ma:MetricsApi = new MetricsApi(ClusterData.metrics)
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
            var sat = new ServiceAccountToken(coreApi, kwirthData.namespace)
            var saToken= await sat.getToken('kwirth-sa',kwirthData.namespace)
            if (saToken) {
                console.log(saToken)
                await new ClusterData(coreApi,saToken).init()
            }
            else {
                console.log('Could not get sa token, metrics will not be available')
            }
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
