import { ChannelCapabilities, IChannel, InstanceConfig, InstanceConfigActionEnum, InstanceConfigChannelEnum, InstanceConfigFlowEnum, InstanceMessage, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common';
import * as stream from 'stream'
import WebSocket from 'ws'
import { PassThrough } from 'stream'; 
import { ClusterInfo } from '../model/ClusterInfo';

enum AlertSeverityEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}

interface AlertMessage extends InstanceMessage {
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

    getCapabilities(): ChannelCapabilities {
        return {
            pauseable: false,
            modifyable: false,
            reconnectable: false
        }
    }
    
    sendAlert = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, line:string, instanceId: string): void => {
        // line includes timestam at front (beacuse of log stream configuration at startup)
        var i = line.indexOf(' ')
        var msg:AlertMessage = {
            namespace: podNamespace,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            pod: podName,
            container: containerName,
            channel: InstanceConfigChannelEnum.ALERT,
            text: line.substring(i+1),
            timestamp: new Date(line.substring(0,i)),
            severity: alertSeverity
        }
        webSocket.send(JSON.stringify(msg))   
    }

    processAlertSeverity = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, regexes:RegExp[], line:string, instaceId:string): void => {
        for (var regex of regexes) {
            var i = line.indexOf(' ')
            if (regex.test(line.substring(i))) {
                this.sendAlert(webSocket, podNamespace, podName, containerName, alertSeverity, line, instaceId)
            }
        }
    }

    sendAlertData = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, source:string, instanceId:string): void => {
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

    sendInstanceConfigMessage = (ws:WebSocket, action: InstanceConfigActionEnum, flow: InstanceConfigFlowEnum, channel: InstanceConfigChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
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

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            // firstly we convert regex string into RegExp strings
            var regexes: Map<AlertSeverityEnum, RegExp[]> = new Map()

            var regExps: RegExp[] = []
            for (var regStr of instanceConfig.data.regexInfo)
                regExps.push(new RegExp (regStr))
            regexes.set(AlertSeverityEnum.INFO,regExps)

            regExps = []
            for (var regStr of instanceConfig.data.regexWarning)
                regExps.push(new RegExp (regStr))
            regexes.set(AlertSeverityEnum.WARNING,regExps)

            regExps = []
            for (var regStr of instanceConfig.data.regexError)
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
                this.sendAlertData(webSocket, podNamespace, podName, containerName, text, instanceConfig.instance)
            })

            if (!this.websocketAlerts.get(webSocket)) this.websocketAlerts.set(webSocket, [])
                this.websocketAlerts.get(webSocket)?.push ({ instanceId: instanceConfig.instance, working:true, paused:false, logStream:logStream, regExps: regexes })   

            var kubernetesStreamConfig = {
                follow: true, 
                pretty: false, 
                timestamps: true
            }
            console.log('start streaming', podNamespace, podName, containerName)
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, logStream,  kubernetesStreamConfig)
        }
        catch (err:any) {
            console.log('Generic error starting pod log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }

    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        if (this.websocketAlerts.get(webSocket)?.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.STOP, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Alert instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

    processModifyInstanceConfig(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceConfigActionEnum): void {
        let alertInstances = this.websocketAlerts.get(webSocket)
        let alertInstance = alertInstances?.find(i => i.instanceId === instanceConfig.instance)
        if (alertInstance) {
            if (action === InstanceConfigActionEnum.PAUSE) {
                alertInstance.paused = true
                this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.PAUSE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Alert paused')
            }
            if (action === InstanceConfigActionEnum.CONTINUE) {
                alertInstance.paused = false
                this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.CONTINUE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Alert continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeConnection(webSocket: WebSocket): void {
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

    containsInstance(instanceId: string): boolean {
        for (var instances of this.websocketAlerts.values()) {
            var exists = instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    updateConnection(webSocket: WebSocket, instanceId: string): boolean {
        for (let [key,value] of this.websocketAlerts.entries()) {
            var exists = value.find(i => i.instanceId === instanceId)
            if (exists) {
                let temp = value
                this.websocketAlerts.delete(key)
                this.websocketAlerts.set(webSocket, value)
                return true
            }
        }
        return false
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