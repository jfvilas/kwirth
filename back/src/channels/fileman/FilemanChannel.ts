import { InstanceConfig, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, IInstanceMessage, AccessKey, accessKeyDeserialize, ClusterTypeEnum, BackChannelData, InstanceConfigResponse, parseResources } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { IChannel } from '../IChannel'
import { Readable, Writable } from 'stream';
import { Request, Response } from 'express'
import { randomUUID } from 'crypto';
import fs from 'fs'
import path from 'path';
import fileUpload from 'express-fileupload';

const ParseListing = require ('parse-listing')

export interface IFilemanConfig {
    interval: number
}

export enum FilemanCommandEnum {
    HOME = 'home',
    DIR = 'dir',
    CREATE = 'create',
    RENAME = 'rename',
    DELETE = 'delete',
    MOVE = 'move',
    COPY = 'copy',
    UPLOAD = 'upload',
    DOWNLOAD = 'download'
}

export interface IFilemanMessage extends IInstanceMessage {
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

export interface IFilemanMessageResponse extends IInstanceMessage {
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
    webSockets: {
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
            sources: [ ClusterTypeEnum.KUBERNETES, ClusterTypeEnum.DOCKER ],
            endpoints: [
                { name: 'download', methods: ['GET'], requiresAccessKey: false },
                { name: 'upload', methods: ['POST'], requiresAccessKey: false } 
            ]
        }
    }

    getChannelScopeLevel = (scope: string): number => {
        return ['', 'fileman$read', 'fileman$write', 'cluster'].indexOf(scope)
    }

    async endpointRequest(endpoint:string, req:Request, res:Response) : Promise<void> {
        console.log('endpointreq:',endpoint, req.method, req.url)
        let key=req.query['key'] as string
        switch (endpoint){
            case 'download':
                // +++
                // temporarily, the key will contain just the instanceId. When ReactFileManager supports adding headers to download requests
                // we should receive an Authorization header containing a valid accessKey
                let filename=req.query['filename'] as string

                if (!key || !filename) {
                    res.send().status(400)
                    return
                }
                let existInstance = this.webSockets.some(ws => ws.instances.some(i => i.instanceId === key))
                if (!existInstance) {
                    res.send('Inexistent instance').status(403)
                    return
                }

                let [srcNamespace,srcPod,srcContainer] = filename.split('/').slice(1)
                let filepath = '/' + filename.split('/').slice(4).join('/')

                let fileInfo  = await this.getFileInfo(filename)
                let encondedFilename = encodeURIComponent(filename.split('/').slice(-1)[0])
                if (fileInfo) {
                    if (fileInfo.type === 0 || fileInfo.type === 2) {
                        console.log('filePath', filepath)
                        let tmpName='/tmp/'+randomUUID()
                        await this.downloadFile(srcNamespace, srcPod, srcContainer, filepath, tmpName)
                        res.setHeader('Content-Disposition', `attachment; filename="${encondedFilename}"`)
                        res.send(fs.readFileSync(tmpName)).status(200)
                        fs.unlinkSync(tmpName)
                    }
                    else if (fileInfo.type === 1) {
                        let tmpName='/tmp/'+randomUUID()
                        await this.downloadFolder(srcNamespace, srcPod, srcContainer, filepath, tmpName)
                        res.setHeader('Content-Disposition', `attachment; filename="${encondedFilename}.tar.gz"`)
                        res.send(fs.readFileSync(tmpName)).status(200)
                        fs.unlinkSync(tmpName)
                    }
                    else {
                        console.error('fileInfoType', fileInfo.type)
                    }
                }
                else {
                    console.error('No fileInfo/Type', fileInfo)
                }
                break
            case 'upload': {
                let socket = this.webSockets.find(ws => ws.instances.some(i => i.instanceId === key))
                if (socket) {
                    const filedata = req.files!.file  as fileUpload.UploadedFile
                    const filename = req.body.filename as string

                    let tmpName='/tmp/'+randomUUID()
                    fs.writeFileSync(tmpName, filedata.data)
                    let [dstNamespace,dstPod,dstContainer] = filename.split('/').slice(1)
                    let dstLocalPath = '/' + filename.split('/').slice(4).join('/')
                    await this.uploadFile(dstNamespace, dstPod, dstContainer, tmpName, dstLocalPath)

                    let size = fs.statSync(tmpName).size
                    let result = { metadata: { object:filename, type:0, time: Date.now(), size: size }, status:'Success'}
                    let resp: IFilemanMessageResponse = {
                        action: InstanceMessageActionEnum.COMMAND,
                        flow: InstanceMessageFlowEnum.UNSOLICITED,
                        channel: 'fileman',
                        instance: key,
                        type: InstanceMessageTypeEnum.DATA,
                        id: '1',
                        command: FilemanCommandEnum.CREATE,
                        namespace: '',
                        group: '',
                        pod: '',
                        container: '',
                        data: JSON.stringify(result),
                        msgtype: 'filemanmessageresponse'
                    }
                    socket.ws.send(JSON.stringify(resp))
                    res.send().status(200)
                }
                else {
                    res.send('Inexistent instance').status(500)
                }
                break
            }
        } 
    }

    containsInstance = (instanceId: string): boolean => {
        return this.webSockets.some(socket => socket.instances.find(i => i.instanceId === instanceId))
    }

    containsAsset = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string): boolean => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) return instances.some(i => i.assets.some(a => a.podNamespace===podNamespace && a.podName===podName && a.containerName===containerName))
        }
        return false
    }
    
    processCommand = async (webSocket:WebSocket, instanceMessage:IInstanceMessage) : Promise<boolean> => {
        if (instanceMessage.flow === InstanceMessageFlowEnum.IMMEDIATE) {
            return false
        }
        else {
            let socket = this.webSockets.find(s => s.ws === webSocket)
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

    addObject = async (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> => {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (!socket) {
            let len = this.webSockets.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
            socket = this.webSockets[len-1]
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
            containerName
        }
        instance.assets.push(asset)
    }

    deleteObject = (webSocket:WebSocket, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) : void => {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            instance.assets = instance.assets.filter(a => a.podNamespace!==podNamespace && a.podName!==podName && a.containerName!==containerName)
        }
        else {
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Fileman instance not found`)
        }
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
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.INFO, instanceConfig.instance, 'Fileman instance stopped')
        }
        else {
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instanceConfig.instance, `Fileman instance not found`)
        }
    }

    removeInstance = (webSocket: WebSocket, instanceId: string): void => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
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
        return Boolean (this.webSockets.find(s => s.ws === webSocket))
    }

    removeConnection = (webSocket: WebSocket): void => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.webSockets.findIndex(s => s.ws === webSocket)
            this.webSockets.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on Fileman for remove')
        }
    }

    refreshConnection = (webSocket: WebSocket): boolean => {
        let socket = this.webSockets.find(s => s.ws === webSocket)
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
        for (let entry of this.webSockets) {
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

    // *************************************************************************************
    // PRIVATE
    // *************************************************************************************

    private sendUnsolMessage = (webSocket:WebSocket, instanceId:string, command: FilemanCommandEnum, data:any): void => {
        let resp: IFilemanMessageResponse = {
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            channel: 'fileman',
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            id: '1',
            command,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            data,
            msgtype: 'filemanmessageresponse'
        }
        webSocket.send(JSON.stringify(resp))
    }

    private sendSignalMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, level: SignalMessageLevelEnum, instanceId:string, text:string): void => {
        var resp:ISignalMessage = {
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
        let socket = this.webSockets.find(entry => entry.ws === webSocket)
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
                this.executeDir(webSocket, instance, filemanMessage.params![0])
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
                let srcClusterPath = filemanMessage.params![0]
                let srcHomeDir = srcClusterPath.split('/').slice(0,4).join('/')
                let srcLocalPath = '/' + srcClusterPath.split('/').slice(4,-1).join('/')
                let fname = srcClusterPath.split('/').slice(-1)[0]
                let [srcNamespace,srcPod,srcContainer] = srcHomeDir.split('/').slice(1)

                // console.log(srcHomeDir, srcNamespace, srcPod, srcContainer)
                // console.log(srcLocalPath, fname)
                // console.log(['mv', srcLocalPath+'/'+fname, srcLocalPath+'/'+filemanMessage.params![1]])

                try {
                    let fileInfo = await this.getFileInfo(srcClusterPath)
                    let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['mv', srcLocalPath+'/'+fname, srcLocalPath+'/'+filemanMessage.params![1]])
                    if (result.stderr==='') {
                        this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.CREATE, JSON.stringify({ metadata: { object: srcHomeDir + srcLocalPath + '/' + filemanMessage.params![1], type:fileInfo.type, time:fileInfo.time, size:fileInfo.size }, status: 'Success'}))
                        this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.DELETE, JSON.stringify({ metadata: { object: srcClusterPath }, status: 'Success'}))
                    }
                    else {
                        this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result.stderr)
                    }
                }
                catch (err) {
                    console.log(err)
                }
                return
            }
            case FilemanCommandEnum.CREATE: {
                console.log(`Do CREATE in ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container}`)
                let asset = instance.assets.find (a => a.podNamespace === filemanMessage.namespace && a.podName === filemanMessage.pod && a.containerName === filemanMessage.container)
                if (!asset) {
                    console.log(`Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`)
                    execResponse.data = `Asset ${filemanMessage.namespace}/${filemanMessage.pod}/${filemanMessage.container} not found`
                    return execResponse
                }
                this.executeCreate(webSocket, instance, filemanMessage.params![0])
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
                console.log('(webSocket, filemanMessage.command, instance, filemanMessage.params![0], filemanMessage.params![1])')
                console.log(filemanMessage.command, instance, filemanMessage.params![0], filemanMessage.params![1])
                this.executeCopyOrMove(webSocket, filemanMessage.command, instance, filemanMessage.params![0], filemanMessage.params![1])
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

    private async executeDir (webSocket:WebSocket, instance:IInstance, dir:string) {
        let homeDir = dir.split('/').slice(0,4).join('/')
        let localDir = "/" + dir.split('/').slice(4).join('/')
        let [srcNamespace,srcPod,srcContainer] = homeDir.split('/').slice(1)

        let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['/bin/ls', '-l', localDir])
        if (result.stderr==='') {
            let arr:any[] = []
            ParseListing.parseEntries(result.stdout, (err:any, entryArray:any[]) => { entryArray.map(e => arr.push(e)) })
            arr.map(e => e.name = homeDir + localDir + e.name)
            this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.DIR, JSON.stringify({ metadata: { object: arr }, status: 'Success'}))
        }
        else {
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result.stderr)
        }

    }

    downloadFile = async (srcNamespace:string, srcPod:string, srcContainer:string, remotePath: string, localPath: string) => {
        const writeStream = fs.createWriteStream(localPath);
        let ready=false
        
        await this.clusterInfo.execApi.exec(
            srcNamespace,
            srcPod,
            srcContainer,
            ['cat', remotePath],
            writeStream, 
            process.stderr,   // +++
            null, 
            false, 
            async (status) => {
                writeStream.end()
                writeStream.close()
                while (!writeStream.closed) {
                    await new Promise ( (resolve) => { setTimeout(resolve, 5)})
                }
                ready=true
            }
        )    
        while (!ready) {
            await new Promise ( (resolve) => { setTimeout(resolve, 5)})
        }
    }

    downloadFolder = async (srcNamespace:string, srcPod:string, srcContainer:string, remotePath: string, localPath: string) => {
        const writeStream = fs.createWriteStream(localPath)
        let ready=false

        await this.clusterInfo.execApi.exec(
            srcNamespace,
            srcPod,
            srcContainer,
            ['tar', '-czf', '-', '-C', path.dirname(remotePath), path.basename(remotePath)],
            writeStream,
            process.stderr,  // +++
            null,
            false,
            async (status) => {
                writeStream.end()
                writeStream.close()
                while (!writeStream.closed) {
                    await new Promise ( (resolve) => { setTimeout(resolve, 5)})
                }
                ready=true
            }
        );

        while (!ready) {
            await new Promise ( (resolve) => { setTimeout(resolve, 5)})
        }
    }

    uploadFile = async (ns: string, pod: string, c: string, localPath: string, remotePath: string) => {
        const fs = require('fs')
        const readStream = fs.createReadStream(localPath)

        return new Promise((resolve, reject) => {
            readStream.on('error', (err:any) => {
                console.error('Error al leer el archivo local:', err)
                reject(err)
            })

            let parentFolder = remotePath.split('/').slice(0,-1).join('/').trim()
            let mkdir = `mkdir -p ${parentFolder} ;`
            if (parentFolder === '') mkdir = ''
            console.log('************************')
            console.log(ns, pod, c, ['sh', '-c', `${mkdir} cat > "${remotePath}" && exit`])
            const execPromise = this.clusterInfo.execApi.exec(
                ns,
                pod,
                c,
                ['sh', '-c', `${mkdir} cat > "${remotePath}" && exit`],
                process.stdout,  //+++
                process.stderr,  //+++
                readStream,
                false
            )

            execPromise.then(x => {                
                x.onclose = (event) => { resolve({ metadata: {}, status: 'Success' }) }
                x.onerror = (event) => { reject(new Error(`Upload socket error: ${JSON.stringify(event)}`)) }
            })
            .catch(err => { reject(err) })
        })
    }
    
    private launchCommand (ns:string, pod:string, c:string, cmd:string[]): Promise<{stdout:string, stderr:string}> {
        return new Promise( async (resolve, reject) => {
            let accumulatedOut: Buffer = Buffer.alloc(0)
            let accumulatedErr: Buffer = Buffer.alloc(0)
            let stdout = new Writable({})
            let stderr = new Writable({})
            let stdin = new Readable({ read() {} })
            let shellSocket = await this.clusterInfo.execApi.exec(ns, pod, c, cmd, stdout, stderr, stdin, false, (st) => { console.log('st',st) })
            shellSocket.on('end', () => console.log('end'))
            shellSocket.onmessage = (event) => {
                let data = event.data as Buffer
                if (data[0]===1) accumulatedOut = Buffer.concat([accumulatedOut, data.slice(1)])
                if (data[0]===2) accumulatedErr = Buffer.concat([accumulatedErr, data.slice(1)])
            }
            shellSocket.onclose = (event) => {
                if (accumulatedErr.toString('utf8') !== '') {
                    console.log('************ stderr:' + accumulatedErr.toString('utf8'))
                }
                resolve({ stdout: accumulatedOut.toString('utf8'), stderr: accumulatedErr.toString('utf8') })
            }
            shellSocket.onerror = (event) => {
                console.log('error', event)
                reject('error')
            }
        })
    }    

    clusterCopy = async (srcNamespace:string, srcPod:string, srcContainer:string, srcLocalPath:string, dstNamespace:string, dstPod:string, dstContainer:string, dstLocalPath:string) => {
        const tempLocalFile = `/tmp/${srcNamespace}-${srcPod}-${srcContainer}-${dstNamespace}-${dstPod}-${dstContainer}`
        await this.downloadFile(srcNamespace, srcPod, srcContainer, srcLocalPath, tempLocalFile)
        await this.uploadFile(dstNamespace, dstPod, dstContainer, tempLocalFile, `${dstLocalPath}`)
        try {
            await fs.unlinkSync(tempLocalFile)
        }
        catch(err) {
            console.log('Error removing temp file')
            console.log(err)
        }
    }

    private async getFileInfo(clusterPath:string) {
        let [namespace,pod,container] = clusterPath.split('/').slice(1)
        let localPath = '/' + clusterPath.split('/').slice(4,-1).join('/')
        let fname = clusterPath.split('/').slice(-1)[0]
        let result = await this.launchCommand(namespace, pod, container, ['ls', '-l', localPath])
        let arr :any[] = []
        ParseListing.parseEntries(result.stdout, (err:any, entryArray:any[]) => { entryArray.map(e => arr.push(e)) })
        let srcMetadata = arr.find(e => e.name === fname)
        if (arr.length===0 || !srcMetadata) return undefined
        return srcMetadata
    }
    
    private async executeCopyOrMove (webSocket:WebSocket, operation:FilemanCommandEnum, instance:IInstance, srcClusterPath:string, dstClusterPath:string) {
        if (srcClusterPath.endsWith('/')) srcClusterPath = srcClusterPath.substring(0, srcClusterPath.length-1)
        if (dstClusterPath.endsWith('/')) dstClusterPath = dstClusterPath.substring(0, dstClusterPath.length-1)
        
        let srcHomeDir = srcClusterPath.split('/').slice(0,4).join('/')
        let [srcNamespace,srcPod,srcContainer] = srcHomeDir.split('/').slice(1)
        let srcLocalPath = '/' + srcClusterPath.split('/').slice(4,-1).join('/')

        let p = srcLocalPath.split('/')
        let parent = '/'+p.slice(1).join('/')

        let fname = srcClusterPath.split('/').slice(-1)[0]

        let dstHomeDir = dstClusterPath.split('/').slice(0,4).join('/')
        let [dstNamespace,dstPod,dstContainer] = dstHomeDir.split('/').slice(1)
        let dstLocalPath = '/' + dstClusterPath.split('/').slice(4).join('/')

        let linuxCommand = (operation === FilemanCommandEnum.MOVE? '/bin/mv' : '/bin/cp')

        if (srcHomeDir===dstHomeDir) {
            // copy/move on same container
            console.log([linuxCommand, srcLocalPath+'/'+fname, dstLocalPath])
            let fileInfo = await this.getFileInfo(srcClusterPath)
            let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, [linuxCommand, srcLocalPath+'/'+fname, dstLocalPath])
            if (result.stderr==='') {
                console.log('*****************')
                console.log(dstLocalPath)
                console.log(dstClusterPath)
                console.log(fname)
                this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.CREATE, JSON.stringify({ metadata: { object:dstClusterPath + '/' + fname, type:fileInfo.type, time:fileInfo.time, size:fileInfo.size }, status: 'Success'}))
                if (operation === FilemanCommandEnum.MOVE) this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.DELETE, JSON.stringify({ metadata: { object:srcClusterPath }, status: 'Success'}))
            }
            else
                this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result.stderr)
        }
        else {
            console.log('Perform cluster-wide copy')

            let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['ls', '-l', parent])
            let arr :any[] = []
            ParseListing.parseEntries(result.stdout, (err:any, entryArray:any[]) => { entryArray.map(e => arr.push(e)) })
            let srcMetadata = arr.find(e => e.name === fname)
            if (arr.length===0 || !srcMetadata) {
                console.log('**********NO CONTENT************ >', fname)
                console.log(arr)
                return
            }

            // 0-file, 1-dir, 2-symlink
            switch(srcMetadata.type) {
                case 0:
                    console.log('file')
                    await this.clusterCopy(srcNamespace, srcPod, srcContainer, srcLocalPath + fname, dstNamespace, dstPod, dstContainer, dstLocalPath + fname)
                    break
                case 1:
                    let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['ls', '-l', srcLocalPath + fname])
                    let fileList:any[] = []
                    ParseListing.parseEntries(result.stdout, (err:any, entryArray:any[]) => { entryArray.map(e => fileList.push(e)) })
                    for (var e of fileList) {
                        if (e.type===0) {
                            console.log('dirfile')
                            await this.clusterCopy(srcNamespace, srcPod, srcContainer, srcLocalPath + fname+'/'+e.name, dstNamespace, dstPod, dstContainer, dstLocalPath + fname+'/'+e.name)
                        }
                        if (e.type===1) {
                            console.log('dirdir')
                            await this.executeCopyOrMove(webSocket, operation, instance, srcHomeDir+srcLocalPath+fname+'/'+e.name, dstHomeDir+dstLocalPath+fname)
                        }
                        if (e.type===2) {
                            console.log('dirlink')
                            await this.clusterCopy(srcNamespace, srcPod, srcContainer, srcLocalPath + fname + '/' + e.target, dstNamespace, dstPod, dstContainer, dstLocalPath + fname + '/'+e.name)
                        }
                    }
                    break
                case 2:
                    console.log('link')
                    await this.clusterCopy(srcNamespace, srcPod, srcContainer, srcMetadata.target, dstNamespace, dstPod, dstContainer, dstLocalPath + fname)
                    break
                default:
                    //+++
                    break
            }
        }
    }
    
    private async executeDelete (webSocket:WebSocket, instance:IInstance, id:string, srcPath:string) {
        let srcHomeDir = srcPath.split('/').slice(0,4).join('/')
        let srcLocalPath = '/' + srcPath.split('/').slice(4).join('/')
        let [srcNamespace,srcPod,srcContainer] = srcHomeDir.split('/').slice(1)

        console.log('srcHomeDir, srcLocalPath')
        console.log(srcHomeDir, srcLocalPath)

        let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['/bin/rm', '-r', srcLocalPath])
        if (result.stderr==='')
            this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.DELETE, JSON.stringify({ metadata: { object:srcPath, type:0 }, status: 'Success'}))
        else
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result.stderr)
    }

    private async executeCreate (webSocket:WebSocket, instance:IInstance, srcPath:string) {
        let srcHomeDir = srcPath.split('/').slice(0,4).join('/')
        let srcLocalPath = '/' + srcPath.split('/').slice(4).join('/')

        let [srcNamespace,srcPod,srcContainer] = srcHomeDir.split('/').slice(1)
        let result = await this.launchCommand(srcNamespace, srcPod, srcContainer, ['/bin/mkdir', srcLocalPath])
        if (result.stderr==='')
            this.sendUnsolMessage(webSocket, instance.instanceId, FilemanCommandEnum.CREATE, JSON.stringify({ metadata: { object:srcPath, type:1, time:Date.now(), size:4096 }, status: 'Success'}))
        else
            this.sendSignalMessage(webSocket, InstanceMessageActionEnum.COMMAND, InstanceMessageFlowEnum.RESPONSE, SignalMessageLevelEnum.ERROR, instance.instanceId, result.stderr)
    }

    // private checkAssetScope = (instance:IInstance, asset: IAsset, scope: string) => {
    //     let resources = parseResources (instance.accessKey.resources)
    //     let requiredLevel = this.getChannelScopeLevel(scope)
    //     // +++ AuthorizationManagemetn must be provided as a service to the channel
    //     let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel) && AuthorizationManagement.checkResource(r, asset.podNamespace, asset.podName, asset.containerName))
    //     return canPerform
    // }

}

export { FilemanChannel }