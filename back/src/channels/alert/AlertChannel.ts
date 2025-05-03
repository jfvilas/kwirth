import { InstanceConfig, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, ClusterTypeEnum, InstanceConfigResponse, AlertSeverityEnum, AlertMessage, InstanceMessage, AlertConfig, RouteMessageResponse } from '@jfvilas/kwirth-common';
import WebSocket from 'ws'
import * as stream from 'stream'
import { PassThrough } from 'stream'
import { ClusterInfo } from '../../model/ClusterInfo'
import { ChannelData, IChannel, SourceEnum } from '../IChannel';

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
    //timestamps: boolean,
    //previous:boolean,
    //tailLines:number,
    paused:boolean
}

class AlertChannel implements IChannel {    
    clusterInfo : ClusterInfo
    websocketAlert: {
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

    async processImmediateCommand (instanceMessage:InstanceMessage) : Promise<any> {
        return undefined
    }

    getChannelData(): ChannelData {
        return {
            id: 'alert',
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
        for (let socket of this.websocketAlert) {
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

    sendAlert = (webSocket:WebSocket, podNamespace:string, podName:string, containerName:string, alertSeverity:AlertSeverityEnum, line:string, instanceId: string): void => {
        // line includes timestamp at front (beacuse of log stream configuration when starting logstream)
        let i = line.indexOf(' ')
        let alertMessage: AlertMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.UNSOLICITED,
            instance: instanceId,
            type: InstanceMessageTypeEnum.DATA,
            namespace: podNamespace,
            pod: podName,
            container: containerName,
            channel: InstanceMessageChannelEnum.ALERT,
            text: line.substring(i + 1),
            timestamp: new Date(line.substring(0, i)),
            severity: alertSeverity,
            msgtype: 'alertmessage'
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
                let len = this.websocketAlert.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                socket = this.websocketAlert[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance, 
                    regExps,
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
                //timestamps: (instanceConfig.data as AlertConfig).timestamp as boolean,
                //...(instanceConfig.data.fromStart? {} : {since: Date.now()-1800})
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
                let len = this.websocketAlert.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                socket = this.websocketAlert[len-1]
            }

            let instances = socket.instances
            let instance = instances.find(i => i.instanceId === instanceConfig.instance)
            if (!instance) {
                let len = socket?.instances.push ({
                    instanceId: instanceConfig.instance,
                    regExps,
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
                //timestamps: instanceConfig.data.timestamp,
                //previous: Boolean(instanceConfig.data.previous),
                //...(instanceConfig.data.fromStart? {} : {sinceSeconds:1800})
            }
            await this.clusterInfo.logApi.log(podNamespace, podName, containerName, asset.passThroughStream, streamConfig)
        }
        catch (err:any) {
            console.log('Generic error starting pod alert log', err)
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
        }
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        console.log(`Start instance ${instanceConfig.instance} ${podNamespace}/${podName}/${containerName} (view: ${instanceConfig.view})`)

        let regexes: Map<AlertSeverityEnum, RegExp[]> = new Map()

        let regExps: RegExp[] = []
        for (let regStr of (instanceConfig.data as AlertConfig).regexInfo)
            regExps.push(new RegExp (regStr))
        regexes.set(AlertSeverityEnum.INFO, regExps)

        regExps = []
        for (let regStr of (instanceConfig.data as AlertConfig).regexWarning)
            regExps.push(new RegExp (regStr))
        regexes.set(AlertSeverityEnum.WARNING, regExps)

        regExps = []
        for (let regStr of (instanceConfig.data as AlertConfig).regexError)
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
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.ALERT, instanceConfig, 'Log instance stopped')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance not found`, instanceConfig)
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        var socket = this.websocketAlert.find(s => s.ws === webSocket)
        if (!socket) {
            console.log('No socket found for pci')
            return
        }
        let instances = socket.instances

        let instance = instances.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.ALERT, instanceConfig, 'Alert paused')
            }
            if (action === InstanceMessageActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.CONTINUE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.ALERT, instanceConfig, 'Alert continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {

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

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.websocketAlert.find(s => s.ws === webSocket))
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

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.websocketAlert.find(s => s.ws === webSocket)
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

}

export { AlertChannel }