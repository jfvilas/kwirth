//import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod, LogOptions } from '@kubernetes/client-node';
import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch } from '@kubernetes/client-node';
import { ConfigApi } from './api/ConfigApi';
import { Secrets } from './tools/Secrets';
import { ConfigMaps } from './tools/ConfigMaps';
import { VERSION } from './version';

// HTTP server for serving front, api and websockets
import { StoreApi } from './api/StoreApi';
import { UserApi } from './api/UserApi';
import { ApiKeyApi } from './api/ApiKeyApi';
import { LoginApi } from './api/LoginApi';

// HTTP server & websockets
import WebSocket from 'ws';
import { OperateApi } from './api/OperateApi';
import { ManageKwirthApi } from './api/ManageKwirth';
import { LogConfig } from './model/LogConfig';
import { ManageClusterApi } from './api/ManageClusterApi';
import { KwirthData } from './model/KwirthData';
import { getScopeLevel, parseResource } from './tools/AuthorizationManagement';

const stream = require('stream');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser')
const requestIp = require ('request-ip');
const PORT = 3883;
const buffer:Map<WebSocket,string>= new Map();

// Kubernetes API access
const kc = new KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(CoreV1Api);
const appsApi = kc.makeApiClient(AppsV1Api);
const k8sLog = new Log(kc);

var secrets:Secrets;
var configMaps:ConfigMaps;
const rootPath = process.env.KWIRTH_ROOTPATH || '';

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
    return { clusterName: 'inCluster', namespace: pod.metadata.namespace, deployment:depName, inCluster:true };
  }
  else {
    // this namespace will be used to access secrets and configmaps
    return { clusterName: 'inCluster', namespace:'default', deployment:'', inCluster:false };
  }
}

// split a block of stdout into several lines and send them
const sendLines = (ws:WebSocket, event:any, source:string) => {
  const logLines = source.split('\n');
  for (var line of logLines) {
    if (line!=='') {
      event.text=line;
      ws.send(JSON.stringify(event));    
    }
  }
}

// get pod logs
const getPodLog = async (namespace:string, podName:string, containerName:string, ws:any, config:LogConfig) => {
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
      var event:any = {namespace:namespace, podName:podName};
      sendLines(ws,event,text);
    });

    // logStream.on('data', (chunk:any) => {
    //   var text=chunk.toString('utf8');
    //   var event:any = {namespace:namespace, podName:podName};
    //   event.text=text;
    //   ws.send(JSON.stringify(event));
    // });
    
    /**
     * Follow the log stream of the pod. Defaults to false.
    follow?: boolean;
     * If set, the number of bytes to read from the server before terminating the log output. This may not display a
     * complete final line of logging, and may return slightly more or slightly less than the specified limit.
    limitBytes?: number;
     * If true, then the output is pretty printed.
    pretty?: boolean;
     * Return previous terminated container logs. Defaults to false.
    previous?: boolean;
     * A relative time in seconds before the current time from which to show logs. If this value precedes the time a
     * pod was started, only logs since the pod start will be returned. If this value is in the future, no logs will
     * be returned. Only one of sinceSeconds or sinceTime may be specified.
    sinceSeconds?: number;
     * If set, the number of lines from the end of the logs to show. If not specified, logs are shown from the creation
     * of the container or sinceSeconds or sinceTime
    tailLines?: number;
     * If true, add an RFC3339 or RFC3339Nano timestamp at the beginning of every line of log output. Defaults to false.
    timestamps?: boolean;
    */
    var streamConfig:any={ 
      follow: true, 
      pretty: false, 
      timestamps:config.timestamp, 
    }
    streamConfig.previous=Boolean(config.previous);
    streamConfig.tailLines=config.maxMessages;
    await k8sLog.log(namespace, podName, containerName, logStream,  streamConfig );
  }
  catch (err:any) {
    console.error(err);
    //+++ decide what to do with errors on back: send them to front?
    //ws.send(`Error: ${err.message}`);
  }
};

// watch deployment pods
const watchPods = (apiPath:string, filter:any, ws:any, config:LogConfig) => {
  const watch = new Watch(kc);
  watch.watch(apiPath, filter, (type:string, obj:any) => {
    if (type === 'ADDED' || type === 'MODIFIED') {
      const podName = obj.metadata.name;
      const podNamespace = obj.metadata.namespace;
      console.log(`${type}: ${podNamespace}/${podName}`);
      switch(config.scope) {
        case 'cluster':
        case 'namespace':
        case 'set':
          getPodLog(podNamespace, podName, '', ws, config);
          break;
        case 'pod':
          for (var container of obj.spec.containers) {
            getPodLog(podNamespace, podName, container.name, ws, config);
          }
          break;
        case 'container':
          for (var container of obj.spec.containers) {
            if (container.name===config.container) {
              getPodLog(podNamespace, podName, container.name, ws, config);
            }
          }
          break;
      }
    }
    else if (type === 'DELETED') {
      console.log(`Pod deleted` );
      //+++ finish ws
    }},
    (err:any) => {
      console.error(err);
      ws.send(`Error: ${err.message}`);
    }
  );
};

const checkPermission = (config:LogConfig) => {
  var resource=parseResource(config.accessKey.resource);
  var haveLevel=getScopeLevel(resource.scope);
  var reqLevel=getScopeLevel(config.scope);
  console.log('Check levels:', haveLevel, '>', reqLevel, '?');
  //+++ check names requested
  return (haveLevel>=reqLevel);
}

// clients send requests to start receiving log
async function processClientMessage(message:string, ws:any) {

  const config = JSON.parse(message) as LogConfig;
  console.log(config);
  if (!config.accessKey) {
    console.error('No key received');
    ws.close();
    return;
  }

  if (!ApiKeyApi.apiKeys.some(apiKey => apiKey.accessKey.toString()===config.accessKey.toString())) {
    console.error(`Invalid API key: ${config.accessKey.toString()}`);
    ws.close();
    return;
  }

  var accepted=checkPermission(config);
  if (accepted) {
    console.log('Access accepted');
  }
  else {
    console.error('Access denied');
    console.log(config);
    ws.close();
    return;
  }

  switch (config.scope) {
    case 'cluster':
      watchPods(`/api/v1/pods`, {}, ws, config);
      break;
    case 'namespace':
      watchPods(`/api/v1/namespaces/${config.namespace}/pods`, {}, ws, config);
      break;
    case 'pod':
    case 'container':
    case 'set':
      var res:any;
      switch (config.setType) {
        case'replica':
          res=await appsApi.readNamespacedReplicaSet(config.setName, config.namespace);
          break;
        case'daemon':
          res=await appsApi.readNamespacedDaemonSet(config.setName, config.namespace);
          break;
        case'stateful':
          res=await appsApi.readNamespacedStatefulSet(config.setName, config.namespace);
          break;
      }
      const matchLabels = res.body.spec?.selector?.matchLabels;
      if (matchLabels) {
        var labelSelector='';
        const matchLabels = res.body.spec?.selector?.matchLabels;
        if (matchLabels) {
            labelSelector = Object.entries(matchLabels).map(([key, value]) => `${key}=${value}`).join(',');
            console.log(labelSelector);
            watchPods(`/api/v1/namespaces/${config.namespace}/pods`, { labelSelector:labelSelector }, ws, config);
        }
        else {
          //+++ errro, notfound
        }
      }
      break;
  }
}

// HTTP server
const app = express();
app.use(bodyParser.json());
app.use(cors());
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws:any, req) => {
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

  // serve config API
  var va:ConfigApi = new ConfigApi(kc, coreApi, appsApi, kwrithData);
  app.use(`${rootPath}/config`, va.route);
  var ka:ApiKeyApi = new ApiKeyApi(configMaps);
  app.use(`${rootPath}/key`, ka.route);
  var sa:StoreApi = new StoreApi(configMaps);
  app.use(`${rootPath}/store`, sa.route);
  var ua:UserApi = new UserApi(secrets);
  app.use(`${rootPath}/user`, ua.route);
  var la:LoginApi = new LoginApi(secrets, configMaps);
  app.use(`${rootPath}/login`, la.route);
  var oa:OperateApi = new OperateApi(appsApi);
  app.use(`${rootPath}/manage`, oa.route);
  var mk:ManageKwirthApi = new ManageKwirthApi(appsApi, kwrithData);
  app.use(`${rootPath}/managekwirth`, mk.route);
  var mc:ManageClusterApi = new ManageClusterApi(coreApi, appsApi);
  app.use(`${rootPath}/managecluster`, mc.route);

  // obtain remote ip
  app.use(requestIp.mw())
  
  // listen
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Context being used: ${kc.currentContext}`);
    if (kwrithData.inCluster)
      console.log(`Running inside cluster`);
    else
      console.log(`Cluster name (according to kubeconfig context): ${kc.getCluster(kc.currentContext)?.name}`);
    console.log(`KWI1500I Control is being given to KWirth`);
  });
}

////////////////////////////////////////////////////////////// START /////////////////////////////////////////////////////////
console.log(`KWirth version is ${VERSION}`);

// serve front application
console.log(`SPA is available at: ${rootPath}/front`)
app.get(`/`, (req:any,res:any) => { res.redirect(`${rootPath}`) });
app.get(`${rootPath}`, (req:any,res:any) => { res.redirect(`${rootPath}/front`) });
app.use(`${rootPath}/front`, express.static('./dist/front'))

getMyKubernetesData()
  .then ( (kwirthData) => {
    console.log('Detected own namespace: '+kwirthData.namespace);
    console.log('Detected own deployment: '+kwirthData.deployment);
    launch (kwirthData);
  })
  .catch ( (err) => {
    console.log('Cannot get namespace, using "default"');
    launch ({
      clusterName: 'error-starting',
      inCluster: false,
      namespace: 'default',
      deployment: ''
    });
  });
