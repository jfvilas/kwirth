import { FC } from 'react'
import { EChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, IOpsMessageResponse, OpsCommandEnum, ISignalMessage, IInstanceConfigResponse, SignalMessageEventEnum, SignalMessageLevelEnum, IInstanceConfig, InstanceMessageChannelEnum, InstanceConfigObjectEnum, InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { OpsIcon, OpsSetup } from './OpsSetup'
import { OpsTabContent } from './OpsTabContent'
import { OpsData, IOpsData, IXTerm, IScopedObject } from './OpsData'
import { OpsInstanceConfig, OpsConfig, IOpsConfig } from './OpsConfig'
import { ENotifyLevel } from '../../tools/Global'
import 'xterm/css/xterm.css'

export class OpsChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = OpsSetup
    TabContent: FC<IContentProps> = OpsTabContent
    channelId = 'ops'
    
    requiresSetup() { return true }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return true }
    requiresFrontChannels() { return true }
    requiresClusterUrl() { return true }
    requiresWebSocket() { return true }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return 'ops$get' }
    getChannelIcon(): JSX.Element { return OpsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let refresh:IChannelMessageAction = {
            action : EChannelRefreshAction.NONE
        }
        let opsData:IOpsData = channelObject.data

        let instanceConfigResponse:IInstanceConfigResponse = JSON.parse(wsEvent.data) as IInstanceConfigResponse
        if (instanceConfigResponse.flow === InstanceMessageFlowEnum.RESPONSE && instanceConfigResponse.action === InstanceMessageActionEnum.WEBSOCKET) {
            let newXterm:IXTerm = {
                namespace: opsData.websocketRequest.namespace,
                pod: opsData.websocketRequest.pod,
                container: opsData.websocketRequest.container,
                connected: true,
                selected: false,  // on opsTabContent this will be set to true and the rest of the terminal config will be done
                id: instanceConfigResponse.instance,
                socket: new WebSocket(channelObject.clusterUrl + '?challenge='+(instanceConfigResponse.data as string)),
                terminal: undefined
            }
            opsData.terminalManager.createTerminal(`${newXterm.namespace+'/'+newXterm.pod+'/'+newXterm.container}`, newXterm.socket!)
            refresh.action = EChannelRefreshAction.REFRESH
        }
        else {
            let opsMessage:IOpsMessageResponse = JSON.parse(wsEvent.data)
            switch (opsMessage.type) {
                case InstanceMessageTypeEnum.DATA:
                    if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE) {
                        switch (opsMessage.command) {
                            case OpsCommandEnum.DESCRIBE:
                                let scopedObject = opsData.scopedObjects.find(so => so.namespace === opsMessage.namespace && so.pod === opsMessage.pod && so.container === opsMessage.container)
                                if (scopedObject)
                                    refresh.data = JSON.parse(opsMessage.data)
                                else
                                    this.notify(ENotifyLevel.INFO, 'Data received for a non-scoped object')
                                if (opsData.onDescribeResponse) opsData.onDescribeResponse({event:'describe', data:refresh.data})
                                refresh.action = EChannelRefreshAction.REFRESH
                                break
                            }
                    }
                    else {
                        console.log('*************unhandled', opsMessage)
                        refresh.action = EChannelRefreshAction.REFRESH
                    }
                    break
                case InstanceMessageTypeEnum.SIGNAL:
                    let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                    if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.COMMAND) {
                        this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text||'No info')
                        refresh.action = EChannelRefreshAction.REFRESH
                    }
                    else if (opsMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                        if (signalMessage.text) {
                            if (signalMessage.level === SignalMessageLevelEnum.WARNING) this.notify(ENotifyLevel.WARNING, signalMessage.text)
                            else if (signalMessage.level === SignalMessageLevelEnum.ERROR) this.notify(ENotifyLevel.ERROR, signalMessage.text)
                            else this.notify(ENotifyLevel.INFO, signalMessage.text)
                            
                            refresh.action = EChannelRefreshAction.REFRESH
                        }
                        if (signalMessage.event === SignalMessageEventEnum.ADD) {
                            opsData.scopedObjects.push( {
                                namespace: signalMessage.namespace!,
                                pod: signalMessage.pod!,
                                container: signalMessage.container!
                            })
                            refresh.action = EChannelRefreshAction.REFRESH
                        }
                        else if (signalMessage.event === SignalMessageEventEnum.DELETE) {
                            let i = opsData.scopedObjects.findIndex(so => so.namespace === signalMessage.namespace && so.pod === signalMessage.pod && (!signalMessage.container || so.container === signalMessage.container))
                            while (i>=0) {
                                opsData.scopedObjects.splice(i,1)
                                i = opsData.scopedObjects.findIndex(so => so.namespace === signalMessage.namespace && so.pod === signalMessage.pod && (!signalMessage.container || so.container === signalMessage.container))
                            }
                            refresh.action = EChannelRefreshAction.REFRESH
                        }
                    }
                    else {
                        let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                        if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                            channelObject.instanceId = signalMessage.instance
                            if (signalMessage.text) {
                                refresh.action = EChannelRefreshAction.REFRESH
                                this.notify(ENotifyLevel.INFO, signalMessage.text)
                            }
                        }
                        else {
                            console.log('wsEvent.data on ops', wsEvent.data)
                        }
                    }
                    break
                default:
                    console.log(`Invalid message type ${opsMessage.type}`)
                    break
            }
        }

        return refresh
    }

    waitForInstanceAndStart = async (channelObject:IChannelObject, shell:IScopedObject) : Promise<void> => {
        if (!channelObject.webSocket) {
            console.log('No webSocket for terminal launch')
            return
        }

        let opsData:IOpsData = channelObject.data
        let opsConfig:IOpsConfig= channelObject.config

        while (channelObject.instanceId === '') {
            await new Promise(resolve => setTimeout(resolve, 10))
        }
        let instanceConfig:IInstanceConfig = {
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.WEBSOCKET,
            channel: InstanceMessageChannelEnum.OPS,
            type: InstanceMessageTypeEnum.DATA,
            accessKey: channelObject.accessString!,
            instance: channelObject.instanceId,
            namespace: shell.namespace,
            group: '',
            pod: shell.pod,
            container: shell.container,
            objects: InstanceConfigObjectEnum.PODS,
            scope: '',
            view: InstanceConfigViewEnum.CONTAINER
        }
        opsData.websocketRequest = {
            namespace: shell.namespace,
            pod: shell.pod,
            container: shell.container
        }
        channelObject.webSocket.send(JSON.stringify( instanceConfig ))
    }
    
    initChannel(channelObject:IChannelObject): boolean {
        channelObject.config = new OpsConfig()
        channelObject.data = new OpsData()
        channelObject.instanceConfig = new OpsInstanceConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        let opsConfig:IOpsConfig= channelObject.config
        opsData.scopedObjects = []
        opsData.selectedTerminal = undefined
        opsData.paused = false
        opsData.started = true
        if (opsConfig.launchShell && opsConfig.shell) this.waitForInstanceAndStart(channelObject, opsConfig.shell)
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        opsData.started = false
        return false
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

    // cleanANSI(text: string): string {
    //     const regexAnsi = /\x1b\[[0-9;]*[mKHVfJrcegH]|\x1b\[\d*n/g;
    //     return text.replace(regexAnsi, '') // replace all matches with empty strings
    // }

}    
