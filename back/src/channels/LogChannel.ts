import { LogMessage, ServiceConfig, ServiceConfigActionEnum, ServiceConfigChannelEnum, ServiceConfigFlowEnum, ServiceMessage, ServiceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common';
import { IChannel } from '../model/IChannel'
import * as stream from 'stream'
import WebSocket from 'ws'
import { PassThrough } from 'stream'; 
import { ClusterInfo } from '../model/ClusterInfo';

class LogChannel implements IChannel {
    clusterInfo : ClusterInfo
    buffer: Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages    
    websocketLog:Map<WebSocket, {instanceId:string, logStream:PassThrough, timestamps: boolean, previous:boolean, tailLines:number, paused:boolean }[]>= new Map()  
 
    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    sendServiceConfigMessage = (ws:WebSocket, action:ServiceConfigActionEnum, flow: ServiceConfigFlowEnum, channel: ServiceConfigChannelEnum, serviceConfig:ServiceConfig, text:string) => {
        var resp:any = {
            action,
            flow,
            channel,
            instance: serviceConfig.instance,
            type: 'signal',
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, serviceConfig: ServiceConfig) {
        var sgnMsg:SignalMessage = {
            level,
            channel: serviceConfig.channel,
            instance: serviceConfig.instance,
            type: ServiceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }

    sendLogData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName: string, source:string, instanceId:string) => {
        var instances = this.websocketLog.get(webSocket)
        if (!instances) {
            console.log('No instances found for sendLogData')
            return
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendLogData instance ${instanceId}`)
            return
        }

        if (instance.paused) return

        const logLines = source.split('\n')
        var msg:LogMessage = {
            namespace: podNamespace,
            instance: instanceId,
            type: ServiceMessageTypeEnum.DATA,
            pod: podName,
            container: containerName,
            channel: ServiceConfigChannelEnum.LOG,
            text: '',
        }
        for (var line of logLines) {
            if (line.trim() !== '') {
                msg.text=line
                webSocket.send(JSON.stringify(msg))   
            }
        }
    }
    
    async startInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${serviceConfig.instance} (view: ${serviceConfig.view})`)
        try {
            var streamConfig = { 
                follow: true, 
                pretty: false, 
                timestamps: serviceConfig.data.timestamp,
                previous: Boolean(serviceConfig.data.previous),
                tailLines: serviceConfig.data.maxMessages
            }
    
            const logStream:PassThrough = new stream.PassThrough()
            logStream.on('data', (chunk:any) => {
                var text:string=chunk.toString('utf8')
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
                this.sendLogData(webSocket, podNamespace, podName, containerName, text, serviceConfig.instance)
            })
    
            if (!this.websocketLog.get(webSocket)) this.websocketLog.set(webSocket, [])

            this.websocketLog.get(webSocket)?.push ({
                instanceId: serviceConfig.instance, 
                logStream: logStream,
                timestamps: serviceConfig.data.timestamp,
                previous: serviceConfig.data.previous,
                tailLines: serviceConfig.data.tailLines,
                paused:false
            })
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, logStream,  streamConfig)
        }
        catch (err:any) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, serviceConfig)
        }
    }

    stopInstance(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        if (this.websocketLog.get(webSocket)?.find(i => i.instanceId === serviceConfig.instance)) {
            this.removeInstance(webSocket, serviceConfig.instance)
            this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, serviceConfig, 'Log service stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, serviceConfig)
        }
    }

    getServiceScopeLevel(scope: string): number {
        return ['', 'filter', 'view', 'cluster'].indexOf(scope)
    }

    processModifyServiceConfig(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        
    }

    pauseContinueChannel(webSocket: WebSocket, serviceConfig: ServiceConfig, action: ServiceConfigActionEnum): void {
        let logInstances = this.websocketLog.get(webSocket)
        let logInstance = logInstances?.find(i => i.instanceId === serviceConfig.instance)
        if (logInstance) {
            if (action === ServiceConfigActionEnum.PAUSE) {
                logInstance.paused = true
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.PAUSE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALARM, serviceConfig, 'Alarm paused')
            }
            if (action === ServiceConfigActionEnum.CONTINUE) {
                logInstance.paused = false
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.CONTINUE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALARM, serviceConfig, 'Alarm continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.instance} not found`, serviceConfig)
        }
    }

    updateInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, eventType:string, podNamespace:string, podName:string, containerName:string) : void {

    }

    modifyService (webSocket:WebSocket, serviceConfig: ServiceConfig) : void {

    }

    removeService(webSocket: WebSocket): void {
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
                        if (instance.logStream)
                            instance.logStream.removeAllListeners()
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