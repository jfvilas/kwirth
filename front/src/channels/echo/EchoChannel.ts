import { FC } from "react";
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from "../IChannel";
import { EchoInstanceConfig, EchoUiConfig, IEchoUiConfig } from "./EchoConfig";
import { EchoSetup, EchoIcon } from './EchoSetup';
import { IEchoMessage, InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from "@jfvilas/kwirth-common";
import { EchoObject, IEchoObject } from "./EchoObject";
import { EchoTabContent } from "./EchoTabContent";


export class EchoChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = EchoSetup
    TabContent: FC<IContentProps> = EchoTabContent
    channelId = 'echo'
    
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.NONE}
    getChannelIcon(): JSX.Element { return EchoIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let msg:IEchoMessage = JSON.parse(wsEvent.data)

        let echoObject:IEchoObject = channelObject.uiData
        let echoUiConfig:IEchoUiConfig = channelObject.uiConfig
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                echoObject.lines.push(msg.text)
                while (echoObject.lines.length > echoUiConfig.maxLines) echoObject.lines.shift()
                return IChannelMessageAction.REFRESH
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:InstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                echoObject.lines.push('*** '+msg.text+' ***')
                while (echoObject.lines.length> echoUiConfig.maxLines) echoObject.lines.shift()
                return IChannelMessageAction.REFRESH
            default:
                console.log(`Invalid message type ${msg.type}`)
                return IChannelMessageAction.NONE
        }
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.instanceConfig = new EchoInstanceConfig()
        channelObject.uiConfig = new EchoUiConfig()
        channelObject.uiData = new EchoObject()
        let echoObject:IEchoObject= channelObject.uiData
        echoObject.lines = []
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoObject = channelObject.uiData
        echoObject.lines = [ 'Start']
        echoObject.paused = false
        echoObject.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoObject = channelObject.uiData
        echoObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let echoObject:IEchoObject = channelObject.uiData
        echoObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let echoObject:IEchoObject = channelObject.uiData
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
