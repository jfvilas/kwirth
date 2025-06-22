import { LogMessage, InstanceConfig, InstanceMessageChannelEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessage, LogConfig } from '@jfvilas/kwirth-common';
import * as stream from 'stream'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from '../IChannel';

interface IAsset {
    podNamespace:string
    podName:string
    containerName:string
    passThroughStream?:PassThrough
    readableStream?: NodeJS.ReadableStream
    msg:LogMessage   // we use this for avoiding allocating a LogMessage object for each message sent in the passthrough stream (memory optimization)
}        

interface IInstance {
    instanceId:string
    timestamps: boolean
    previous:boolean
    paused:boolean
    isSending:boolean
    assets: IAsset[]
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
    
    getChannelData(): ChannelData {
        return {
            id: 'log',
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
        let resp:InstanceConfigResponse = {
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
        let signalMessage:SignalMessage = {
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

    sendBatch = async (webSocket:WebSocket, asset:IAsset, text:string): Promise<void> => {
        try {
            if (webSocket.bufferedAmount === 0) {
                asset.msg.text = text
                webSocket.send(JSON.stringify(asset.msg))
            } 
            else {
                asset.passThroughStream!.pause()
                const interval = setInterval(() => {
                    if (webSocket.bufferedAmount === 0) {
                        clearInterval(interval)
                        asset.passThroughStream!.resume()
                        asset.msg.text = text
                        webSocket.send(JSON.stringify(asset.msg)) // volver a intentar
                    }
                }, 100)
            }
        }
        catch (err) {
            console.log('sendBatch error for', asset.podNamespace, asset.podName, asset.containerName, err)
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
                    previous: false,
                    paused: false,
                    assets: [],
                    isSending: false
                })
                instance = socket?.instances[len-1]
            }

            let asset:IAsset = {
                podNamespace,
                podName,
                containerName,
                msg: {
                    action: InstanceMessageActionEnum.NONE,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    namespace: podNamespace,
                    instance: instance.instanceId,
                    type: InstanceMessageTypeEnum.DATA,
                    pod: podName,
                    container: containerName,
                    channel: InstanceMessageChannelEnum.LOG,
                    text: '',
                    msgtype: 'logmessage'
                }
            }
            let container = this.clusterInfo.dockerApi.getContainer(id)
            asset.readableStream =  await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: (instanceConfig.data as LogConfig).timestamp as boolean,
                ...((instanceConfig.data as LogConfig).fromStart? {} : {since: Date.now()-1800})
            })

            asset.readableStream.setEncoding('utf8')
            asset.readableStream.on('data', async chunk => this.sendBatch(webSocket, asset, chunk) )
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
                    previous: false,
                    paused:false,
                    assets:[],
                    isSending: false
                })
                instance = socket?.instances[len-1]
            }
            
            const logStream:PassThrough = new stream.PassThrough()
            let asset:IAsset = {
                podNamespace,
                podName,
                containerName,
                passThroughStream: logStream,
                msg: {
                    action: InstanceMessageActionEnum.NONE,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    namespace: podNamespace,
                    instance: instance.instanceId,
                    type: InstanceMessageTypeEnum.DATA,
                    pod: podName,
                    container: containerName,
                    channel: InstanceMessageChannelEnum.LOG,
                    text: '',
                    msgtype: 'logmessage'
                }
            }
            instance.assets.push(asset)

            if (!asset.passThroughStream) {
                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Passthrough could not be established', instanceConfig)
                return
            }

            asset.passThroughStream.setEncoding('utf8')

            // pipeline(
            //     asset.passThroughStream, // source data
            //     async function* (source: AsyncIterable<Buffer>) {  // asynchronous generator
            //         for await (const chunk of source) {
            //             asset.msg.text = chunk as any
            //             webSocket.send(JSON.stringify(asset.msg))
            //             await new Promise(resolve => setTimeout(resolve, 10 * instance.assets.length))
            //         }
            //     },
            //     (err: Error | null) => {
            //         if (err) {
            //             console.error('Pipeline error:', err)
            //         }
            //         else {
            //             console.log('Pipeline ended.')
            //         }
            //     }
            // )

            // asset.passThroughStream.on('data', async (chunk) => {
            //     while (webSocket.bufferedAmount > 10000 * instance.assets.length ) {
            //         console.log('pause', webSocket.bufferedAmount)
            //         asset.passThroughStream!.pause()
            //         while (webSocket.bufferedAmount > 0) {
            //             await new Promise(resolve => setTimeout(resolve, 100))
            //         }
            //         asset.passThroughStream!.resume()
            //         console.log('resume', webSocket.bufferedAmount)
            //     }
            //     asset.msg.text = chunk
            //     webSocket.send(JSON.stringify(asset.msg))
            // })    

            // asset.passThroughStream.on('data', async (chunk) => {
            //     asset.passThroughStream!.pause()
            //     asset.msg.text = chunk
            //     webSocket.send(JSON.stringify(asset.msg), () => { asset.passThroughStream!.resume() })
            // })    

            asset.passThroughStream.on('data', async (chunk) => this.sendBatch(webSocket, asset, chunk) )
            
            // asset.passThroughStream.on('data', async (chunk) => {
            //     if (instance.isSending) {
            //         asset.passThroughStream!.pause()
            //         asset.msg.text = chunk
            //         webSocket.send(JSON.stringify(asset.msg))
            //         await new Promise(resolve => setTimeout(resolve, 10 * instance.assets.length))
            //         asset.passThroughStream!.resume()
            //     }
            //     else {
            //         instance.isSending = true
            //         asset.msg.text = chunk
            //         webSocket.send(JSON.stringify(asset.msg))
            //         await new Promise(resolve => setTimeout(resolve, 10 * instance.assets.length))
            //         instance.isSending = false
            //     }
            // })
            let logConfig = instanceConfig.data as LogConfig
            console.log(logConfig)
            let sinceSeconds = logConfig.startTime? Math.max( Math.floor((Date.now() - logConfig.startTime) / 1000), 1) : 1800
            let streamConfig = { 
                follow: true,
                pretty: false,
                timestamps: logConfig.timestamp,
                previous: Boolean(logConfig.previous),
                ...(logConfig.fromStart? {} : {sinceSeconds: sinceSeconds})
            }
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, asset.passThroughStream, streamConfig)
        }
        catch (err) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, (err as any).stack, instanceConfig)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
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
        let socket = this.websocketLog.find(s => s.ws === webSocket)
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
            let instances = socket.instances
            if (instances) {
                let pos = instances.findIndex(t => t.instanceId === instanceId)
                if (pos>=0) {
                    let instance = instances[pos]
                    for (let asset of instance.assets) {
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
            let exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (let instance of entry.instances) {
                    if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
                        for (let asset of instance.assets) {
                            if (asset.readableStream) {
                                asset.readableStream.removeAllListeners('data')
                                asset.readableStream.on('data', (chunk:any) => this.sendBatch(newWebSocket, asset, chunk) )
                            }        
                        }
                    }
                    else if (this.clusterInfo.type === ClusterTypeEnum.KUBERNETES) {
                        for (let asset of instance.assets) {
                            if (asset.passThroughStream) {
                                asset.passThroughStream.removeAllListeners('data')
                                asset.passThroughStream.on('data', (chunk:any) => this.sendBatch(newWebSocket, asset, chunk) )
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