import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod, LogOptions } from '@kubernetes/client-node';
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

// split a block of stdout in lines and send them
const sendLines = (ws:WebSocket, event:any, source:string) => {
  const logLines = source.split('\n');
  for (var l of logLines) {
    if (l!=='') {
      event.text=l;
      ws.send(JSON.stringify(event));    
    }
  }
}

// get pod logs
const getPodLog = async (namespace:string, podName:string, containerName:string, ws:any, timestamp:boolean) => {
  try {
    const logStream = new stream.PassThrough();
    logStream.on('data', (chunk:any) => {
      var text=chunk.toString('utf8');
      var event:any = {namespace:namespace, podName:podName};
      //+++ kubernetes can provide timestamps if indicated on LogOptions object
      if (timestamp) event.timestamp=new Date();
      sendLines(ws,event,text);
    });
    
    //+++ all these options should be available to end users

    /**
     * Follow the log stream of the pod. Defaults to false.
     *
    follow?: boolean;
    /**
     * If set, the number of bytes to read from the server before terminating the log output. This may not display a
     * complete final line of logging, and may return slightly more or slightly less than the specified limit.
     *
    limitBytes?: number;
    /**
     * If true, then the output is pretty printed.
     *
    pretty?: boolean;
    /**
     * Return previous terminated container logs. Defaults to false.
     *
    previous?: boolean;
    /**
     * A relative time in seconds before the current time from which to show logs. If this value precedes the time a
     * pod was started, only logs since the pod start will be returned. If this value is in the future, no logs will
     * be returned. Only one of sinceSeconds or sinceTime may be specified.
     *
    sinceSeconds?: number;
    /**
     * If set, the number of lines from the end of the logs to show. If not specified, logs are shown from the creation
     * of the container or sinceSeconds or sinceTime
     *
    tailLines?: number;
    /**
     * If true, add an RFC3339 or RFC3339Nano timestamp at the beginning of every line of log output. Defaults to false.
     *
    timestamps?: boolean;
    */
    await k8sLog.log(namespace, podName, '', logStream,  { follow: true, pretty: false  });
  }
  catch (err:any) {
    console.error(err);
    //+++ decide what to do with errors on back: send them to front?
    //ws.send(`Error: ${err.message}`);
  }
};

// watch deployment pods
const watchPods = (apiPath:string, filter:any, ws:any, timestamp:boolean) => {
  const watch = new Watch(kc);
  watch.watch(
    apiPath, filter, (type:string, obj:any) => {
      if (type === 'ADDED' || type === 'MODIFIED') {
        const podName = obj.metadata.name;
        const podNamespace = obj.metadata.namespace;
        console.log(`${type}: ${podName}` );
        //+++ in the near future add options to log a specific container, now container name is ''
        getPodLog(podNamespace, podName, '', ws, timestamp);
      }
      else if (type === 'DELETED') {
        console.log(`Pod deleted` );
      }
    },
    (err:any) => {
      console.error(err);
      ws.send(`Error: ${err.message}`);
    }
  );
};

// clients send requests to start receiving log
function processClientMessage(message:string, ws:any) {
  // {"scope":"namespace", "namespace":"default","deploymentName":"ubuntu3", "timestamp":true}

  const { scope, namespace, deploymentName, timestamp } = JSON.parse(message);
  switch (scope) {
    case 'cluster':
      watchPods(`/api/v1/pods`, {}, ws, timestamp);
      break;
    case 'namespace':
      watchPods(`/api/v1/namespaces/${namespace}/pods`, {}, ws, timestamp);
      break;
    case 'deployment':
      watchPods(`/api/v1/namespaces/${namespace}/pods`, { labelSelector: `app=${deploymentName}` } , ws, timestamp);
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
  var la:UserApi = new LoginApi(secrets);
  app.use(`${rootPath}/login`, la.route);
  var ma:ManageApi = new ManageApi(appsApi);
  app.use(`${rootPath}/manage`, ma.route);
  var mk:ManageKwirth = new ManageKwirth(appsApi, myNamespace, myDeployment);
  app.use(`${rootPath}/managekwirth`, mk.route);


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
