import { FC } from 'react'
import { EChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, IOpsMessageResponse, OpsCommandEnum, ISignalMessage, IInstanceConfigResponse, SignalMessageEventEnum, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { OpsIcon, OpsSetup } from './OpsSetup'
import { OpsTabContent } from './OpsTabContent'
import { OpsData, IOpsData, IXTerm } from './OpsData'
import { OpsInstanceConfig, OpsConfig } from './OpsConfig'
import { OPSHELPMESSAGE, OPSWELCOMEMESSAGE } from '../../tools/Constants'
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
            console.log(channelObject.clusterUrl)
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
                                let so = opsData.scopedObjects.find(so => so.namespace === opsMessage.namespace && so.pod === opsMessage.pod && so.container === opsMessage.container)
                                if (so) {
                                    refresh.data = JSON.parse(opsMessage.data)
                                }
                                else {
                                    this.notify(ENotifyLevel.INFO, 'Data received of non-scoped object')
                                }
                                refresh.action = EChannelRefreshAction.REFRESH
                                if (opsData.onAsyncData) opsData.onAsyncData({event:'describe', data:refresh.data})
                                break
                            case OpsCommandEnum.XTERM:
                                // it's a response for a xterm session start, so we add a new xterm session to xterms array
                                //action = ChannelRefreshAction.REFRESH
                                break
                            case OpsCommandEnum.EXECUTE:
                                opsData.messages.push(this.cleanANSI(opsMessage.data))
                                refresh.action = EChannelRefreshAction.REFRESH
                                break
                            default:
                                if (typeof opsMessage.data !== 'string')
                                    opsData.messages.push(JSON.stringify(opsMessage.data))
                                else
                                    opsData.messages.push(opsMessage.data)
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
                        //opsData.messages.push(opsMessage.data)
                        this.notify(signalMessage.level as any as ENotifyLevel, signalMessage.text||'No info')
                        refresh.action = EChannelRefreshAction.REFRESH
                    }
                    else if (opsMessage.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                        if (signalMessage.text) {
                            opsData.messages.push(signalMessage.text)
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
                                opsData.messages.push(signalMessage.text)
                                refresh.action = EChannelRefreshAction.REFRESH
                            }
                        }
                        else {
                            console.log('wsEvent.data on ops')
                            console.log(wsEvent.data)                    
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

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.config = new OpsConfig()
        channelObject.data = new OpsData()
        channelObject.instanceConfig = new OpsInstanceConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let opsData:IOpsData = channelObject.data
        opsData.paused = false
        opsData.started = true
        opsData.messages = [...OPSWELCOMEMESSAGE, ...OPSHELPMESSAGE]
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
        opsData.messages.push('=========================================================================')
        return false
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

    cleanANSI(text: string): string {
        const regexAnsi = /\x1b\[[0-9;]*[mKHVfJrcegH]|\x1b\[\d*n/g;
        return text.replace(regexAnsi, '') // replace all matches with empty strings
    }

}    
