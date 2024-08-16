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
import { ManageApi } from './api/ManageApi';
import { ManageKwirth } from './api/ManageKwirth';
//import { setDefaultAutoSelectFamily } from 'net';
import { LogConfig } from './model/LogConfig';
import { ManageCluster } from './api/ManageCluster';
const stream = require('stream');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser')
const PORT = 3883;

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
const getMyKubernetesData = async () => {
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
    return { namespace: pod.metadata.namespace, deployment:depName};
  }
  else
    return { namespace:'default', deployment:'' };
}

//+++ add options to asterisk lines containing a specific text (like 'password', 'pw', etc...)

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
      var text=chunk.toString('utf8');
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
    // if (config.previous) streamConfig.previous=config.previous;
    // if (config.maxMessages) streamConfig.tailLines=config.maxMessages;
    streamConfig.previous=Boolean(config.previous);
    streamConfig.tailLines=config.maxMessages;
    //streamConfig.previous=false;
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
        case 'deployment':
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

// clients send requests to start receiving log
async function processClientMessage(message:string, ws:any) {
  // {"scope":"namespace", "namespace":"default","set":"ubuntu3", "timestamp":true}

  //const { scope, namespace, deploymentName, timestamp, previous } = JSON.parse(message);
  const config = JSON.parse(message) as LogConfig;
  console.log('Received key: '+config.key);
  if (!config.key) {
    console.error('No key received');
    ws.close();
    return;
  }
  if (!ApiKeyApi.apiKeys.some(ak => ak.key===config.key)) {
    console.error(`ERROR: Invalid API key: ${config.key}`);
    ws.close();
    return;
  }

  console.log('RECEIVED CONFIG:'+JSON.stringify(config));
  // if (config.key.startsWith('resource|')) {
  //   var keyParts:string[]=config.key.split('|');
  //   var type=keyParts[0];
  //   var resource=keyParts[1];
  //   var guid=keyParts[2];
  //   // cluster:scope:namespace:set:pod:container
  //   var resParts:string[]=resource.split(':');
  //   config.scope=resParts[1];
  //   config.namespace=resParts[2];
  //   config.setName=resParts[3];
  //   config.pod=resParts[4];
  //   config.container=resParts[5];
  // }
  
  switch (config.scope) {
    case 'cluster':
      watchPods(`/api/v1/pods`, {}, ws, config);
      break;
    case 'namespace':
      watchPods(`/api/v1/namespaces/${config.namespace}/pods`, {}, ws, config);
      break;
    case 'pod':
    case 'container':
    case 'deployment':
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
  var key=req.url?.replace('/?key=','');
  console.log('Client connected: '+key);

  ws.on('message', (message:string) => {
    processClientMessage(message, ws);
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

const launch = (myNamespace:string, myDeployment:string) => {
  secrets = new Secrets(coreApi, myNamespace);
  configMaps = new ConfigMaps(coreApi, myNamespace);

  // serve config API
  var va:ConfigApi = new ConfigApi(kc, coreApi, appsApi);
  app.use(`${rootPath}/config`, va.route);
  var ka:ApiKeyApi = new ApiKeyApi(configMaps);
  app.use(`${rootPath}/key`, ka.route);
  var sa:StoreApi = new StoreApi(configMaps);
  app.use(`${rootPath}/store`, sa.route);
  var ua:UserApi = new UserApi(secrets);
  app.use(`${rootPath}/user`, ua.route);
  var la:LoginApi = new LoginApi(secrets);
  app.use(`${rootPath}/login`, la.route);
  var ma:ManageApi = new ManageApi(appsApi);
  app.use(`${rootPath}/manage`, ma.route);
  var mk:ManageKwirth = new ManageKwirth(appsApi, myNamespace, myDeployment);
  app.use(`${rootPath}/managekwirth`, mk.route);
  var mc:ManageCluster = new ManageCluster(coreApi, appsApi);
  app.use(`${rootPath}/managecluster`, mc.route);

  // listen
  server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Context being used: ${kc.currentContext}`);
    console.log(`Cluster name: ${kc.getCluster(kc.currentContext)?.name}`);
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
  launch (kwirthData.namespace, kwirthData.deployment);
})
.catch ( (err) => {
  console.log('Cannot get namespace, using "default"');
  launch ('default','');
});
