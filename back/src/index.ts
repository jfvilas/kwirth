import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1Pod } from '@kubernetes/client-node';
import { ConfigApi } from './api/ConfigApi';
import { Secrets } from './tools/Secrets';
import { ConfigMaps } from './tools/ConfigMaps';
import { VERSION } from './version';

// HTTP server for serving front, api and websockets
import { StoreApi } from './api/StoreApi';
import { UserApi } from './api/UserApi';
import { KeyApi } from './api/KeyApi';
import { LoginApi } from './api/LoginApi';

// HTTP server & websockets
import WebSocket from 'ws';
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

// get the namespace where Kwirth is running on
const getMyNamespace = async () => {
  var podName=process.env.HOSTNAME;
  const pods = await coreApi.listPodForAllNamespaces();
  const pod = pods.body.items.find(p => p.metadata?.name === podName);
  if (pod && pod.metadata?.namespace) 
    return pod.metadata.namespace;
  else
    return 'default';
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
const getPodLog = async (namespace:string, podName:string, ws:any) => {
  try {
    const logStream = new stream.PassThrough();
    logStream.on('data', (chunk:any) => {
      var text=chunk.toString('utf8');
      var event={namespace:namespace, podName:podName}
      sendLines(ws,event,text);
    });
    await k8sLog.log(namespace, podName, '', logStream,  { follow: true, pretty: false });
  }
  catch (err:any) {
    console.error(err);
    //+++ decide what to do with errors on back: send them to front?
    //ws.send(`Error: ${err.message}`);
  }
};

// watch deployment pods
const watchPods = (apiPath:string, filter:any, ws:any) => {
  const watch = new Watch(kc);
  watch.watch(
    apiPath, filter, (type:string, obj:any) => {
      if (type === 'ADDED' || type === 'MODIFIED') {
        const podName = obj.metadata.name;
        const podNamespace = obj.metadata.namespace;
        console.log(`${type}: ${podName}` );
        getPodLog(podNamespace, podName, ws);
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


// async function getPodsInNamespace(namespace:string) {
//   try {
//       const res = await coreApi.listNamespacedPod(namespace);
//       return res.body.items;
//   }
//   catch (err) {
//       console.error('Error obteniendo pods:', err);
//       return [];
//   }
// }

// // Obtener y seguir los logs de todos los pods en el namespace
// async function getNamespaceLog(namespace:string, ws:WebSocket) {
//   const pods = await getPodsInNamespace(namespace) as V1Pod[];
//   for (var pod of pods) {
//     getPodLog(pod.metadata?.namespace!, pod.metadata?.name!,ws);
//   }
// }

// // watch deployment pods
// const watchNamespace = (namespace:string, ws:any) => {
//   const watch = new Watch(kc);

//   watch.watch(
//     `/api/v1/namespaces/${namespace}/pods`, {}, (type:string, obj:any) => {
//       if (type === 'ADDED' || type === 'MODIFIED') {
//         const podName = obj.metadata.name;
//         console.log(`${type}: ${podName}` );
//         getPodLog(namespace, podName, ws);
//       }
//       else if (type === 'DELETED') {
//         const podName = obj.metadata.name;
//         console.log(`${podName} deleted`);
//       }
//     },
//     (err:any) => {
//       console.error(err);
//       ws.send(`Error: ${err.message}`);
//     }
//   );
// };



// clients send requests to start receiving log
function processClientMessage(message:string, ws:any) {
  // {"scope":"namespace", "namespace":"default","deploymentName":"ubuntu3"}

  const { scope, namespace, deploymentName } = JSON.parse(message);
  switch (scope) {
    case 'cluster':
      watchPods(`/api/v1/pods`, {}, ws);
      break;
    case 'namespace':
      watchPods(`/api/v1/namespaces/${namespace}/pods`, {}, ws);
      break;
    case 'deployment':
      watchPods(`/api/v1/namespaces/${namespace}/pods`, { labelSelector: `app=${deploymentName}` } , ws);
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

// serve front application
app.get('/', (req:any,res:any) => { res.redirect('/front') });
app.use('/front', express.static('./dist/front'))



const launch = (myNamespace:string) => {
  secrets = new Secrets(coreApi, myNamespace);
  configMaps = new ConfigMaps(coreApi, myNamespace);

  // serve config API
  var va:ConfigApi = new ConfigApi(kc, coreApi, appsApi);
  app.use(`/config`, va.route);
  var ka:KeyApi = new KeyApi(configMaps);
  app.use(`/key`, ka.route);
  var sa:StoreApi = new StoreApi(configMaps);
  app.use(`/store`, sa.route);
  var ua:UserApi = new UserApi(secrets);
  app.use(`/user`, ua.route);
  var la:UserApi = new LoginApi(secrets);
  app.use(`/login`, la.route);


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

getMyNamespace()
.then ( (namespace) => {
  console.log('Detected own namespace: '+namespace);
  launch (namespace);
})
.catch ( (err) => {
  console.log('Cannot get namespace, using "default"');
  launch ('default');
});
