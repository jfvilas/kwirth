import { ChannelCapabilities, IChannel, LogMessage, InstanceConfig, InstanceConfigActionEnum, InstanceConfigChannelEnum, InstanceConfigFlowEnum, InstanceMessage, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import * as stream from 'stream'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../model/ClusterInfo'
import * as crypto from 'crypto'

class LogChannel implements IChannel {
    clusterInfo : ClusterInfo
    buffer: Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages    
    websocketLog:Map<WebSocket, {instanceId:string, passThrouoghStream?:PassThrough, readableStream?: NodeJS.ReadableStream, timestamps: boolean, previous:boolean, tailLines:number, paused:boolean }[]>= new Map()  
 
    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getCapabilities(): ChannelCapabilities {
        return {
            pauseable: true,
            modifyable: false,
            reconnectable: false
        }
    }

    containsInstance(instanceId: string): boolean {
        for (var instances of this.websocketLog.values()) {
            var exists = instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    updateConnection(webSocket: WebSocket, instanceId: string): boolean {
        for (let [key,value] of this.websocketLog.entries()) {
            var exists = value.find(i => i.instanceId === instanceId)
            if (exists) {
                let temp = value
                this.websocketLog.delete(key)
                this.websocketLog.set(webSocket, value)
                return true
            }
        }
        return false
    }

    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceConfigActionEnum, flow: InstanceConfigFlowEnum, channel: InstanceConfigChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
        var resp:any = {
            action,
            flow,
            channel,
            instance: instanceConfig.instance,
            type: 'signal',
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig): void {
        var sgnMsg:SignalMessage = {
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }

    sendLogData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName: string, source:string, instanceId:string, stripHeader:boolean): boolean => {
        var instances = this.websocketLog.get(webSocket)
        if (!instances) {
            console.log('No instances found for sendLogData')
            // perform cleaning
            return false
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendLogData instance ${instanceId}`)
            return false
        }

        if (instance.paused) return true

        const logLines = source.split('\n')
        var msg:LogMessage = {
            namespace: podNamespace,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            pod: podName,
            container: containerName,
            channel: InstanceConfigChannelEnum.LOG,
            text: '',
        }
        for (var line of logLines) {
            if (line.trim() !== '') {
                //if (line.length<7) console.log(line, line.length)
                if (stripHeader && line.length>=8) line=line.substring(8)
                msg.text=line
                webSocket.send(JSON.stringify(msg))   
            }
        }
        return true
    }

    sendBlock (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string, text:string, stripHeader:boolean)  {
        if (this.buffer.get(webSocket)!==undefined) {
            // if we have some text from a previous incompleted chunk, we prepend it now
            text=this.buffer.get(webSocket)+text
            this.buffer.delete(webSocket)
        }
        if (!text.endsWith('\n')) {
            // it's an incomplete chunk, we cut on the last complete line and store the rest of data for prepending it to next chunk
            var i=text.lastIndexOf('\n')
            var next=text.substring(i)
            this.buffer.set(webSocket,next)
            text=text.substring(0,i)
        }
        if (! this.sendLogData(webSocket, podNamespace, podName, containerName, text, instanceConfig.instance, stripHeader)) {
            this.removeInstance(webSocket, instanceConfig.instance)
        }
    }

    async startDockerStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            // if (podName!=='$docker') {
            let id = await this.clusterInfo.dockerTools.getContainerId(podName, containerName)
            // }
            if (!id) {
                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Cannot obtain Id for container ${podName}/${containerName}`,instanceConfig)
                return
            }
            
            let container = this.clusterInfo.dockerApi.getContainer(id)
            const logStream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: instanceConfig.data.timestamp as boolean,
                ...(instanceConfig.data.fromStart? {} : {since: Date.now()-1800})
            })
          
            logStream.on('data', chunk => {
                var text:string=chunk.toString('utf8')
                this.sendBlock(webSocket, instanceConfig, podNamespace, podName, containerName, text, true)
                if (global.gc) global.gc()
            })
        
            if (!this.websocketLog.get(webSocket)) this.websocketLog.set(webSocket, [])
            this.websocketLog.get(webSocket)?.push ({
                instanceId: instanceConfig.instance, 
                readableStream: logStream,
                timestamps: instanceConfig.data.timestamp,
                //previous: instanceConfig.data.previous,
                previous: false,
                tailLines: instanceConfig.data.tailLines,
                paused:false
            })    
        }
        catch (err:any) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startKubernetesStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            var streamConfig = { 
                follow: true, 
                pretty: false,
                timestamps: instanceConfig.data.timestamp,
                previous: Boolean(instanceConfig.data.previous),
                ...(instanceConfig.data.fromStart? {} : {sinceSeconds:1800})
            }
    
            const logStream:PassThrough = new stream.PassThrough()
            logStream.on('data', (chunk:any) => {
                var text:string=chunk.toString('utf8')
                this.sendBlock(webSocket, instanceConfig, podNamespace, podName, containerName, text, false)
            })
    
            if (!this.websocketLog.get(webSocket)) this.websocketLog.set(webSocket, [])

            this.websocketLog.get(webSocket)?.push ({
                instanceId: instanceConfig.instance, 
                passThrouoghStream: logStream,
                timestamps: instanceConfig.data.timestamp,
                //previous: instanceConfig.data.previous,
                previous: false,
                tailLines: instanceConfig.data.tailLines,
                paused:false
            })
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, logStream,  streamConfig)
        }
        catch (err:any) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} (view: ${instanceConfig.view})`)

        if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
            this.startDockerStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
        else {
            this.startKubernetesStream(webSocket, instanceConfig, podNamespace, podName, containerName)
        }
    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        if (this.websocketLog.get(webSocket)?.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.STOP, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.LOG, instanceConfig, 'Log instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['', 'filter', 'view', 'cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceConfigActionEnum): void {
        let logInstances = this.websocketLog.get(webSocket)
        let logInstance = logInstances?.find(i => i.instanceId === instanceConfig.instance)
        if (logInstance) {
            if (action === InstanceConfigActionEnum.PAUSE) {
                logInstance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceConfigActionEnum.PAUSE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALARM, instanceConfig, 'Alarm paused')
            }
            if (action === InstanceConfigActionEnum.CONTINUE) {
                logInstance.paused = false
                this.sendInstanceConfigMessage(webSocket, InstanceConfigActionEnum.CONTINUE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALARM, instanceConfig, 'Alarm continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeConnection(webSocket: WebSocket): void {
        if (this.websocketLog.get(webSocket)) {
            for (var instance of this.websocketLog?.get(webSocket)!) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            this.websocketLog.delete(webSocket)
        }
        else {
            console.log('WebSocket not found on logs')
        }
    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        if (this.websocketLog.has(webSocket)) {
            var instances = this.websocketLog.get(webSocket)
            if (instances) {
                var instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                while (instanceIndex>=0) {
                    if (instanceIndex>=0) {
                        var instance = instances[instanceIndex]
                        if (instance.passThrouoghStream)
                            instance.passThrouoghStream.removeAllListeners()
                        else
                            console.log(`Alarm logStream not found of instance id ${instanceId}`)
                        instances.splice(instanceIndex,1)
                    }
                    else{
                        console.log(`Instance ${instanceId} not found, cannot delete alarm`)
                    }
                    instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                }
            }
            else {
                console.log('There are no alarm Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on logs')
        }
    }
}

export { LogChannel }