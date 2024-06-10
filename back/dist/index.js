"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_node_1 = require("@kubernetes/client-node");
const ConfigApi_1 = require("./api/ConfigApi");
const version_1 = require("./version");
const guid_1 = __importDefault(require("guid"));
// HTTP server for serving front, api and websockets
const ws_1 = __importDefault(require("ws"));
const stream = require('stream');
const express = require('express');
const http = require('http');
const cors = require('cors');
const bodyParser = require('body-parser');
const PORT = 8081;
// users
var admin = { user: 'admin', password: 'password', apiKey: 'not-created' };
// Kubernetes API access
const kc = new client_node_1.KubeConfig();
kc.loadFromDefault();
const coreApi = kc.makeApiClient(client_node_1.CoreV1Api);
const appsApi = kc.makeApiClient(client_node_1.AppsV1Api);
const k8sLog = new client_node_1.Log(kc);
const sendLines = (ws, event, source) => {
    const logLines = source.split('\n');
    for (var l of logLines) {
        if (l !== '') {
            event.text = l;
            ws.send(JSON.stringify(event));
        }
    }
};
// Get pod logs
const getPodLogs = (namespace, podName, ws) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const logStream = new stream.PassThrough();
        logStream.on('data', (chunk) => {
            var text = chunk.toString('utf8');
            var event = { namespace: namespace, podName: podName };
            sendLines(ws, event, text);
        });
        yield k8sLog.log(namespace, podName, '', logStream, { follow: true, pretty: false });
    }
    catch (err) {
        console.error(err);
        ws.send(`Error: ${err.message}`);
    }
});
// watch deployment pods
const watchPods = (namespace, deploymentName, ws) => {
    const watch = new client_node_1.Watch(kc);
    watch.watch(`/api/v1/namespaces/${namespace}/pods`, { labelSelector: `app=${deploymentName}` }, (type, obj) => {
        if (type === 'ADDED' || type === 'MODIFIED') {
            const podName = obj.metadata.name;
            console.log(`${type}: ${podName}`);
            getPodLogs(namespace, podName, ws);
        }
        else if (type === 'DELETED') {
            console.log(`${type}: ${deploymentName}`);
        }
    }, (err) => {
        console.error(err);
        ws.send(`Error: ${err.message}`);
    });
};
function processClientMessage(message, ws) {
    // {"namespace":"default","deploymentName":"ubuntu3"}
    const { namespace, deploymentName } = JSON.parse(message);
    watchPods(namespace, deploymentName, ws);
}
// HTTP server
const app = express();
app.use(bodyParser.json());
app.use(cors());
const server = http.createServer(app);
const wss = new ws_1.default.Server({ server });
wss.on('connection', (ws, req) => {
    var _a;
    var key = (_a = req.url) === null || _a === void 0 ? void 0 : _a.replace('/?key=', '');
    console.log('Client connected: ' + key);
    ws.on('message', (message) => {
        processClientMessage(message, ws);
    });
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});
app.get('/', (rq, rs) => { rs.redirect('/front'); });
app.use('/front', express.static('./dist/front'));
app.post('/login', (rq, rs) => {
    if (rq.body.user === admin.user && rq.body.password === admin.password) {
        if (admin.password === 'password')
            rs.status(201).send('');
        else {
            admin.apiKey = guid_1.default.create().toString();
            rs.status(200).send(admin.apiKey);
        }
    }
    else {
        rs.status(401).send('');
    }
});
app.post('/password', (rq, rs) => {
    if (rq.body.user === admin.user && rq.body.password === admin.password) {
        admin.password = rq.body.newpassword;
        admin.apiKey = guid_1.default.create().toString();
        rs.status(200).send(admin.apiKey);
    }
    else {
        rs.status(401).send('');
    }
});
server.listen(PORT, () => {
    var _a;
    console.log(`KLogs version is ${version_1.VERSION}`);
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Context being used: ${kc.currentContext}`);
    console.log(`Cluster name: ${(_a = kc.getCluster(kc.currentContext)) === null || _a === void 0 ? void 0 : _a.name}`);
});
var va = new ConfigApi_1.ConfigApi(kc, coreApi, appsApi);
app.use(`/config`, va.route);
