import { LogMessage, InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, LogConfig } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import * as stream from 'stream'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from './IChannel';

interface IAsset {
    podNamespace:string,
    podName:string,
    containerName:string,
    passThroughStream?:PassThrough,
    readableStream?: NodeJS.ReadableStream,
    buffer: string
}        

interface IInstance {
    instanceId:string, 
    assets: IAsset[]
    timestamps: boolean,
    previous:boolean,
    //tailLines:number,
    paused:boolean
}

class LogChannel implements IChannel {
    
    clusterInfo : ClusterInfo
    websocketLog: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    async processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> {
        return false
    }
    
    async processRoute (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> {
        return false
    }

    getChannelData(): ChannelData {
        return {
            id: 'log',
            immediatable: false,
            routable: false,
            pauseable: true,
            modifyable: false,
            reconnectable: true,
            sources: [ SourceEnum.DOCKER, SourceEnum.KUBERNETES ],
            metrics: false
        }
    }

    containsInstance(instanceId: string): boolean {
        for (let socket of this.websocketLog) {
            let exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, channel: InstanceMessageChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
        var resp:InstanceConfigResponse = {
            action,
            flow,
            channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig): void {
        var signalMessage:SignalMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.RESPONSE,
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }

    sendLogLines = (webSocket:WebSocket, instanceId:string,  asset: IAsset, text:string, stripHeader:boolean): boolean => {
        let socket = this.websocketLog.find(entry => entry.ws === webSocket)

        if (!socket) {
            console.log('No socket found for sendLogLines')
            // perform cleaning
            return false
        }
        let instances = socket.instances

        if (!instances) {
            console.log('No instances found for sendLogLines')
            // perform cleaning
            return false
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendLogLines instance ${instanceId}`)
            return false
        }

        if (instance.paused) return true

        const logLines = text.split('\n')
        var logMessage:LogMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            namespace: asset.podNamespace,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            pod: asset.podName,
            container: asset.containerName,
            channel: InstanceMessageChannelEnum.LOG,
            text: '',
            msgtype: 'logmessage'
        }
        for (var line of logLines) {
            if (line.trim() !== '') {
                if (stripHeader && line.length>=8) line=line.substring(8)
                logMessage.text=line
                webSocket.send(JSON.stringify(logMessage))   
            }
        }
        return true
    }

    sendBlock (webSocket: WebSocket, instanceId: string, asset: IAsset, text:string, stripHeader:boolean)  {
        if (asset.buffer!=='') {
            // if we have some text from a previous incompleted chunk, we prepend it now
            text = asset.buffer + text
            asset.buffer = ''
        }
        if (!text.endsWith('\n')) {
            // it's an incomplete chunk, we cut on the last complete line and store the rest of data for prepending it to next chunk
            var i=text.lastIndexOf('\n')
            var next=text.substring(i)
            asset.buffer = next
            text = text.substring(0,i)
        }
        if (! this.sendLogLines(webSocket, instanceId, asset, text, stripHeader)) {
            // we do nothing, cause if there is an error maybe client reconnects later
        }
    }

    async startDockerStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            let id = await this.clusterInfo.dockerTools.getContainerId(podName, containerName)
            if (!id) {
                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Cannot obtain Id for container ${podName}/${containerName}`,instanceConfig)
                return
            }
                             
            let socket = this.websocketLog.find(s => s.ws === webSocket)
            if (!socket) {
                let len = this.websocketLog.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                socket = this.websocketLog[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance, 
                    timestamps: (instanceConfig.data as LogConfig).timestamp,
                    previous: false,  // +++ previous must be reviewed
                    //tailLines: (instanceConfig.data as LogConfig).tailLines,
                    paused:false,
                    assets:[]
                })
                instance = socket?.instances[len-1]
            }

            let asset:IAsset = {
                podNamespace,
                podName,
                containerName,
                buffer: ''
            }
            let container = this.clusterInfo.dockerApi.getContainer(id)
            asset.readableStream =  await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: (instanceConfig.data as LogConfig).timestamp as boolean,
                ...((instanceConfig.data as LogConfig).fromStart? {} : {since: Date.now()-1800})
            })
            asset.readableStream.on('data', chunk => {
                var text:string=chunk.toString('utf8')
                this.sendBlock(webSocket, instanceConfig.instance, asset, text, true)
                if (global.gc) global.gc()
            })

            instance.assets.push( asset )
        }
        catch (err:any) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startKubernetesStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            let socket = this.websocketLog.find(s => s.ws === webSocket)
            if (!socket) {
                let len = this.websocketLog.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                socket = this.websocketLog[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance, 
                    timestamps: (instanceConfig.data as LogConfig).timestamp,
                    previous: false,  // +++ previous support must be reviewed
                    //tailLines: instanceConfig.data.tailLines,
                    paused:false,
                    assets:[]
                })
                instance = socket?.instances[len-1]
            }
            
            const logStream:PassThrough = new stream.PassThrough()
            let asset = {
                podNamespace,
                podName,
                containerName,
                passThroughStream: logStream,
                buffer: ''
            }
            instance.assets.push( asset )

            asset.passThroughStream.on('data', (chunk) => {
                try {
                    var text:string=chunk.toString('utf8')
                    this.sendBlock(webSocket, instanceConfig.instance, asset, text, false)
                }
                catch (err) {
                    console.log(err)
                }
            })
    
            let streamConfig = { 
                follow: true, 
                pretty: false,
                timestamps: (instanceConfig.data as LogConfig).timestamp,
                previous: Boolean((instanceConfig.data as LogConfig).previous),
                ...((instanceConfig.data as LogConfig).fromStart? {} : {sinceSeconds:1800})
            }
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, asset.passThroughStream, streamConfig)
        }
        catch (err) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, (err as any).stack, instanceConfig)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
            this.startDockerStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
        else {
            this.startKubernetesStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.websocketLog.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'filter', 'view', 'cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        var socket = this.websocketLog.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('No socket found for pci')
            return
        }
        let instances = socket.instances

        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log paused')
            }
            if (action === InstanceMessageActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.CONTINUE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.LOG, instanceConfig, 'Log continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.websocketLog.find(s => s.ws === webSocket)
        if (socket) {
            var instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (var asset of instance.assets) {
                        if (asset.passThroughStream)
                            asset.passThroughStream.removeAllListeners()
                        else
                            console.log(`logStream not found of instance id ${instanceId} and asset ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no log Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on logs')
        }
    }

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.websocketLog.find(s => s.ws === webSocket))
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.websocketLog.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.websocketLog.findIndex(s => s.ws === webSocket)
            this.websocketLog.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on logs for remove')
        }
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.websocketLog.find(s => s.ws === webSocket)
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
        for (let entry of this.websocketLog) {
            var exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (var instance of entry.instances) {
                    if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
                        for (let asset of instance.assets) {
                            if (asset.readableStream) {
                                asset.readableStream.removeAllListeners('data')
                                asset.readableStream.on('data', (chunk:any) => {
                                    try {
                                        var text:string=chunk.toString('utf8')
                                        this.sendBlock(newWebSocket, instance.instanceId, asset, text, false)
                                    }
                                    catch (err) {
                                        console.log(err)
                                    }
                                })    
                            }        
                        }
                    }
                    else if (this.clusterInfo.type === ClusterTypeEnum.KUBERNETES) {
                        console.log('instancefound')
                        for (let asset of instance.assets) {
                            console.log(`found ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)
                            if (asset.passThroughStream) {
                                console.log(`found stream ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)

                                asset.passThroughStream.removeAllListeners('data')
                                asset.passThroughStream.on('data', (chunk:any) => {
                                    try {
                                        var text:string=chunk.toString('utf8')
                                        this.sendBlock(newWebSocket, instance.instanceId, asset, text, false)
                                    }
                                    catch (err) {
                                        console.log(err)
                                    }
                                })
                            }
                        }
                    }
                }
                return true
            }
        }
        return false
    }

}

export { LogChannel }