import { ChannelData, IChannel, InstanceConfig, InstanceConfigActionEnum, InstanceConfigChannelEnum, InstanceConfigFlowEnum, InstanceMessage, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import * as stream from 'stream'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../model/ClusterInfo'

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
    regExps: Map<AlertSeverityEnum, RegExp[]>
    timestamps: boolean,
    previous:boolean,
    tailLines:number,
    paused:boolean
}

enum AlertSeverityEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}

interface AlertMessage extends InstanceMessage {
    timestamp?: Date
    severity: AlertSeverityEnum
    text: string
}

class AlertChannel implements IChannel {    
    clusterInfo : ClusterInfo
    websocketAlert: {
        ws:WebSocket,
        instances: IInstance[] 
    }[] = []

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData(): ChannelData {
        return {
            id: 'alert',
            pauseable: true,
            modifyable: false,
            reconnectable: true
        }
    }

    containsInstance(instanceId: string): boolean {
        for (let socket of this.websocketAlert) {
            console.log('search socket')
            console.log('instances', socket.instances)
            let exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        console.log('socket not found in alert')
        return false
    }

    // +++ sendInstanceConfigMessage & sendChannelSignal are very similar: only one can live!!
    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceConfigActionEnum, flow: InstanceConfigFlowEnum, channel: InstanceConfigChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
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
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }

    sendAlert = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, line:string, instanceId: string): void => {
        // line includes timestamp at front (beacuse of log stream configuration when starting logstream)
        var i = line.indexOf(' ')
        var alertMessage:AlertMessage = {
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
        webSocket.send(JSON.stringify(alertMessage))   
    }

    processAlertSeverity = (webSocket:WebSocket, asset:IAsset, alertSeverity:AlertSeverityEnum, regexes:RegExp[], line:string, instaceId:string): void => {
        for (var regex of regexes) {
            var i = line.indexOf(' ')
            if (regex.test(line.substring(i))) {
                this.sendAlert(webSocket, asset.podNamespace, asset.podName, asset.containerName, alertSeverity, line, instaceId)
            }
        }
    }

    sendAlertLines = (webSocket:WebSocket, instanceId:string, asset:IAsset, text:string): boolean => {
        var socket = this.websocketAlert.find(s => s.ws === webSocket)
        if (!socket) {
            return false
        }

        let instances = socket.instances
        if (!instances) {
            console.log('No instances found for sendAlertData')
            return false
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendAlertData instance ${instanceId}`)
            return false
        }

        if (instance.paused) return true

        const logLines = text.split('\n')
        for (var line of logLines) {
            if (line.trim() !== '') {
                this.processAlertSeverity(webSocket, asset, AlertSeverityEnum.INFO, instance.regExps.get(AlertSeverityEnum.INFO)!, line, instanceId)
                this.processAlertSeverity(webSocket, asset, AlertSeverityEnum.WARNING, instance.regExps.get(AlertSeverityEnum.WARNING)!, line, instanceId)
                this.processAlertSeverity(webSocket, asset, AlertSeverityEnum.ERROR, instance.regExps.get(AlertSeverityEnum.ERROR)!, line, instanceId)
            }
        }
        return true
    }

    sendBlock (webSocket: WebSocket, instanceId: string, asset: IAsset, text:string)  {
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
        if (! this.sendAlertLines(webSocket, instanceId, asset, text)) {
            // we do nothing, cause if there is an error maybe client reconnects later
        }
    }

    async startDockerStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string, regExps: Map<AlertSeverityEnum, RegExp[]>): Promise<void> {
        try {
            let id = await this.clusterInfo.dockerTools.getContainerId(podName, containerName)
            if (!id) {
                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Cannot obtain Id for container ${podName}/${containerName}`,instanceConfig)
                return
            }
                             
            let socket = this.websocketAlert.find(s => s.ws === webSocket)
            if (!socket) {
                let len = this.websocketAlert.push( {ws:webSocket, instances:[]} )
                socket = this.websocketAlert[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance, 
                    regExps,
                    timestamps: instanceConfig.data.timestamp,
                    previous: false,  // +++ previous must be reviewed
                    tailLines: instanceConfig.data.tailLines,
                    paused:false,
                    assets:[]
                })
                instance = socket?.instances[len-1]
            }
            
            let asset:IAsset = {
                podNamespace,
                podName,
                containerName: '',
                buffer: ''
            }
            instance.assets.push( asset )

            let container = this.clusterInfo.dockerApi.getContainer(id)
            asset.readableStream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: instanceConfig.data.timestamp as boolean,
                ...(instanceConfig.data.fromStart? {} : {since: Date.now()-1800})
            })
            asset.readableStream.on('data', chunk => {
                var text:string=chunk.toString('utf8')
                this.sendBlock(webSocket, instanceConfig.instance, asset, text)
                if (global.gc) global.gc()
            })
        }
        catch (err:any) {
            console.log('Generic error starting docker pod alert log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startKubernetesStream (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string, regExps:Map<AlertSeverityEnum, RegExp[]>): Promise<void> {
        try {
            let socket = this.websocketAlert.find(s => s.ws === webSocket)
            if (!socket) {
                let len = this.websocketAlert.push( {ws:webSocket, instances:[]} )
                socket = this.websocketAlert[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance,
                    regExps,
                    timestamps: instanceConfig.data.timestamp,
                    previous: false,  // +++ previous support must be reviewed
                    tailLines: instanceConfig.data.tailLines,
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
            instance.assets.push( asset )

            asset.passThroughStream = new stream.PassThrough()
            asset.passThroughStream.on('data', chunk => {
                var text:string=chunk.toString('utf8')
                this.sendBlock(webSocket, instanceConfig.instance, asset, text)
                if (global.gc) global.gc()
            })

            let streamConfig = { 
                follow: true, 
                pretty: false,
                timestamps: instanceConfig.data.timestamp,
                previous: Boolean(instanceConfig.data.previous),
                ...(instanceConfig.data.fromStart? {} : {sinceSeconds:1800})
            }
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, asset.passThroughStream, streamConfig)
        }
        catch (err:any) {
            console.log('Generic error starting pod alert log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    updateConnection(newWebSocket: WebSocket, instanceId: string): boolean {
        for (let entry of this.websocketAlert) {
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
                                        this.sendBlock(newWebSocket, instance.instanceId, asset, text)
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
                                        this.sendBlock(newWebSocket, instance.instanceId, asset, text)
                                    }
                                    catch (err) {
                                        console.log(err)
                                    }
                                })
                            }
                        }
                    }
                    else {
                        console.log('Unsuppoprted source')
                    }            
                }
                return true
            }
        }
        return false
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let regexes: Map<AlertSeverityEnum, RegExp[]> = new Map()

        let regExps: RegExp[] = []
        for (let regStr of instanceConfig.data.regexInfo)
            regExps.push(new RegExp (regStr))
        regexes.set(AlertSeverityEnum.INFO, regExps)

        regExps = []
        for (let regStr of instanceConfig.data.regexWarning)
            regExps.push(new RegExp (regStr))
        regexes.set(AlertSeverityEnum.WARNING, regExps)

        regExps = []
        for (let regStr of instanceConfig.data.regexError)
            regExps.push(new RegExp (regStr))
        regexes.set(AlertSeverityEnum.ERROR, regExps)

        if (this.clusterInfo.type === ClusterTypeEnum.DOCKER) {
            this.startDockerStream(webSocket, instanceConfig, podNamespace, podName, containerName, regexes)
        }
        else if (this.clusterInfo.type === ClusterTypeEnum.KUBERNETES) {
            this.startKubernetesStream(webSocket, instanceConfig, podNamespace, podName, containerName, regexes)
        }
        else {
            console.log('Unsuppoprted source')
        }
    }

    stopInstance(webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let socket = this.websocketAlert.find(s => s.ws === webSocket)
        if (!socket) return

        if (socket.instances.find(i => i.instanceId === instanceConfig.instance)) {
            this.removeInstance(webSocket, instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.STOP, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Log instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceConfigActionEnum): void {
        var socket = this.websocketAlert.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('No socket found for pci')
            return
        }
        let instances = socket.instances

        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceConfigActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceConfigActionEnum.PAUSE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Alert paused')
            }
            if (action === InstanceConfigActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket, InstanceConfigActionEnum.CONTINUE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.ALERT, instanceConfig, 'Alert continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.websocketAlert.find(s => s.ws === webSocket)
        if (socket) {
            for (let instance of socket.instances) {
                this.removeInstance (webSocket, instance.instanceId)
            }
            let pos = this.websocketAlert.findIndex(s => s.ws === webSocket)
            this.websocketAlert.splice(pos,1)
        }
        else {
            console.log('WebSocket not found on alerts for remove')
        }
    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.websocketAlert.find(s => s.ws === webSocket)
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
                            console.log(`Alert stream not found of instance id ${instanceId} and asset ${asset.podNamespace}/${asset.podName}/${asset.containerName}`)
                    }
                    instances.splice(pos,1)
                }
                else {
                    console.log(`Instance ${instanceId} not found, cannot delete`)
                }
            }
            else {
                console.log('There are no alert instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on alerts')
        }
    }

}

export { AlertChannel }