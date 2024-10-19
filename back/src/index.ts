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
import WebSocket from 'ws';
import { ManageKwirthApi } from './api/ManageKwirthApi'
import { LogConfig, MetricsConfigModeEnum } from '@jfvilas/kwirth-common'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getServiceScopeLevel } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'
import { accessKeyDeserialize, accessKeySerialize, parseResource, ResourceIdentifier, KwirthData } from '@jfvilas/kwirth-common'
import { StreamMessage, MetricsMessage } from '@jfvilas/kwirth-common'

import express, { Request, Response} from 'express';
import { ServiceConfigTypeEnum, ServiceConfig } from '@jfvilas/kwirth-common'
import { MetricsConfig } from '@jfvilas/kwirth-common'
import { ClusterData } from './tools/ClusterData'
import { ServiceAccountToken } from './tools/ServiceAccountToken'
import { Metrics } from './tools/Metrics'
import { MetricsApi } from './api/MetricsApi'
const stream = require('stream')
const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883
const buffer:Map<WebSocket,string>= new Map()
const websocketIntervals:Map<WebSocket, NodeJS.Timeout[]>= new Map()

// Kubernetes API access
const kc = new KubeConfig()
kc.loadFromDefault()
const coreApi = kc.makeApiClient(CoreV1Api)
const appsApi = kc.makeApiClient(AppsV1Api)
const customApi = kc.makeApiClient(CustomObjectsApi);
const k8sLog = new Log(kc)

var secrets:Secrets
var configMaps:ConfigMaps
var metrics:Metrics
const rootPath = process.env.KWIRTH_ROOTPATH || ''

// get the namespace where Kwirth is running on
const getMyKubernetesData = async ():Promise<KwirthData> => {
    var podName=process.env.HOSTNAME;
    var depName='';
    const pods = await coreApi.listPodForAllNamespaces();
    const pod = pods.body.items.find(p => p.metadata?.name === podName);  
    if (pod && pod.metadata?.namespace) {

        if (pod.metadata.ownerReferences) {
            for (const owner of pod.metadata.ownerReferences) {
                if (owner.kind === 'ReplicaSet') {
                    const rs = await appsApi.readNamespacedReplicaSet(owner.name, pod.metadata.namespace);
                    if (rs.body.metadata && rs.body.metadata.ownerReferences) {
                        for (const rsOwner of rs.body.metadata.ownerReferences) {
                            if (rsOwner.kind === 'Deployment') depName=rsOwner.name;
                        }
                    }
                }
            }
        }
        return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true, version:VERSION }
    }
    else {
        // this namespace will be used to access secrets and configmaps
        return { clusterName: 'inCluster', namespace:'default', deployment:'', inCluster:false, version:VERSION }
    }
}

// split a block of stdout into several lines and send them over the websocket
const sendLogLines = (ws:WebSocket, namespace:string, podName:string, source:string) => {
    const logLines = source.split('\n')
    var msg:StreamMessage = {
        namespace,
        podName,
        type: 'log',
        text: ''
    }
    for (var line of logLines) {
        if (line!=='') {
            msg.text=line
            ws.send(JSON.stringify(msg))   
        }
    }
}

// sends an informatory message over the websocket
const sendLogInfo = (ws:WebSocket, text:string) => {
    var msg:StreamMessage= {
        type: 'info',
        text: text,
        timestamp: new Date()
    }
    ws.send(JSON.stringify(msg))
}

// sends an error message over the websocket and optionally closes the websocket
const sendError = (ws:WebSocket, text:string, close:boolean) => {
    var msg:StreamMessage= {
        type: 'error',
        text: text,
        timestamp: new Date()
    }
    ws.send(JSON.stringify(msg))
    if (close) ws.close()
}

// get pods logs
const getPodLog = async (namespace:string, podName:string, containerName:string, ws:WebSocket, logConfig:LogConfig) => {
    try {
        const logStream = new stream.PassThrough()
        logStream.on('data', (chunk:any) => {
            var text:string=chunk.toString('utf8')
            if (buffer.get(ws)!==undefined) {
                // if we have some text from a previous incompleted chunk, we prepend it now
                text=buffer.get(ws)+text;
                buffer.delete(ws);
            }
            if (!text.endsWith('\n')) {
                //incomplete chunk
                var i=text.lastIndexOf('\n')
                var next=text.substring(i)
                buffer.set(ws,next)
                text=text.substring(0,i)
            }
            sendLogLines(ws, namespace, podName, text)
        });

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
        console.log(err);
        sendError(ws,JSON.stringify(err), false);
    }
}

// get pods metrics
const getPodMetrics = async (namespace:string, podName:string, containerName:string, ws:WebSocket, metricsConfig:MetricsConfig) => {
    try {
        console.log(metricsConfig.mode)
        switch (metricsConfig.mode) {
            case MetricsConfigModeEnum.SNAPSHOT:
                break
            case MetricsConfigModeEnum.STREAM:
                var timeout = setInterval( async () => {
                    var metricsMessage:MetricsMessage = {
                        metrics: [],
                        value: [],
                        type: 'metrics',
                        namespace,
                        podName,
                    }
                    var sampledMetrics  = await metrics.getMetrics(Array.from(ClusterData.nodes.values())[0])
        
                    metricsMessage.metrics = ['container_fs_writes_total',
                        'container_fs_reads_total',
                        'container_cpu_usage_seconds_total',
                        'container_memory_usage_bytes',
                        'container_network_receive_bytes_total',
                        'container_network_transmit_bytes_total'
                    ]
                    metricsMessage.value = [ metrics.extractMetrics(sampledMetrics, 'container_fs_writes_total', 'kwirth','kwirth'),
                        metrics.extractMetrics(sampledMetrics, 'container_fs_reads_total', 'kwirth','kwirth'),
                        metrics.extractMetrics(sampledMetrics, 'container_cpu_usage_seconds_total', 'kwirth','kwirth'),
                        metrics.extractMetrics(sampledMetrics, 'container_memory_usage_bytes', 'kwirth','kwirth'),
                        metrics.extractMetrics(sampledMetrics, 'container_network_receive_bytes_total', 'kwirth','kwirth'),
                        metrics.extractMetrics(sampledMetrics, 'container_network_transmit_bytes_total', 'kwirth','kwirth')
                    ]
                    ws.send(JSON.stringify(metricsMessage))
        
                }, (metricsConfig.interval?metricsConfig.interval:60)*1000)

                if (!websocketIntervals.has(ws)) websocketIntervals.set(ws, [])
                var metricsIntervals=websocketIntervals.get(ws)
                metricsIntervals?.push(timeout)
                
                break
            default:
                sendError(ws,`Invalid metricsConfig mode: ${metricsConfig.mode}`,false)
        }
    }
    catch (err) {
        console.log(err);
        sendError(ws,JSON.stringify(err), false);
    }
}

const getPodService = (podNamespace:string, podName:string, containerName:string, ws:WebSocket, serviceConfig:ServiceConfig) => {
    console.log('getPodService: '+serviceConfig.type)
    switch(serviceConfig.type) {
        case ServiceConfigTypeEnum.LOG:
            getPodLog(podNamespace, podName, containerName, ws, serviceConfig as LogConfig)
            break
        case ServiceConfigTypeEnum.METRICS:
            getPodMetrics(podNamespace, podName, containerName, ws, serviceConfig as MetricsConfig)
            break
    }
}

const watchPods = (apiPath:string, filter:any, ws:WebSocket, serviceConfig:ServiceConfig) => {
    const watch = new Watch(kc);

    watch.watch(apiPath, filter, (eventType:string, obj:any) => {
        const podName = obj.metadata.name;
        const podNamespace = obj.metadata.namespace;
        if (eventType === 'ADDED' || eventType === 'MODIFIED') {
            console.log(`${eventType}: ${podNamespace}/${podName}`);
            sendLogInfo(ws, `Pod ${eventType}: ${podNamespace}/${podName}`);

            for (var container of obj.spec.containers) {
                if (serviceConfig.view==='container') {
                    if (container.name===serviceConfig.container) 
                        getPodService(podNamespace, podName, container.name, ws, serviceConfig);
                    else {
                        sendError(ws,`Requested container not valid: ${container.name}`, false);
                    }
                }
                else {
                    getPodService(podNamespace, podName, container.name, ws, serviceConfig);
                }
            }
        }
        else if (eventType === 'DELETED') {
            console.log(`Pod deleted` );
            sendLogInfo(ws, `Pod DELETED: ${podNamespace}/${podName}`);
        }
    },
    (err) => {
        console.log(err);
        sendError(ws,JSON.stringify(err), true);
    })
}

// validates the permission level requested qith the one stated in the accessKey
const checkPermissionLevel = (sconfig:ServiceConfig) => {
    var resource=parseResource(accessKeyDeserialize(sconfig.accessKey).resource);
    var haveLevel=getServiceScopeLevel(sconfig.type, resource.scope);
    var requiredLevel=getServiceScopeLevel(sconfig.type, sconfig.scope);
    console.log(`Check levels: have ${resource.scope}(${haveLevel}) >= required ${sconfig.scope}(${requiredLevel}) ? ${haveLevel>=requiredLevel}`);
    return (haveLevel>=requiredLevel);
}

// creates a list of pods that the requestor has access to
const getSelectedPods = async (resId:ResourceIdentifier, validNamespaces:string[], validPodNames:string[]) => {
    var allPods=await coreApi.listPodForAllNamespaces(); //+++ can be optimized if config.namespace is specified
    var selectedPods:V1Pod[]=[];
    for (var pod of allPods.body.items) {
        var valid=true;
        if (resId.namespace!=='') valid &&= validNamespaces.includes(pod.metadata?.namespace!);
        //+++ other filters pending implementation
        if (resId.pod) valid &&= validPodNames.includes(pod.metadata?.name!);
        if (valid) {
            selectedPods.push(pod);
        }
        else {
            //console.log(`Access denied: access to ${pod.metadata?.namespace}/${pod.metadata?.name} has not been granted.`);
        }
    }
    return selectedPods;
}

const processLogConfig = async (logConfig: LogConfig, webSocket: WebSocket, resourceId: ResourceIdentifier, validNamespaces: string[], validPodNames: string[]) => {
    switch (logConfig.scope) {
        case 'view':
        case 'filter':
            if (!logConfig.view) logConfig.view='pod';
            if (getServiceScopeLevel(logConfig.type, resourceId.scope) < getServiceScopeLevel(logConfig.type, logConfig.scope)) {
                sendError(webSocket, `Access denied: scope 'filter'/'view' not allowed`, true);
                return;
            }
            var selectedPods=await getSelectedPods(resourceId, validNamespaces, validPodNames);
            if (selectedPods.length===0) {
                sendError(webSocket,`Access denied: there are no filters that match requested log config`, true);
            }
            else {
                switch (logConfig.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, logConfig);
                        break;
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, {}, webSocket, logConfig);
                        break;
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, logConfig.namespace, logConfig.group)).labelSelector;
                        watchPods(`/api/v1/namespaces/${logConfig.namespace}/pods`, { labelSelector }, webSocket, logConfig);
                        break;
                    case 'pod':
                    case 'container':
                        var validPod=selectedPods.find(p => p.metadata?.name === logConfig.pod)
                        if (validPod) {
                            var podLogConfig:LogConfig={
                                type: ServiceConfigTypeEnum.LOG,
                                accessKey: '',
                                timestamp: logConfig.timestamp,
                                previous: logConfig.previous,
                                maxMessages: logConfig.maxMessages,
                                scope: logConfig.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: logConfig.view==='container'? logConfig.container:'',
                                view: logConfig.view
                            }

                            var metadataLabels = validPod.metadata?.labels;
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',');
                                console.log(`Label selector: ${labelSelector}`);
                                watchPods(`/api/v1/namespaces/${podLogConfig.namespace}/pods`, { labelSelector }, webSocket, podLogConfig);
                            }
                            else {
                                sendError(webSocket, `Access denied: cannot get metadata labels`, true);
                            }
                        }
                        else {
                            sendError(webSocket, `Access denied: your accesskey has no access to pod '${logConfig.pod}'`, true);
                        }
                        break;
                    default:
                        sendError(webSocket, `Access denied: invalid view '${logConfig.view}'`, true);
                        break;
                }
            }
            break;
        default:
            sendError(webSocket, `Access denied: invalid scope '${logConfig.scope}'`, true);
            return;
    }
}

const processMetricsConfig = async (metricsConfig: MetricsConfig, webSocket: WebSocket, resourceId: ResourceIdentifier, validNamespaces: string[], validPodNames: string[]) => {
    switch (metricsConfig.scope) {
        case 'snapshot':
        case 'stream':
            if (getServiceScopeLevel(metricsConfig.type, resourceId.scope)<getServiceScopeLevel(metricsConfig.type, metricsConfig.scope)) {
                sendError(webSocket, `Access denied: scope '${metricsConfig.scope}' not allowed`, true)
                return
            }
            var selectedPods=await getSelectedPods(resourceId, validNamespaces, validPodNames)
            if (selectedPods.length===0) {
                sendError(webSocket,`Access denied: there are no filters that match requested metrics config`, true)
            }
            else {
                switch (metricsConfig.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, metricsConfig)
                        break;
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, {}, webSocket, metricsConfig)
                        break;
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, metricsConfig.namespace, metricsConfig.group)).labelSelector
                        watchPods(`/api/v1/namespaces/${metricsConfig.namespace}/pods`, { labelSelector }, webSocket, metricsConfig)
                        break;
                    case 'pod':
                    case 'container':
                        var validPod=selectedPods.find(p => p.metadata?.name === metricsConfig.pod)
                        if (validPod) {
                            var podMetricsConfig:MetricsConfig={
                                type: ServiceConfigTypeEnum.LOG,
                                accessKey: '',
                                interval: 60,
                                scope: metricsConfig.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: metricsConfig.view === 'container' ? metricsConfig.container : '',
                                view: metricsConfig.view,
                                mode: MetricsConfigModeEnum[metricsConfig.scope as keyof typeof MetricsConfigModeEnum],
                                metrics: metricsConfig.metrics
                            }

                            var metadataLabels = validPod.metadata?.labels
                            if (metadataLabels) {
                                var labelSelector = Object.entries(metadataLabels).map(([key, value]) => `${key}=${value}`).join(',')
                                console.log(`Label selector: ${labelSelector}`)
                                watchPods(`/api/v1/namespaces/${podMetricsConfig.namespace}/pods`, { labelSelector }, webSocket, podMetricsConfig)
                            }
                            else {
                                sendError(webSocket, `Access denied: cannot get metadata labels`, true)
                            }
                        }
                        else {
                            sendError(webSocket, `Access denied: your accesskey has no access to pod '${metricsConfig.pod}'`, true)
                        }
                        break;
                    default:
                        sendError(webSocket, `Access denied: invalid view '${metricsConfig.view}'`, true)
                        break
                }
            }
            break
        default:
            sendError(webSocket, `Access denied: invalid scope '${metricsConfig.scope}'`, true)
            return
    }
}

// clients send requests to start receiving log
const processClientMessage = async (message:string, webSocket:WebSocket) => {
    const serviceConfig = JSON.parse(message) as ServiceConfig
    if (!serviceConfig.group) serviceConfig.group=serviceConfig.set
    if (!serviceConfig.accessKey) {
        sendError(webSocket,'No key received', true)
        return
    }
    if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===serviceConfig.accessKey)) {
        sendError(webSocket,`Invalid API key: ${serviceConfig.accessKey}`, true);
        return;
    }
    console.log(serviceConfig)
    var accepted=checkPermissionLevel(serviceConfig)
    if (accepted) {
        console.log('Access accepted')
    }
    else {
        sendError(webSocket, 'Access denied: permission denied', true)
        return;
    }
  
    var resource=parseResource(accessKeyDeserialize(serviceConfig.accessKey).resource)

    var allowedNamespaces=resource.namespace.split(',').filter(ns => ns!=='')
    var requestedNamespaces=serviceConfig.namespace.split(',').filter(ns => ns!=='')
    var validNamespaces=requestedNamespaces.filter(ns => allowedNamespaces.includes(ns))

    var allowedPods=resource.pod.split(',').filter(podName => podName!=='')
    var requestedPods=serviceConfig.pod.split(',').filter(podName => podName!=='')
    var validPodNames=requestedPods.filter(podName => allowedPods.includes(podName))

    //+++ transitional
    if (!serviceConfig.type) serviceConfig.type=ServiceConfigTypeEnum.LOG;

    switch (serviceConfig.type) {
        case ServiceConfigTypeEnum.LOG:
            processLogConfig(serviceConfig as LogConfig, webSocket, resource, validNamespaces, validPodNames)
            break;
        case ServiceConfigTypeEnum.METRICS:
            processMetricsConfig(serviceConfig as MetricsConfig, webSocket, resource, validNamespaces, validPodNames)
            break;
        default:
            sendError(webSocket, `Invalid ServiceConfig type: ${serviceConfig.type}`, true);
            break;
    }
}

// HTTP server
const app = express();
app.use(bodyParser.json());
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws:WebSocket, req) => {
  console.log('Client connected');

  ws.on('message', (message:string) => {
    processClientMessage(message, ws);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const launch = (kwrithData: KwirthData) => {
  secrets = new Secrets(coreApi, kwrithData.namespace);
  configMaps = new ConfigMaps(coreApi, kwrithData.namespace);

  // serve front
  console.log(`SPA is available at: ${rootPath}/front`)
  app.get(`/`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) });

  app.get(`${rootPath}`, (req:Request,res:Response) => { res.redirect(`${rootPath}/front`) });
  app.use(`${rootPath}/front`, express.static('./dist/front'))

  // serve config API
  var va:ConfigApi = new ConfigApi(coreApi, appsApi, kwrithData)
  app.use(`${rootPath}/config`, va.route)
  var ka:ApiKeyApi = new ApiKeyApi(configMaps)
  app.use(`${rootPath}/key`, ka.route)
  var sa:StoreApi = new StoreApi(configMaps)
  app.use(`${rootPath}/store`, sa.route)
  var ua:UserApi = new UserApi(secrets)
  app.use(`${rootPath}/user`, ua.route)
  var la:LoginApi = new LoginApi(secrets, configMaps)
  app.use(`${rootPath}/login`, la.route)
  var mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, kwrithData)
  app.use(`${rootPath}/managekwirth`, mk.route)
  var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi)
  app.use(`${rootPath}/managecluster`, mc.route)
  var ma:MetricsApi = new MetricsApi(metrics)
  app.use(`${rootPath}/metrics`, ma.route)

  // obtain remote ip
  app.use(requestIp.mw())
  
  // listen
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Context being used: ${kc.currentContext}`);
    if (kwrithData.inCluster) {
        console.log(`Kwirth is running INSIDE cluster`);
    }
    else {
        console.log(`Cluster name (according to kubeconfig context): ${kc.getCluster(kc.currentContext)?.name}`);
        console.log(`Kwirth is NOT running on a cluster`);
    }
    console.log(`KWI1500I Control is being given to Kwirth`);
  });
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`Kwirth version is ${VERSION}`);
console.log(`Kwirth started at ${new Date().toISOString()}`);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// serve front application

getMyKubernetesData()
    .then ( async (kwirthData) => {
        try {
            await new ClusterData(coreApi).init();
            var token = await new ServiceAccountToken(coreApi, kwirthData.namespace).getToken('kwirth-sa',kwirthData.namespace)
            metrics = new Metrics(customApi,token!)
        }
        catch (err){
            console.log(err)
        }
        console.log('Detected own namespace: '+kwirthData.namespace)
        console.log('Detected own deployment: '+kwirthData.deployment)
        console.log(metrics)
        launch(kwirthData)
    })
    .catch ( (err) => {
        console.log('Cannot get namespace, using "default"');
        launch ({
            version: VERSION,
            clusterName: 'error-starting',
            inCluster: false,
            namespace: 'default',
            deployment: ''
        });
    });
