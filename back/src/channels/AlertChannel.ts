import { ServiceConfig, ServiceConfigActionEnum, ServiceConfigChannelEnum, ServiceConfigFlowEnum, ServiceMessage, ServiceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common';
import { IChannel } from '../model/IChannel'
import * as stream from 'stream'
import WebSocket from 'ws'
import { PassThrough } from 'stream'; 
import { ClusterInfo } from '../model/ClusterInfo';

enum AlertSeverityEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}

interface AlertMessage extends ServiceMessage {
    timestamp?: Date;
    severity: AlertSeverityEnum;
    text: string;
}

class AlertChannel implements IChannel {
    clusterInfo : ClusterInfo
    
    buffer: Map<WebSocket,string>= new Map()  // used for incomplete buffering log messages
    websocketAlerts:Map<WebSocket, {instanceId:string, logStream:PassThrough, working:boolean, paused:boolean, regExps:Map<AlertSeverityEnum, RegExp[]>} []> = new Map()  // list of intervals (and its associated metrics) that produce metrics streams
 
    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    sendAlert = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, line:string, instanceId: string) => {
        // line includes timestam at front (beacuse of log stream configuration at startup)
        var i = line.indexOf(' ')
        var msg:AlertMessage = {
            namespace: podNamespace,
            instance: instanceId,
            type: ServiceMessageTypeEnum.DATA,
            pod: podName,
            container: containerName,
            channel: 'alert' as ServiceConfigChannelEnum,  //+++ repair this, channel must be string
            text: line.substring(i+1),
            timestamp: new Date(line.substring(0,i)),
            severity: alertSeverity
        }
        webSocket.send(JSON.stringify(msg))   
    }

    processAlertSeverity = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, regexes:RegExp[], line:string, instaceId:string) => {
        for (var regex of regexes) {
            var i = line.indexOf(' ')
            if (regex.test(line.substring(i))) {
                this.sendAlert(webSocket, podNamespace, podName, containerName, alertSeverity, line, instaceId)
            }
        }
    }

    sendAlertData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, source:string, instanceId:string) => {
        var instances = this.websocketAlerts.get(webSocket)
        if (!instances) {
            console.log('No instances found for sendAlertData')
            return
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendAlertData instance ${instanceId}`)
            return
        }

        if (instance.paused) return

        const logLines = source.split('\n')
        for (var line of logLines) {
            if (line.trim() !== '') {
                this.processAlertSeverity(webSocket, podNamespace, podName, containerName, AlertSeverityEnum.INFO, instance.regExps.get(AlertSeverityEnum.INFO)!, line, instanceId)
                this.processAlertSeverity(webSocket, podNamespace, podName, containerName, AlertSeverityEnum.WARNING, instance.regExps.get(AlertSeverityEnum.WARNING)!, line, instanceId)
                this.processAlertSeverity(webSocket, podNamespace, podName, containerName, AlertSeverityEnum.ERROR, instance.regExps.get(AlertSeverityEnum.ERROR)!, line, instanceId)
            }
        }
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

    async startChannel (webSocket: WebSocket, serviceConfig: ServiceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            // firstly we convert regex string into RegExp strings
            var regexes: Map<AlertSeverityEnum, RegExp[]> = new Map()

            var regExps: RegExp[] = []
            for (var regStr of serviceConfig.data.regexInfo)
                regExps.push(new RegExp (regStr))
            regexes.set(AlertSeverityEnum.INFO,regExps)

            regExps = []
            for (var regStr of serviceConfig.data.regexWarning)
                regExps.push(new RegExp (regStr))
            regexes.set(AlertSeverityEnum.WARNING,regExps)

            regExps = []
            for (var regStr of serviceConfig.data.regexError)
                regExps.push(new RegExp (regStr))
            regexes.set(AlertSeverityEnum.ERROR,regExps)

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
                this.sendAlertData(webSocket, podNamespace, podName, containerName, text, serviceConfig.instance)
            })

            if (!this.websocketAlerts.get(webSocket)) this.websocketAlerts.set(webSocket, [])
                this.websocketAlerts.get(webSocket)?.push ({ instanceId: serviceConfig.instance, working:true, paused:false, logStream:logStream, regExps: regexes })   

            var kubernetesStreamConfig = {
                follow: true, 
                pretty: false, 
                timestamps: true
            }
            console.log('start streaming', podNamespace, podName, containerName)
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, logStream,  kubernetesStreamConfig)
        }
        catch (err) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, JSON.stringify(err), serviceConfig)
        }

    }

    stopChannel(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        if (this.websocketAlerts.get(webSocket)?.find(i => i.instanceId === serviceConfig.instance)) {
            //this.removeAlert(webSocket,serviceConfig.instance)
            this.removeInstance(webSocket, serviceConfig.instance)
            this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALERT, serviceConfig, 'Alert service stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Access denied: your accesskey doesn't allow ot there are no instances`, serviceConfig)
        }
    }

    getServiceScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

    processModifyServiceConfig(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        
    }

    pauseContinueChannel(webSocket: WebSocket, serviceConfig: ServiceConfig, action: ServiceConfigActionEnum): void {
        let alertInstances = this.websocketAlerts.get(webSocket)
        let alertInstance = alertInstances?.find(i => i.instanceId === serviceConfig.instance)
        if (alertInstance) {
            if (action === ServiceConfigActionEnum.PAUSE) {
                alertInstance.paused = true
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.PAUSE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALERT, serviceConfig, 'Alert paused')
            }
            if (action === ServiceConfigActionEnum.CONTINUE) {
                alertInstance.paused = false
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.CONTINUE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.ALERT, serviceConfig, 'Alert continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.instance} not found`, serviceConfig)
        }
    }

    removeService(webSocket: WebSocket): void {
        if (this.websocketAlerts.get(webSocket)) {
            for (var instance of this.websocketAlerts?.get(webSocket)!) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            this.websocketAlerts.delete(webSocket)
        }
        else {
            console.log('WebSocket not found on alerts')
        }

    }

    updateInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, eventType:string, podNamespace:string, podName:string, containerName:string) : void {

    }

    modifyService (webSocket:WebSocket, serviceConfig: ServiceConfig) : void {

    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        if (this.websocketAlerts.has(webSocket)) {
            var instances = this.websocketAlerts.get(webSocket)
            if (instances) {
                var instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                while (instanceIndex>=0) {
                    if (instanceIndex>=0) {
                        var instance = instances[instanceIndex]
                        if (instance.logStream)
                            instance.logStream.removeAllListeners()
                        else
                            console.log(`Alert logStream not found of instance id ${instanceId}`)
                        instances.splice(instanceIndex,1)
                    }
                    else{
                        console.log(`Instance ${instanceId} not found, cannot delete alert`)
                    }
                    instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                }
            }
            else {
                console.log('There are no alerts Instances on websocket')
            }
        }
        else {
            console.log(`WebSocket for instance ${instanceId} not found on alerts`)
        }
    }
}

export { AlertChannel }