import { InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, IOpsMessage, IOpsMessageResponse, OpsCommandEnum, IRouteMessageResponse, AccessKey, accessKeyDeserialize, parseResources, BackChannelData, ClusterTypeEnum, ResourceIdentifier } from '@jfvilas/kwirth-common';
import { WebSocket as NonNativeWebSocket } from 'ws'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel';
import { Readable, Writable } from 'stream';
import { execCommandGetDescribe } from './GetCommand';
import { execCommandRestart } from './RestartCommand';
import { AuthorizationManagement } from '../../tools/AuthorizationManagement';
import { Request, Response } from 'express'

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
    inShellMode: boolean
    shellSocket: NonNativeWebSocket|undefined
    stdin: Readable|undefined
    stdout: Writable|undefined
    stderr: Writable|undefined
    shellId: string
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    assets: IAsset[]
}

class OpsChannel implements IChannel {    
    clusterInfo : ClusterInfo
    webSocket: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData(): BackChannelData {
        return {
            id: 'ops',
            routable: true,
            pauseable: false,
            modifyable: false,
            reconnectable: false,
            metrics: false,
            sources: [ ClusterTypeEnum.KUBERNETES ],
            endpoints: [],
            websocket: true
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'ops$get', 'ops$execute', 'ops$shell', 'ops$restart', 'cluster'].indexOf(scope)
    }

    async endpointRequest(endpoint:string,req:Request, res:Response) : Promise<void> {
    }

    async websocketRequest(newWebSocket:WebSocket) : Promise<void> {
    }

    containsAsset = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string): boolean => {
        let socket = this.webSocket.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) return instances.some(i => i.assets.some(a => a.podNamespace===podNamespace && a.podName===podName && a.containerName===containerName))
        }
        return false
    }

    containsInstance(instanceId: string): boolean {
        return this.webSocket.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    async processCommand (webSocket:WebSocket, instanceMessage:IInstanceMessage) : Promise<boolean> {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            // immediate commands are typical request/repsonse pattern, so we invoke 'executeImmediteCommand' and we send back the response
            let resp = await this.executeImmediateCommand(instanceMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
        else {
            let socket = this.webSocket.find(s => s.ws === webSocket)
            if (!socket) {
                console.log('Socket not found')
                return false
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceMessage.instance)
            if (!instance) {
                this.sendSignalMessage(webSocket, instanceMessage.action, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceMessage.instance, `Instance not found`)
                console.log(`Instance ${instanceMessage.instance} not found`)
                return false
            }    
            let opsMessage = instanceMessage as IOpsMessage
            let resp = await this.executeCommand(webSocket, instance, opsMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    async addObject (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSocket.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSocket.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSocket[len-1]
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (!instance) {
            instance = {
                accessKey: accessKeyDeserialize(instanceConfig.accessKey),
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

    deleteObject = (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) : void => {
        
    }
    
    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        console.log('Pause/Continue not supported')
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {
        console.log('Modify not supported')
    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.webSocket.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Ops instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Instance not found`)
        }
    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.webSocket.find(s => s.ws === webSocket)
        if (socket) {
            var instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
                        asset.shellSocket?.close()
                        asset.stdin?.destroy()
                        asset.stdout?.destroy()
                        asset.stderr?.destroy()
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
        return Boolean (this.webSocket.find(s => s.ws === webSocket))
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.webSocket.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSocket.findIndex(s => s.ws === webSocket)
            this.webSocket.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on ops for remove')
        }
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.webSocket.find(s => s.ws === webSocket)
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
        console.log('updateConnection not supported')
        return false
    }

    // *************************************************************************************
    // PRIVATE
    // *************************************************************************************

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:ISignalMessage = {
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

    private sendDataMessage = (ws:WebSocket, instanceId:string, text:string): void => {
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

    private sendOpsResponse = (ws:WebSocket, instance:IInstance, asset:IAsset, id:string, text:string): void => {
        var resp: IOpsMessageResponse = {
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

    private async executeLinuxCommand (webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string, containerName:string, id:string, command:string) {
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let shellSocket = await this.clusterInfo.execApi.exec(podNamespace, podName, containerName, ['/bin/sh', '-i'], stdout, stderr, stdin, true, (st) => { console.log('st',st) })
        shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            var resp: IOpsMessageResponse = {
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

    private checkAssetScope = (instance:IInstance, asset: IAsset, scope: string) => {
        let resources = parseResources (instance.accessKey.resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel) && AuthorizationManagement.checkResource(r, asset.podNamespace, asset.podName, asset.containerName))
        return canPerform
    }

    private async executeImmediateCommand (instanceMessage:IInstanceMessage) : Promise<IRouteMessageResponse> {
        console.log('Immediate request received')
        let opsMessage = instanceMessage as IOpsMessage

        // we create a dummy instance for executnig command, and we add the asset erefrenced int hte immediate command
        let instance:IInstance = {
            accessKey: accessKeyDeserialize(opsMessage.accessKey),
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

        // we prepare a base response message
        let resp:IOpsMessageResponse = {
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

        switch (opsMessage.command) {
            case OpsCommandEnum.GET:
            case OpsCommandEnum.DESCRIBE:
                //if (this.checkScopes(instance, 'ops$get'))
                if (this.checkAssetScope(instance, instance.assets[0], 'ops$get'))
                    resp = await execCommandGetDescribe(this.clusterInfo, instance, opsMessage)
                else
                    resp.data = `Insufficient scope for GET`
                break
            case OpsCommandEnum.RESTARTPOD:
            case OpsCommandEnum.RESTARTNS:
                if (this.checkAssetScope(instance, instance.assets[0], 'ops$restart'))
                    resp = await execCommandRestart(this.clusterInfo, instance, opsMessage)
                else
                    resp.data = `Insufficient scope for RESTART`
                break
            default:
                resp.data = `Invalid command for route: '${opsMessage.command}'`
                break
        }

        let routeMessageResponse:IRouteMessageResponse = {
            msgtype: 'routemessageresponse',
            action: InstanceMessageActionEnum.ROUTE,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            channel: InstanceMessageChannelEnum.OPS,
            instance: instanceMessage.instance,
            data: resp
        }
        return routeMessageResponse
    }

    private async executeCommand (webSocket:WebSocket, instance:IInstance, opsMessage:IOpsMessage) : Promise<IOpsMessageResponse | undefined> {
        let execResponse: IOpsMessageResponse = {
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
            case OpsCommandEnum.LIST:
                execResponse.data = ''
                for (let asset of instance.assets) {
                    execResponse.data += `${asset.podNamespace}/${asset.podName}/${asset.containerName}\n`
                }
                execResponse.type = InstanceMessageTypeEnum.DATA
                break
            case OpsCommandEnum.GET:
            case OpsCommandEnum.DESCRIBE: {
                let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                if (!asset) {
                    execResponse.data = 'Asset not found or not autorized'
                    return execResponse
                }
                if (!this.checkAssetScope(instance, asset, 'ops$get')) {
                    execResponse.data = `Insuffcient scope for GET/DESCRIBE`
                    return execResponse
                }
                execResponse = await execCommandGetDescribe(this.clusterInfo, instance, opsMessage)
                break
            }
            case OpsCommandEnum.EXECUTE: {
                    if (opsMessage.namespace==='' || opsMessage.pod==='' || opsMessage.container==='' || !opsMessage.namespace || !opsMessage.pod || !opsMessage.container) {
                        execResponse.data = `Namespace, pod and container must be specified (format 'ns/pod/container')`
                        return execResponse
                    }
                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod && a.containerName === opsMessage.container)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return execResponse
                    }

                    if (!this.checkAssetScope(instance, asset, 'ops$execute')) {
                        execResponse.data = `Insuffcient scope for EXECUTE`
                        return execResponse
                    }

                    this.executeLinuxCommand(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, opsMessage.id, opsMessage.params!.join(' '))
                    execResponse.type = InstanceMessageTypeEnum.DATA
                    break
                }
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

                    if (!this.checkAssetScope(instance, asset, 'ops$shell')) {
                        execResponse.data = 'Insufficent scope to SHELL'
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

                    if (!this.checkAssetScope(instance, asset, 'ops$restart')) {
                        execResponse.data = 'Insufficient scope to RESTART CONTAINER'
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

            case OpsCommandEnum.RESTARTNS:
                for (let asset of instance.assets) {
                    if (!this.checkAssetScope(instance, asset, 'ops$restart')) {
                        execResponse.data = `You have no RESTART scope on all namespace objects [${asset.podNamespace}/${asset.podName}/${asset.containerName}]`
                        return execResponse
                    }
                }

                execResponse = await execCommandRestart(this.clusterInfo, instance, opsMessage)
                break

            case OpsCommandEnum.RESTARTPOD: {
                    if (opsMessage.namespace==='' || opsMessage.pod==='' || !opsMessage.namespace || !opsMessage.pod) {
                        execResponse.data = `Namespace, pod and container must be specified (format 'ns/pod')`
                        return execResponse
                    }

                    let asset = instance.assets.find(a => a.podNamespace === opsMessage.namespace && a.podName === opsMessage.pod)
                    if (!asset) {
                        execResponse.data = 'Asset not found or not autorized'
                        return execResponse
                    }

                    if (!this.checkAssetScope(instance, asset, 'ops$restart')) {
                        execResponse.data = 'Insufficient scope to RESTARTPOD'
                        return execResponse
                    }
                    execResponse = await execCommandRestart(this.clusterInfo, instance, opsMessage)
                }
                break

            default:
                execResponse.data = `Invalid command '${opsMessage.command}'. Valid commands are: ${Object.keys(OpsCommandEnum)}`
                break
        }
        return execResponse
    }

}

export { OpsChannel }