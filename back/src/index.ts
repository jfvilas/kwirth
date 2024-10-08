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
import WebSocket from 'ws';
import { ManageKwirthApi } from './api/ManageKwirthApi'
import { LogConfig } from './model/LogConfig'
import { ManageClusterApi } from './api/ManageClusterApi'
import { getScopeLevel } from './tools/AuthorizationManagement'
import { getPodsFromGroup } from './tools/KubernetesOperations'
import { accessKeyDeserialize, accessKeySerialize, parseResource, ResourceIdentifier, KwirthData } from '@jfvilas/kwirth-common'
import { StreamMessage } from '@jfvilas/kwirth-common'

import express, { Request, Response} from 'express';

const stream = require('stream')
//const express = require('express')
const http = require('http')
const cors = require('cors')
const bodyParser = require('body-parser')
const requestIp = require ('request-ip')
const PORT = 3883
const buffer:Map<WebSocket,string>= new Map()

// Kubernetes API access
const kc = new KubeConfig()
kc.loadFromDefault()
const coreApi = kc.makeApiClient(CoreV1Api)
const appsApi = kc.makeApiClient(AppsV1Api)
const k8sLog = new Log(kc)

var secrets:Secrets
var configMaps:ConfigMaps
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
const sendLines = (ws:WebSocket, namespace:string, podName:string, source:string) => {
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
const sendInfo = (ws:WebSocket, text:string) => {
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
const getPodLog = async (namespace:string, podName:string, containerName:string, ws:WebSocket, config:LogConfig) => {
    try {
        const logStream = new stream.PassThrough();
        logStream.on('data', (chunk:any) => {
            var text:string=chunk.toString('utf8');
            if (buffer.get(ws)!==undefined) {
                // if we have some text from a previous incompleted chunk, we prepend it now
                text=buffer.get(ws)+text;
                buffer.delete(ws);
            }
            if (!text.endsWith('\n')) {
                //incomplete chunk
                var i=text.lastIndexOf('\n');
                var next=text.substring(i);
                buffer.set(ws,next);
                text=text.substring(0,i);        
            }
            sendLines(ws,namespace, podName,text);
        });

        var streamConfig = { 
            follow: true, 
            pretty: false, 
            timestamps:config.timestamp,
            previous:Boolean(config.previous),
            tailLines:config.maxMessages
        }
        await k8sLog.log(namespace, podName, containerName, logStream,  streamConfig);
    }
    catch (err) {
        console.log(err);
        sendError(ws,JSON.stringify(err), false);
    }
};

// watch deployment pods
const watchPods = (apiPath:string, filter:any, ws:WebSocket, config:LogConfig) => {
    const watch = new Watch(kc);

    watch.watch(apiPath, filter, (eventType:string, obj:any) => {
        const podName = obj.metadata.name;
        const podNamespace = obj.metadata.namespace;
        if (eventType === 'ADDED' || eventType === 'MODIFIED') {
            console.log(`${eventType}: ${podNamespace}/${podName}`);
            sendInfo(ws, `Pod ${eventType}: ${podNamespace}/${podName}`);

            for (var container of obj.spec.containers) {
                if (config.view==='container') {
                    console.log('here');
                    if (container.name===config.container) getPodLog(podNamespace, podName, container.name, ws, config);
                }
                else {
                    getPodLog(podNamespace, podName, container.name, ws, config);
                }
            }
        }
        else if (eventType === 'DELETED') {
            console.log(`Pod deleted` );
            sendInfo(ws, `Pod DELETED: ${podNamespace}/${podName}`);
        }
    },
    (err) => {
        console.log(err);
        sendError(ws,JSON.stringify(err), true);
    })
}

// validates the permission level requested qith the one stated in the accessKey
const checkPermissionLevel = (config:LogConfig) => {
    var resource=parseResource(accessKeyDeserialize(config.accessKey).resource);
    var haveLevel=getScopeLevel(resource.scope);
    var requiredLevel=getScopeLevel(config.scope);
    console.log(`Check levels: have ${resource.scope}(${haveLevel}) >= required ${config.scope}(${requiredLevel}) ? ${haveLevel>=requiredLevel}`);
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

// clients send requests to start receiving log
const processClientMessage = async (message:string, webSocket:WebSocket) => {

    const config = JSON.parse(message) as LogConfig;
    if (!config.group) config.group=config.set;
    if (!config.accessKey) {
      sendError(webSocket,'No key received', true);
      return;
    }

    if (!ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===config.accessKey)) {
        sendError(webSocket,`Invalid API key: ${config.accessKey}`, true);
        return;
    }

    var accepted=checkPermissionLevel(config);
    if (accepted) {
        console.log('Access accepted');
    }
    else {
        sendError(webSocket, 'Access denied: permission denied', true);
        return;
    }

    var resource=parseResource(accessKeyDeserialize(config.accessKey).resource);

    var allowedNamespaces=resource.namespace.split(',').filter(ns => ns!=='');
    var requestedNamespaces=config.namespace.split(',').filter(ns => ns!=='');
    var validNamespaces=requestedNamespaces.filter(ns => allowedNamespaces.includes(ns));

    var allowedPods=resource.pod.split(',').filter(podName => podName!=='');
    var requestedPods=config.pod.split(',').filter(podName => podName!=='');
    var validPodNames=requestedPods.filter(podName => allowedPods.includes(podName));

    switch (config.scope) {
        case 'view':
        case 'filter':
            if (!config.view) config.view='pod';
            if (getScopeLevel(resource.scope)<getScopeLevel(config.scope)) {
                sendError(webSocket, `Access denied: scope 'filter'/'view' not allowed`, true);
                return;
            }
            var selectedPods=await getSelectedPods(resource, validNamespaces, validPodNames);
            if (selectedPods.length===0) {
                sendError(webSocket,`Access denied: there are no filters that match requested config`, true);
            }
            else {
                switch (config.view) {
                    case 'cluster':
                        watchPods(`/api/v1/pods`, {}, webSocket, config);
                        break;
                    case 'namespace':
                        watchPods(`/api/v1/namespaces/${config.namespace}/pods`, {}, webSocket, config);
                        break;
                    case 'group':
                        var labelSelector = (await getPodsFromGroup(coreApi, appsApi, config.namespace, config.group)).labelSelector;
                        watchPods(`/api/v1/namespaces/${config.namespace}/pods`, { labelSelector }, webSocket, config);
                        break;
                    case 'pod':
                    case 'container':
                        var validPod=selectedPods.find(p => p.metadata?.name === config.pod)
                        if (validPod) {
                            var podLogConfig:LogConfig={
                                accessKey: '',
                                timestamp: config.timestamp,
                                previous: config.previous,
                                maxMessages: config.maxMessages,
                                scope: config.scope,
                                namespace: validPod.metadata?.namespace!,
                                group: '',
                                set: '',
                                pod: validPod.metadata?.name!,
                                container: config.view==='container'? config.container:'',
                                view: config.view
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
                            sendError(webSocket, `Access denied: your accesskey has no access to pod '${config.pod}'`, true);
                        }
                        break;
                    default:
                        sendError(webSocket, `Access denied: invalid view '${config.view}'`, true);
                        break;
                }
            }
            break;
        default:
            sendError(webSocket, `Access denied: invalid scope '${config.scope}'`, true);
            return;
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
  var va:ConfigApi = new ConfigApi(coreApi, appsApi, kwrithData);
  app.use(`${rootPath}/config`, va.route);
  var ka:ApiKeyApi = new ApiKeyApi(configMaps);
  app.use(`${rootPath}/key`, ka.route);
  var sa:StoreApi = new StoreApi(configMaps);
  app.use(`${rootPath}/store`, sa.route);
  var ua:UserApi = new UserApi(secrets);
  app.use(`${rootPath}/user`, ua.route);
  var la:LoginApi = new LoginApi(secrets, configMaps);
  app.use(`${rootPath}/login`, la.route);
  var mk:ManageKwirthApi = new ManageKwirthApi(coreApi, appsApi, kwrithData);
  app.use(`${rootPath}/managekwirth`, mk.route);
  var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi);
  app.use(`${rootPath}/managecluster`, mc.route);

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

// serve front application

getMyKubernetesData()
    .then ( (kwirthData) => {
        console.log('Detected own namespace: '+kwirthData.namespace);
        console.log('Detected own deployment: '+kwirthData.deployment);
        launch (kwirthData);
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
