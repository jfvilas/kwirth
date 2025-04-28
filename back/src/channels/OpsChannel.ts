import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, OpsMessage, OpsMessageResponse, InstanceConfigViewEnum, OpsCommandEnum } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import { ClusterInfo } from '../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from './IChannel';
import { Readable, Writable } from 'stream';

interface IAsset {
    podNamespace:string,
    podName:string,
    containerName:string
}        

interface IInstance {
    instanceId: string
    assets: IAsset[]
    paused: boolean
    inShellMode: boolean
    shellSocket: WebSocket|undefined
    stdin: Readable|undefined
    stdout: Writable|undefined
    stderr: Writable|undefined
    view: InstanceConfigViewEnum
}

class OpsChannel implements IChannel {
    
    clusterInfo : ClusterInfo
    websocketOps: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:SignalMessage = {
            action,
            flow,
            channel: InstanceMessageChannelEnum.OPS,
            instance: instanceId,
            type: InstanceMessageTypeEnum.SIGNAL,
            text,
            level
        }
        ws.send(JSON.stringify(resp))
    }

    sendDataMessage = (ws:WebSocket, instanceId:string, text:string): void => {
        var resp: InstanceConfigResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: InstanceMessageChannelEnum.OPS,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendOpsResponse = (ws:WebSocket, instance:IInstance, asset:IAsset, text:string): void => {
        var resp: OpsMessageResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: InstanceMessageChannelEnum.OPS,
            instance: instance.instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id: '',
            command: OpsCommandEnum.GET,
            namespace: asset.podNamespace,
            group: '',
            pod: asset.podName,
            container: asset.containerName,
            data: text,
            msgtype: 'opsmessageresponse'
        }
        ws.send(JSON.stringify(resp))
    }

    async executeLinuxCommand (webSocket:WebSocket, instance:IInstance, asset:IAsset, command:String) {
        instance.stdout = new Writable({})
        instance.stderr = new Writable({})
        instance.stdin = new Readable({ read() {} })

        instance.shellSocket = await this.clusterInfo.execApi.exec(asset.podNamespace, asset.podName, asset.containerName, ['/bin/sh', '-i'], instance.stdout, instance.stderr, instance.stdin, true, (st) => { console.log('st',st) })
        instance.shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            this.sendOpsResponse(webSocket, instance, asset, text)
        }
        instance.shellSocket.onclose = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
            instance.inShellMode = false
        }
        instance.shellSocket.onerror = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container')
        }
        instance.stdin?.push(command+'\n')
    }

    async restartPod(webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string ) {
        const result = await this.clusterInfo.coreApi.patchNamespacedPod(
            podName,
            podNamespace,
            {
              metadata: {
                annotations: {
                  'kwirth.kubernetes.io/restartedAt': new Date().toISOString(),
                },
              },
            },
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            { headers: { 'Content-Type': 'application/merge-patch+json' } }
        )
        this.sendDataMessage(webSocket, instance.instanceId, `Pod ${podNamespace}/${podName} restarted`)
    }

    async executeCommand (webSocket:WebSocket, instance:IInstance, opsMessage:OpsMessage) : Promise<OpsMessageResponse | undefined> {
        let execResponse: OpsMessageResponse = {
            action: opsMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            channel: opsMessage.channel,
            instance: opsMessage.instance,
            command: opsMessage.command,
            id: opsMessage.id,
            namespace: opsMessage.namespace,
            group: opsMessage.group,
            pod: opsMessage.pod,
            container: opsMessage.container,
            msgtype: 'opsmessageresponse'
        }

        if (!opsMessage.command) {
            execResponse.data = 'No command received in data'
            return execResponse
        }

        switch (opsMessage.command) {
            case OpsCommandEnum.INPUT:
                console.log('send command', opsMessage.command)
                instance.stdin?.push(opsMessage.params?.join(' ') + '\n')
                return undefined
            case OpsCommandEnum.GET:
                if (opsMessage.namespace === '' || opsMessage.pod==='' || opsMessage.container ==='') {
                    execResponse.data = 'Namespace, pod and container must be specified'
                    return execResponse
                }
                try {
                    let kresp = await this.clusterInfo.coreApi.readNamespacedPod(opsMessage.pod,opsMessage.namespace)
                    let cont = kresp.body.spec?.containers.find(c => c.name === opsMessage.container)
                    if (cont) {
                        execResponse.data = { name: cont.name, image: cont.image }
                    }
                    else {
                        execResponse.data = 'Container not found'
                    }
                    execResponse.type = InstanceMessageTypeEnum.DATA
                }
                catch (err) {
                    console.log(err)
                    execResponse.data = 'Cannot read pod'
                }
                break
            case OpsCommandEnum.LIST:
                execResponse.data = ''
                for (let asset of instance.assets) {
                    execResponse.data += `${asset.podNamespace}/${asset.podName}/${asset.containerName}\n`
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.DESCRIBE:
                if (opsMessage.namespace === '' || opsMessage.pod==='' || opsMessage.container ==='') {
                    execResponse.data = 'Namespace, pod and container must be specified'
                    return execResponse
                }
                try {
                    let kresp = await this.clusterInfo.coreApi.readNamespacedPod(opsMessage.pod,opsMessage.namespace)
                    let cont = kresp.body.spec?.containers.find(c => c.name === opsMessage.container)
                    if (cont) {
                        execResponse.data = cont
                    }
                    else {
                        execResponse.data = 'Container not found'
                    }
                    execResponse.type = InstanceMessageTypeEnum.DATA
                }
                catch (err) {
                    console.log(err)
                    execResponse.data = 'Cannot read pod'
                }
                break
            case OpsCommandEnum.EXECUTE:
                if (opsMessage.namespace === '' || opsMessage.pod==='' || opsMessage.container ==='') {
                    execResponse.data = 'Namespace, pod and container must be specified'
                    return execResponse
                }
                let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                if (!asset) {
                    execResponse.data = 'Asset not found or not autorized'
                    return
                }
                this.executeLinuxCommand(webSocket, instance, asset, opsMessage.params!.join(' '))
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.SHELL:
                {
                    if (opsMessage.namespace === '' || opsMessage.pod==='' || opsMessage.container ==='') {
                        execResponse.data = 'Namespace, pod and container must be specified'
                        return execResponse
                    }
                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return
                    }

                    instance.stdout = new Writable({})
                    instance.stderr = new Writable({})
                    instance.stdin = new Readable({ read() {} })

                    try {
                        instance.shellSocket = await this.clusterInfo.execApi.exec(opsMessage.namespace, opsMessage.pod, opsMessage.container, ['/bin/sh', '-i'], instance.stdout, instance.stderr, instance.stdin, true, (st) => { console.log('st',st) })
                        instance.shellSocket.on('end', () => console.log('end'))
                        instance.shellSocket.onmessage = (event) => {
                            let text = event.data.toString('utf8').substring(1)
                            for (let line of text.split('\n')) {
                                this.sendOpsResponse(webSocket, instance, asset, line.trimEnd())
                            }
                        }
                        instance.shellSocket.onclose = (event) => {
                            instance.inShellMode = false
                            execResponse.data = 'Connection to container has been interrupted'
                            execResponse.command = OpsCommandEnum.SHELL
                            execResponse.type = InstanceMessageTypeEnum.SIGNAL
                            webSocket.send(JSON.stringify(execResponse))
                            return
                        }
                        instance.shellSocket.onerror = (event) => {
                            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container')
                        }
                        instance.inShellMode = true
                        execResponse.type = InstanceMessageTypeEnum.DATA
                    }
                    catch (err) {
                        console.log('Error launching shell')
                        console.log(err)
                        execResponse.data = 'Error detected when launching shell'
                        return execResponse
                    }
                }
                break

            case OpsCommandEnum.RESTART:
                {
                    if (opsMessage.namespace === '' || opsMessage.pod==='' || opsMessage.container ==='') {
                        execResponse.data = 'Namespace, pod and container must be specified'
                        return execResponse
                    }
                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return
                    }

                    this.executeLinuxCommand(webSocket, instance, asset, '/usr/sbin/killall5')
                    execResponse.type = InstanceMessageTypeEnum.DATA
                }
                break
            case OpsCommandEnum.RESTARTALL:
                for (let asset of instance.assets) {
                    await this.executeLinuxCommand(webSocket, instance, asset, '/usr/sbin/killall5')
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.RESTARTPOD:
                if (opsMessage.namespace === '' || opsMessage.pod==='') {
                    execResponse.data = 'Namespace and pod must be specified'
                    return execResponse
                }
                if (instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod)) {
                    await this.restartPod(webSocket, instance, opsMessage.namespace, opsMessage.pod)
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.RESTARTNAMESPACE:
                if (opsMessage.namespace === '') {
                    execResponse.data = 'Namespace must be specified'
                    return execResponse
                }
                for (let asset of instance.assets) {
                    if (asset.podNamespace === opsMessage.namespace) {
                        this.restartPod(webSocket, instance, asset.podNamespace, asset.podName)
                    }    
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break                
            case OpsCommandEnum.DELETE:
                if (opsMessage.namespace === '' || opsMessage.pod==='') {
                    execResponse.data = 'Namespace and pod must be specified'
                    return execResponse
                }
                if (instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod)) {
                    await this.clusterInfo.coreApi.deleteNamespacedPod(opsMessage.pod, opsMessage.namespace)
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            default:
                execResponse.data = `Invalid command '${opsMessage.command}'. Valid commands are: ${Object.keys(OpsCommandEnum)}`
                break
        }
        return execResponse
    }

    async processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('socket not found')
            return false
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceMessage.instance)
        if (!instance) {
            //this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceMessage)
            this.sendSignalMessage(webSocket, instanceMessage.action, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceMessage.instance, `Instance not found`)
            console.log('instance not foind')
            return false
        }

        let opsMessage = instanceMessage as OpsMessage
        let resp = await this.executeCommand(webSocket, instance, opsMessage)
        if (resp) {
            console.log('resp.data****************')
            console.log(resp.data)
            console.log('resp.data****************')
            webSocket.send(JSON.stringify( resp ))
        }
        return true
    }

    getChannelData(): ChannelData {
        return {
            id: 'ops',
            pauseable: false,
            modifyable: false,
            reconnectable: true,
            sources: [ SourceEnum.KUBERNETES ],
            metrics: false
        }
    }

    containsInstance(instanceId: string): boolean {
        for (let socket of this.websocketOps) {
            let exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.websocketOps.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.websocketOps[len-1]
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (!instance) {
            instance = {
                instanceId: instanceConfig.instance,
                assets: [],
                paused: false,
                shellSocket: undefined,
                inShellMode: false,
                stdin: undefined,
                stdout: undefined,
                stderr: undefined,
                view: instanceConfig.view
            }
            instances.push(instance)
        }
        let asset:IAsset = {
            podNamespace ,
            podName,
            containerName
        }
        instance.assets.push(asset)
    }

    async processMessage(webSocket: WebSocket) {

    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Ops instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Instance not found`)
            //this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'filter', 'view', 'cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        var socket = this.websocketOps.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('No socket found for pci')
            return
        }
        let instances = socket.instances

        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) {
                instance.paused = true
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Ops paused')
            }
            if (action === InstanceMessageActionEnum.CONTINUE) {
                instance.paused = false
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.CONTINUE, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Ops continued')
            }
        }
        else {
            //this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
            this.sendSignalMessage(webSocket, instanceConfig.action, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Instance ${instanceConfig.instance} not found`)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            var instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (var asset of instance.assets) {
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no ops Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on ops')
        }
    }

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.websocketOps.find(s => s.ws === webSocket))
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.websocketOps.findIndex(s => s.ws === webSocket)
            this.websocketOps.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on ops for remove')
        }
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.websocketOps.find(s => s.ws === webSocket)
        if (socket) {
            socket.lastRefresh = Date.now()
            return true
        }
        else {
            console.log('WebSocket not found')
            return false
        }
    }

    updateConnection(newWebSocket: WebSocket, instanceId: string): boolean {
        for (let entry of this.websocketOps) {
            var exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (var instance of entry.instances) {
                    if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
                        for (let asset of instance.assets) {
                        }
                    }
                    else if (this.clusterInfo.type === ClusterTypeEnum.KUBERNETES) {
                        console.log('instancefound')
                        for (let asset of instance.assets) {
                            console.log(`found ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)
                        }
                    }
                }
                return true
            }
        }
        return false
    }

}

export { OpsChannel }