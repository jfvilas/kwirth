import { LogMessage, ServiceConfig, ServiceConfigActionEnum, ServiceConfigChannelEnum, ServiceConfigFlowEnum, ServiceMessage, ServiceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common';
import { IChannel } from '../model/IChannel'
import * as stream from 'stream'
import { PassThrough } from 'stream'; 
import { ClusterInfo } from '../model/ClusterInfo';

class LogChannel implements IChannel {
    clusterInfo : ClusterInfo
    
    buffer: Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages    
    websocketLog:Map<WebSocket, {instanceId:string, logStream:PassThrough, timestamps: boolean, previous:boolean, tailLines:number }[]>= new Map()  
 
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

    sendLogData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName: string, source:string, serviceConfig:ServiceConfig) => {
        const logLines = source.split('\n')
        var msg:LogMessage = {
            namespace: podNamespace,
            instance: serviceConfig.instance,
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
    
    async startChannel (webSocket: WebSocket, serviceConfig: ServiceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
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
                this.sendLogData(webSocket, podNamespace, podName, containerName, text, serviceConfig)
            })
    
            if (!this.websocketLog.get(webSocket))
                this.websocketLog.set(webSocket, [])

            this.websocketLog.get(webSocket)?.push ({
                instanceId: serviceConfig.instance, logStream: logStream,
                timestamps: serviceConfig.data.timestamp,
                previous: serviceConfig.data.previous,
                tailLines: serviceConfig.data.tailLines
            })   

            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, logStream,  streamConfig)
        }
        catch (err) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), serviceConfig)
        }
    }

    // removeAlert = (webSocket:WebSocket, instanceId:string) => {
    //     if (this.websocketAlerts.has(webSocket)) {
    //         var instances = this.websocketAlerts.get(webSocket)
    //         if (instances) {
    //             var instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
    //             while (instanceIndex>=0) {
    //                 if (instanceIndex>=0) {
    //                     var instance = instances[instanceIndex]
    //                     if (instance.logStream)
    //                         instance.logStream.removeAllListeners()
    //                     else
    //                         console.log(`Alarm logStream not found of instance id ${instanceId}`)
    //                     instances.splice(instanceIndex,1)
    //                 }
    //                 else{
    //                     console.log(`Instance ${instanceId} not found, cannot delete alarm`)
    //                 }
    //                 instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
    //             }
    //         }
    //         else {
    //             console.log('There are no alarm Instances on websocket')
    //         }
    //     }
    //     else {
    //         console.log('WebSocket not found on alarms')
    //     }
    // }

    stopChannel(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        if (this.websocketLog.get(webSocket)?.find(i => i.instanceId === serviceConfig.instance)) {
            this.removeInstance(webSocket, serviceConfig.instance)
            this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.LOG, serviceConfig, 'Log service stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey doesn't allow ot there are no instances`, serviceConfig)
        }
    }

    getServiceScopeLevel(scope: string): number {
        // +++ refactor to remove restart & api
        return ['', 'filter', 'view', 'restart', 'api', 'cluster'].indexOf(scope)
    }

    processModifyServiceConfig(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        
    }

    pauseContinueChannel(webSocket: WebSocket, serviceConfig: ServiceConfig, action: ServiceConfigActionEnum): void {
    }

    removeService(webSocket: WebSocket): void {
        // +++ review alerchannel on this precedure
        if (this.websocketLog.get(webSocket)) {
            for (var instance of this.websocketLog?.get(webSocket)!) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            this.websocketLog.delete(webSocket)
        }
        else {
            console.log('WebSocket not found on alarms')
        }
    }

    updateInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, eventType:string, podNamespace:string, podName:string, containerName:string) : void {

    }

    modifyService (webSocket:WebSocket, serviceConfig: ServiceConfig) : void {

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