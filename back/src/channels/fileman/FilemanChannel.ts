import { InstanceConfig, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, InstanceConfigResponse, parseResources } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel'
import { Readable, Writable } from 'stream';
import { AuthorizationManagement } from '../../tools/AuthorizationManagement';
import { V1Status } from '@kubernetes/client-node';
const ParseListing = require ('parse-listing')

export interface IFilemanConfig {
    interval: number
}

export enum FilemanCommandEnum {
    HOME = 'home',
    DIR = 'dir',
    RENAME = 'rename',
    DELETE = 'delete',
    MOVE = 'move',
    COPY = 'copy',
    UPLOAD = 'upload',
    DOWNLOAD = 'download'
}

export interface IFilemanMessage extends InstanceMessage {
    msgtype: 'filemanmessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    group: string
    pod: string
    container: string
    command: FilemanCommandEnum
    params?: string[]
}

export interface IFilemanMessageResponse extends InstanceMessage {
    msgtype: 'filemanmessageresponse'
    id: string;
    command: FilemanCommandEnum
    namespace: string
    group: string
    pod: string
    container: string
    data?: any
}

export interface IAsset {
    podNamespace: string
    podName: string
    containerName: string
    stdin: Readable|undefined
    stdout: Writable|undefined
    stderr: Writable|undefined
}

export interface IInstance {
    instanceId: string
    accessKey: AccessKey
    configData: IFilemanConfig
    paused: boolean
    assets: IAsset[]
}

class FilemanChannel implements IChannel {
    clusterInfo : ClusterInfo
    webSocketFileman: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData = (): BackChannelData => {
        return {
            id: 'fileman',
            routable: false,
            pauseable: false,
            modifyable: false,
            reconnectable: true,
            metrics: false,
            sources: [ ClusterTypeEnum.KUBERNETES, ClusterTypeEnum.DOCKER ]
        }
    }

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'fileman$read', 'fileman$write', 'cluster'].indexOf(scope)
    }

    containsInstance = (instanceId: string): boolean => {
        console.log(this.webSocketFileman)
        return this.webSocketFileman.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }
    
    processCommand = async (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> => {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            return false
        }
        else {
            let socket = this.webSocketFileman.find(s => s.ws === webSocket)
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
            let filemanMessage = instanceMessage as IFilemanMessage
            let resp = await this.executeCommand(webSocket, instance, filemanMessage)
            if (resp) webSocket.send(JSON.stringify(resp))
            return Boolean(resp)
        }
    }

    startInstance = async (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> => {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSocketFileman.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSocketFileman.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSocketFileman[len-1]
        }

        let instances = socket.instances
        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (!instance) {
            instance = {
                accessKey: accessKeyDeserialize(instanceConfig.accessKey),
                instanceId: instanceConfig.instance,
                configData: instanceConfig.data,
                paused: false,
                assets: []
            }
            instances.push(instance)
        }
        let asset:IAsset = {
            podNamespace,
            podName,
            containerName,
            stdin: undefined,
            stdout: undefined,
            stderr: undefined
        }
        instance.assets.push(asset)
    }

    pauseContinueInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void => {
        console.log('Pause/Continue not supported')
    }

    modifyInstance = (webSocket:WebSocket, instanceConfig: InstanceConfig): void => {
        console.log('Modify not supported')
    }

    stopInstance = (webSocket: WebSocket, instanceConfig: InstanceConfig): void => {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Fileman instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Fileman instance not found`)
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        let socket = this.webSocketFileman.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
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
                console.log('There are no Fileman Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on Fileman')
        }
    }

    containsConnection = (webSocket:WebSocket): boolean => {
        return Boolean (this.webSocketFileman.find(s => s.ws === webSocket))
    }

    removeConnection = (webSocket: WebSocket): void => {
        let socket = this.webSocketFileman.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSocketFileman.findIndex(s => s.ws === webSocket)
            this.webSocketFileman.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on Fileman for remove')
        }
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        let socket = this.webSocketFileman.find(s => s.ws === webSocket)
        if (socket) {
            socket.lastRefresh = Date.now()
            return true
        }
        else {
            console.log('WebSocket not found')
            return false
        }
    }

    updateConnection = (newWebSocket: WebSocket, instanceId: string): boolean => {
        for (let entry of this.webSocketFileman) {
            let exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (let instance of entry.instances) {
                    for (let asset of instance.assets) {
                    }
                }
                return true
            }
        }
        return false
    }

    // ********************************************************************************************************************************
    // *********************************************************** private methods ****************************************************
    // ********************************************************************************************************************************

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:SignalMessage = {
            action,
            flow,
            channel: 'fileman',
            instance: instanceId,
            type: InstanceMessageTypeEnum.SIGNAL,
            text,
            level
        }
        ws.send(JSON.stringify(resp))
    }

    getInstance(webSocket:WebSocket, instanceId: string) : IInstance | undefined{
        let socket = this.webSocketFileman.find(entry => entry.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                if (instanceIndex>=0) return instances[instanceIndex]
                console.log('Instance not found')
            }
            else {
                console.log('There are no Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found')
        }
        return undefined
    }
    
    private async executeCommand (webSocket:WebSocket, instance:IInstance, filemanMessage:IFilemanMessage) : Promise<IFilemanMessageResponse | undefined> {
        let execResponse: IFilemanMessageResponse = {
            action: filemanMessage.action,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            channel: filemanMessage.channel,
            instance: filemanMessage.instance,
            command: filemanMessage.command,
            id: filemanMessage.id,
            namespace: filemanMessage.namespace,
            group: filemanMessage.group,
            pod: filemanMessage.pod,
            container: filemanMessage.container,
            msgtype: 'filemanmessageresponse'
        }

        if (!filemanMessage.command) {
            execResponse.data = 'No command received in data'
            return execResponse
        }

        switch (filemanMessage.command) {
            case FilemanCommandEnum.HOME: {
                console.log(`Get HOME`)
                execResponse.data = instance.assets.map(a => `${a.podNamespace}/${a.podName}/${a.containerName}`)
                console.log(execResponse.data)
                execResponse.type = InstanceMessageTypeEnum.DATA
                return execResponse
            }
            case FilemanCommandEnum.DIR: {
                console.log(`Get DIR from '${filemanMessage.command}' to ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container}`)
                let asset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                if (!asset) {
                    console.log(`Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`)
                    execResponse.data = `Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`
                    return execResponse
                }
                //+++ this.executeDir(webSocket, instance, asset.poxxxdNamespace, asset.poxxxdName, asset.contaixxxxnerName, '1', filemanMessage.params![0])
                this.executeDir(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, '1', filemanMessage.params![0])
                return
            }
            case FilemanCommandEnum.RENAME: {
                console.log(`Do RENAME in '${filemanMessage.command}' to ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container}`)
                let asset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                if (!asset) {
                    console.log(`Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`)
                    execResponse.data = `Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`
                    return execResponse
                }
                this.executeRename(webSocket, instance, asset.podNamespace, asset.podName, asset.containerName, '1', filemanMessage.params![0], filemanMessage.params![1])
                return
            }
            case FilemanCommandEnum.COPY:
            case FilemanCommandEnum.MOVE: {
                console.log(`Do `+filemanMessage.command.toUpperCase())
                let srcAsset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                let dstAsset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                if (!srcAsset || !dstAsset) {
                    console.log(`Asset src or dst not found`)
                    execResponse.data = `Asset src or dst not found`
                    return execResponse
                }
                this.executeCopyOrMove(webSocket, instance, '1', filemanMessage.params![0], filemanMessage.params![1], filemanMessage.command)
                return
            }
            case FilemanCommandEnum.DELETE: {
                console.log(`Do DELETE on ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container}`)
                let asset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                if (!asset) {
                    console.log(`Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`)
                    execResponse.data = `Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`
                    return execResponse
                }
                this.executeDelete(webSocket, instance, '1', filemanMessage.params![0])
                return
            }

            default:
                execResponse.data = `Invalid command '${filemanMessage.command}'. Valid commands are: ${Object.keys(FilemanCommandEnum)}`
                break
        }
        return execResponse
    }

    private async executeDir (webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string, containerName:string, id:string, dir:string) {
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let homeDir = dir.split('/').slice(0,4).join('/')
        let localDir = "/" + dir.split('/').slice(4).join('/')

        let shellSocket = await this.clusterInfo.execApi.exec(podNamespace, podName, containerName, ['/bin/ls', '-l', localDir], stdout, stderr, stdin, false, (st) => { console.log('st',st) })
        shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            ParseListing.parseEntries(text, (err:any, entryArray:any[]) => {
                entryArray.map (e => e.name = homeDir + localDir + e.name)
                var resp: IFilemanMessageResponse = {
                    action: InstanceMessageActionEnum.COMMAND,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    channel: 'fileman',
                    instance: instance.instanceId,
                    type: InstanceMessageTypeEnum.DATA,
                    id,
                    command: FilemanCommandEnum.DIR,
                    namespace: podNamespace,
                    group: '',
                    pod: podName,
                    container: containerName,
                    data: JSON.stringify(entryArray),
                    msgtype: 'filemanmessageresponse'
                }
                webSocket.send(JSON.stringify(resp))
            })
        }
        shellSocket.onclose = (event) => {
            //this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
        }
        shellSocket.onerror = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container: '+JSON.stringify(event))
        }
    }

    private async executeCopyOrMove (webSocket:WebSocket, instance:IInstance, id:string, srcPath:string, dstPath:string, operation:FilemanCommandEnum) {
        let buffer= ''
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let srcHomeDir = srcPath.split('/').slice(0,4).join('/')
        let srcLocalPath = '/' + srcPath.split('/').slice(4).join('/')

        let dstHomeDir = dstPath.split('/').slice(0,4).join('/')
        let dstLocalPath = '/' + dstPath.split('/').slice(4).join('/')

        let command = operation === FilemanCommandEnum.MOVE? '/bin/mv' : '/bin/cp'

        console.log('command, srcHomeDir, srcLocalPath, dstHomeDir, dstLocalPath')
        console.log(command, srcHomeDir, srcLocalPath, dstHomeDir, dstLocalPath)

        if (srcHomeDir===dstHomeDir) {
            // copy/move on same container
            let [namespace,pod,container] = srcHomeDir.split('/').slice(1)
            let shellSocket = await this.clusterInfo.execApi.exec(namespace, pod, container, [command, srcLocalPath, dstLocalPath], stdout, stderr, stdin, false, (st) => { console.log('st',st) })
            shellSocket.onmessage = (event) => {
                let text = event.data.toString('utf8').substring(1)
                if (!text) return
                try {
                    let result = JSON.parse(text)
                    result.text = buffer
                    let resp: IFilemanMessageResponse = {
                        action: InstanceMessageActionEnum.COMMAND,
                        flow: InstanceMessageFlowEnum.UNSOLICITED,
                        channel: 'fileman',
                        instance: instance.instanceId,
                        type: InstanceMessageTypeEnum.DATA,
                        id,
                        command: operation,
                        namespace: '',
                        group: '',
                        pod: '',
                        container: '',
                        data: JSON.stringify(result),
                        msgtype: 'filemanmessageresponse'
                    }
                    webSocket.send(JSON.stringify(resp))
                }
                catch {
                    buffer += text
                }
            }
            shellSocket.onclose = (event) => {
                //this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
            }
            shellSocket.onerror = (event) => {
                this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container: '+JSON.stringify(event))
            }
        }
        else {
            // copy/move on different container
            // Copiar entre contenedores diferentes usando kubectl exec
            let [srcNamespace,srcPod,srcContainer] = srcHomeDir.split('/').slice(1)
            let [dstNamespace,dstPod,dstContainer] = srcHomeDir.split('/').slice(1)

            // Comando para empaquetar el archivo en el contenedor origen y enviarlo
            let sendCommand = `tar -cf - ${srcLocalPath} | nc ${dstContainer} 12345`;
            console.log("Sending file from source container:", sendCommand);

            // Ejecutar el comando en el contenedor origen
            try {
                await this.execInContainer(srcNamespace, srcPath, srcContainer, ['sh', '-c', sendCommand]);
            } catch (error) {
                console.error('Error while sending file from source container:', error);
                return;
            }

            // En el contenedor destino, escuchar el puerto y recibir los datos
            let receiveCommand = `nc -l -p 12345 | tar -xf - -C ${dstLocalPath}`;
            console.log("Receiving file in destination container:", receiveCommand);

            try {
                await this.execInContainer(dstNamespace, dstPod, dstContainer, ['sh', '-c', receiveCommand]);
            } catch (error) {
                console.error('Error while receiving file in destination container:', error);
                return;
            }

            // Enviar respuesta de éxito
            let resp: IFilemanMessageResponse = {
                action: InstanceMessageActionEnum.COMMAND,
                flow: InstanceMessageFlowEnum.UNSOLICITED,
                channel: 'fileman',
                instance: instance.instanceId,
                type: InstanceMessageTypeEnum.DATA,
                id,
                command: operation,
                namespace: '',
                group: '',
                pod: '',
                container: '',
                data: JSON.stringify({ success: true }),
                msgtype: 'filemanmessageresponse'
            };
            webSocket.send(JSON.stringify(resp));            
        }
    }

    private async execInContainer(namespace: string, pod: string, container: string, command: string[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const exec = this.clusterInfo.execApi
            exec.exec(
                namespace,
                pod,
                container,
                command,
                process.stdout,   // Se puede redirigir a donde quieras que vayan los datos (stdout)
                process.stderr,   // También puedes redirigir stderr
                null,
                true,             // Tienes que usar tty
                (status: V1Status) => {
                    if (status.code !== 0) {
                        reject(`Command failed with status: ${status}`)
                    } else {
                        resolve()
                    }
                }
            )
        })
    }
    
    
    private async executeDelete (webSocket:WebSocket, instance:IInstance, id:string, srcPath:string) {
        let buffer= ''
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let srcHomeDir = srcPath.split('/').slice(0,4).join('/')
        let srcLocalPath = '/' + srcPath.split('/').slice(4).join('/')

        console.log('srcHomeDir, srcLocalPath')
        console.log(srcHomeDir, srcLocalPath)

        // copy on same container
        let [namespace,pod,container] = srcHomeDir.split('/').slice(1)
        let shellSocket = await this.clusterInfo.execApi.exec(namespace, pod, container, ['/bin/rm', '-r', srcLocalPath], stdout, stderr, stdin, false, (st) => { console.log('st',st) })
        shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            if (!text) return
            try {
                let result = JSON.parse(text)
                result.text = buffer
                let resp: IFilemanMessageResponse = {
                    action: InstanceMessageActionEnum.COMMAND,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    channel: 'fileman',
                    instance: instance.instanceId,
                    type: InstanceMessageTypeEnum.DATA,
                    id,
                    command: FilemanCommandEnum.DELETE,
                    namespace: '',
                    group: '',
                    pod: '',
                    container: '',
                    data: JSON.stringify(result),
                    msgtype: 'filemanmessageresponse'
                }
                webSocket.send(JSON.stringify(resp))
            }
            catch {
                buffer += text
            }
        }
        shellSocket.onclose = (event) => {
            //this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
        }
        shellSocket.onerror = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container: '+JSON.stringify(event))
        }
    }

    private async executeRename (webSocket:WebSocket, instance:IInstance, podNamespace:string, podName:string, containerName:string, id:string, originPath:string, newname:string) {
        let buffer= ''
        let stdout = new Writable({})
        let stderr = new Writable({})
        let stdin = new Readable({ read() {} })

        let homeDir = originPath.split('/').slice(0,4).join('/')
        let localPath = '/' + originPath.split('/').slice(4).join('/')
        let localParts = localPath.split('/').slice(1)
        localParts[localParts.length-1] = newname
        let newPath = '/' + localParts.join('/')
        console.log(homeDir, localPath, '->', newPath)
        let shellSocket = await this.clusterInfo.execApi.exec(podNamespace, podName, containerName, ['/bin/mv', localPath, newPath], stdout, stderr, stdin, false, (st) => { console.log('st',st) })
        shellSocket.onmessage = (event) => {
            let text = event.data.toString('utf8').substring(1)
            if (!text) return
            try {
                let result = JSON.parse(text)
                result.text = buffer
                let resp: IFilemanMessageResponse = {
                    action: InstanceMessageActionEnum.COMMAND,
                    flow: InstanceMessageFlowEnum.RESPONSE,
                    channel: 'fileman',
                    instance: instance.instanceId,
                    type: InstanceMessageTypeEnum.DATA,
                    id,
                    command: FilemanCommandEnum.RENAME,
                    namespace: podNamespace,
                    group: '',
                    pod: podName,
                    container: containerName,
                    data: JSON.stringify(result),
                    msgtype: 'filemanmessageresponse'
                }
                webSocket.send(JSON.stringify(resp))
            }
            catch {
                buffer += text
            }
        }
        shellSocket.onclose = (event) => {
            //this.sendDataMessage(webSocket, instance.instanceId, 'Connection to container has been interrupted')
        }
        shellSocket.onerror = (event) => {
            this.sendDataMessage(webSocket, instance.instanceId, 'Error detected con connection to container: '+JSON.stringify(event))
        }
    }

    private sendDataMessage = (ws:WebSocket, instanceId:string, text:string): void => {
        var resp: InstanceConfigResponse = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: 'fileman',
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    private checkAssetScope = (instance:IInstance, asset: IAsset, scope: string) => {
        let resources = parseResources (instance.accessKey.resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        // +++ AuthorizationManagemetn must be provided as a service to the channel
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel) && AuthorizationManagement.checkResource(r, asset.podNamespace, asset.podName, asset.containerName))
        return canPerform
    }


}

export { FilemanChannel }