import { FC } from "react";
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from "../IChannel";
import { EchoInstanceConfig, EchoConfig, IEchoConfig } from "./EchoConfig";
import { EchoSetup, EchoIcon } from './EchoSetup';
import { IEchoMessage, InstanceConfigScopeEnum, IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from "@jfvilas/kwirth-common";
import { EchoData, IEchoData } from "./EchoData";
import { EchoTabContent } from "./EchoTabContent";
import { ENotifyLevel } from "../../tools/Global";


export class EchoChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = EchoSetup
    TabContent: FC<IContentProps> = EchoTabContent
    channelId = 'echo'
    
    requiresSetup() { return true }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return false }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return InstanceConfigScopeEnum.NONE}
    getChannelIcon(): JSX.Element { return EchoIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let msg:IEchoMessage = JSON.parse(wsEvent.data)

        let echoData:IEchoData = channelObject.data
        let echoConfig:IEchoConfig = channelObject.config
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                echoData.lines.push(msg.text)
                while (echoData.lines.length > echoConfig.maxLines) echoData.lines.shift()
                return IChannelMessageAction.REFRESH
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:IInstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                echoData.lines.push('*** '+msg.text+' ***')
                while (echoData.lines.length> echoConfig.maxLines) echoData.lines.shift()
                return IChannelMessageAction.REFRESH
            default:
                console.log(`Invalid message type ${msg.type}`)
                return IChannelMessageAction.NONE
        }
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.instanceConfig = new EchoInstanceConfig()
        channelObject.config = new EchoConfig()
        channelObject.data = new EchoData()
        let echoObject:IEchoData= channelObject.data
        echoObject.lines = []
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoData = channelObject.data
        echoObject.lines = [ 'Start']
        echoObject.paused = false
        echoObject.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoData = channelObject.data
        echoObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoData = channelObject.data
        echoObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let echoObject:IEchoData = channelObject.data
        echoObject.lines.push('==========================================================================')
        echoObject.paused = false
        echoObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
