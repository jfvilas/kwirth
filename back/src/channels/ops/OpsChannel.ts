import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, OpsMessage, OpsMessageResponse, OpsCommandEnum, RouteMessage, RouteMessageResponse } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import { ClusterInfo } from '../../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from '../IChannel';
import { Readable, Writable } from 'stream';
import { execCommandGetDescribe as execCommandGetDescribe } from './GetCommand';
import { execCommandRestart } from './RestartCommand';
import { execCommandDelete } from './DeleteCommand';

export interface IAsset {
    podNamespace:string
    podName:string
    containerName:string
    inShellMode: boolean
    shellSocket: WebSocket|undefined
    stdin: Readable|undefined
    stdout: Writable|undefined
    stderr: Writable|undefined
    shellId: string
}

export interface IInstance {
    instanceId: string
    assets: IAsset[]
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

    getChannelData(): ChannelData {
        return {
            id: 'ops',
            immediatable: true,
            routable: true,
            pauseable: false,
            modifyable: false,
            reconnectable: true,
            sources: [ SourceEnum.KUBERNETES ],
            metrics: false
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'get', 'execute', 'shell', 'restart', 'cluster'].indexOf(scope)
    }

    containsInstance(instanceId: string): boolean {
        for (let socket of this.websocketOps) {
            let exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
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

    sendOpsResponse = (ws:WebSocket, instance:IInstance, asset:IAsset, id:string, text:string): void => {
        var resp: OpsMessageResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: InstanceMessageChannelEnum.OPS,
            instance: instance.instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id,
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

    async executeLinuxCommand (webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string, containerName:string, id:string, command:String) {
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let shellSocket = await this.clusterInfo.execApi.exec(podNamespace, podName, containerName, ['/bin/sh', '-i'], stdout, stderr, stdin, true, (st) => { console.log('st',st) })
        shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            var resp: OpsMessageResponse = {
                action: InstanceMessageActionEnum.NONE,
                flow: InstanceMessageFlowEnum.UNSOLICITED,
                channel: InstanceMessageChannelEnum.OPS,
                instance: instance.instanceId,
                type: InstanceMessageTypeEnum.DATA,
                id,
                command: OpsCommandEnum.GET,
                namespace: podNamespace,
                group: '',
                pod: podName,
                container: containerName,
                data: text,
                msgtype: 'opsmessageresponse'
            }
            webSocket.send(JSON.stringify(resp))
    
        }
        shellSocket.onclose = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
        }
        shellSocket.onerror = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container')
        }
        stdin?.push(command+'\n')
    }

    async restartPod(webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string ) {
        try {
            await this.clusterInfo.coreApi.deleteNamespacedPod(podName, podNamespace)
            this.sendDataMessage(webSocket, instance.instanceId, `Pod ${podNamespace}/${podName} restarted`)
        }
        catch (err) {
            this.sendDataMessage(webSocket, instance.instanceId, `Error restarting pod ${podNamespace}/${podName}: ${err}`)
        }
    }

    async executeRoutedCommand (instance:IInstance, opsMessage:OpsMessage) : Promise<OpsMessageResponse> {
        switch (opsMessage.command) {
            case OpsCommandEnum.GET:
            case OpsCommandEnum.DESCRIBE:
                return await execCommandGetDescribe(this.clusterInfo, instance, opsMessage)
            case OpsCommandEnum.RESTARTPOD:
            case OpsCommandEnum.RESTARTNS:
                return await execCommandRestart(this.clusterInfo, instance, opsMessage)
            case OpsCommandEnum.DELETE:
                return await execCommandDelete(this.clusterInfo, instance, opsMessage)
            default:
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
                    data: `Invalid command for route: '${opsMessage.command}'`,
                    msgtype: 'opsmessageresponse'
                }
                return execResponse
        }
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
            case OpsCommandEnum.INPUT: {
                console.log(`Send command '${opsMessage.command}' to ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container}`)
                let asset = instance.assets.find (a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                if (!asset) {
                    console.log(`Asset ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container} not found`)
                    execResponse.data = `Asset ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container} not found`
                    return execResponse
                }
                asset.stdin?.push(opsMessage.params?.join(' ') + '\n')
                return
            }
            case OpsCommandEnum.GET:
            case OpsCommandEnum.DESCRIBE:
                execResponse = await execCommandGetDescribe(this.clusterInfo, instance, opsMessage)
                break
            case OpsCommandEnum.LIST:
                execResponse.data = ''
                for (let asset of instance.assets) {
                    execResponse.data += `${asset.podNamespace}/${asset.podName}/${asset.containerName}\n`
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.EXECUTE:
                if (opsMessage.namespace==='' || opsMessage.pod==='' || opsMessage.container==='' || !opsMessage.namespace || !opsMessage.pod || !opsMessage.container) {
                    execResponse.data = `Namespace, pod and container must be specified (format 'ns/pod/container')`
                    return execResponse
                }
                let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                if (!asset) {
                    execResponse.data = 'Asset not found or not autorized'
                    return execResponse
                }
                this.executeLinuxCommand(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, opsMessage.id, opsMessage.params!.join(' '))
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.SHELL: {
                    if (opsMessage.namespace==='' || opsMessage.pod==='' || opsMessage.container==='' || !opsMessage.namespace || !opsMessage.pod || !opsMessage.container) {
                        execResponse.data = `Namespace, pod and container must be specified (format 'ns/pod/container')`
                        return execResponse
                    }
                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return execResponse
                    }

                    asset.shellId = opsMessage.id
                    asset.stdout = new Writable({})
                    asset.stderr = new Writable({})
                    asset.stdin = new Readable({ read() {} })

                    try {
                        asset.shellSocket = await this.clusterInfo.execApi.exec(opsMessage.namespace, opsMessage.pod, opsMessage.container, ['/bin/sh', '-i'], asset.stdout, asset.stderr, asset.stdin, true, (st) => { console.log('st',st) })
                        asset.shellSocket.on('end', () => console.log('end'))
                        asset.shellSocket.onmessage = (event) => {
                            let text = event.data.toString('utf8').substring(1)
                            this.sendOpsResponse(webSocket, instance, asset, asset.shellId, text)
                            // for (let line of text.split('\n')) {
                            //     this.sendOpsResponse(webSocket, instance, asset, line.trimEnd()+'\n')
                            // }
                        }
                        asset.shellSocket.onclose = (event) => {
                            asset.inShellMode = false
                            execResponse.data = 'Connection to container has been interrupted'
                            execResponse.command = OpsCommandEnum.SHELL
                            execResponse.type = InstanceMessageTypeEnum.SIGNAL
                            webSocket.send(JSON.stringify(execResponse))
                            return execResponse
                        }
                        asset.shellSocket.onerror = (event) => {
                            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container')
                        }
                        asset.inShellMode = true
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
            case OpsCommandEnum.RESTART: {
                    if (opsMessage.namespace==='' || opsMessage.pod==='' || opsMessage.container==='' || !opsMessage.namespace || !opsMessage.pod || !opsMessage.container) {
                        execResponse.data = `Namespace, pod and container must be specified (format 'ns/pod/container')`
                        return execResponse
                    }
                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return execResponse
                    }
                    try {
                        this.executeLinuxCommand(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, opsMessage.id, '/usr/sbin/killall5')
                        this.sendDataMessage(webSocket, instance.instanceId, `Container ${asset.podNamespace}/${asset.podName}/${asset.containerName} restarted`)
                    }
                    catch (err) {
                        this.sendDataMessage(webSocket, instance.instanceId, `Error restarting container ${asset.podNamespace}/${asset.podName}/${asset.containerName}: ${err}`)
                    }
                    execResponse.type = InstanceMessageTypeEnum.DATA
                }
                break

            case OpsCommandEnum.RESTARTALL:
                for (let asset of instance.assets) {
                    try {
                        await this.executeLinuxCommand(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, opsMessage.id, '/usr/sbin/killall5')
                    }
                    catch (err) {
                        this.sendDataMessage(webSocket, instance.instanceId, `Error executing command on ${asset.podNamespace}/${asset.podName}: ${err}`)
                    }            
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break

            case OpsCommandEnum.RESTARTPOD:
            case OpsCommandEnum.RESTARTNS:
                execResponse = await execCommandRestart(this.clusterInfo, instance, opsMessage)
                break

            case OpsCommandEnum.DELETE:
                execResponse = await execCommandDelete(this.clusterInfo, instance, opsMessage)
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
            console.log('Socket not found')
            return false
        }

        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            let opsMessage = instanceMessage as OpsMessage
            let instance:IInstance = {
                instanceId: opsMessage.instance,
                assets: [ {
                    podNamespace: opsMessage.namespace,
                    podName: opsMessage.pod,
                    containerName: opsMessage.container,
                    inShellMode: false,
                    shellSocket: undefined,
                    stdin: undefined,
                    stdout: undefined,
                    stderr: undefined,
                    shellId: ''
                } ]
            }
            let resp = await this.executeCommand(webSocket, instance, opsMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
        else {
            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceMessage.instance)
            if (!instance) {
                this.sendSignalMessage(webSocket, instanceMessage.action, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceMessage.instance, `Instance not found`)
                console.log(`Instance ${instanceMessage.instance} not found`)
                return false
            }    
            let opsMessage = instanceMessage as OpsMessage
            let resp = await this.executeCommand(webSocket, instance, opsMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    addConnection = async (webScoket:WebSocket) => {
        this.websocketOps.push ({
            ws: webScoket,
            lastRefresh: 0,
            instances: []
        })
    }

    async processImmediateCommand (instanceMessage:InstanceMessage) : Promise<any> {
        console.log('Route request received')
        let opsMessage = instanceMessage as OpsMessage

        let instance:IInstance = {
            instanceId: opsMessage.instance,
            assets: [ {
                podNamespace: opsMessage.namespace,
                podName: opsMessage.pod,
                containerName: opsMessage.container,
                inShellMode: false,
                shellSocket: undefined,
                stdin: undefined,
                stdout: undefined,
                stderr: undefined,
                shellId: ''
            } ]
        }

        let resp = await this.executeRoutedCommand(instance, opsMessage)

        let routeMessageResponse:RouteMessageResponse = {
            msgtype: 'routemessageresponse',
            action: InstanceMessageActionEnum.ROUTE,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.DATA,
            channel: InstanceMessageChannelEnum.OPS,
            instance: '',
            data: resp.data
        }
        return routeMessageResponse
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
                assets: []
            }
            instances.push(instance)
        }
        let asset:IAsset = {
            podNamespace,
            podName,
            containerName,
            inShellMode: false,
            shellSocket: undefined,
            stdin: undefined,
            stdout: undefined,
            stderr: undefined,
            shellId: ''
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
        }
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        console.log('Pause/Continue not supported')
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {
        console.log('Modify not supported')
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
                            // +++ pending impl
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
                            // +++ pending impl
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