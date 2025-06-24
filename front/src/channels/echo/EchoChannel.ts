import { FC } from "react";
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from "../IChannel";
import { EchoInstanceConfig, EchoUiConfig, IEchoUiConfig } from "./EchoConfig";
import { EchoSetup, EchoIcon } from './EchoSetup';
import { InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from "@jfvilas/kwirth-common";
import { EchoObject, IEchoMessage } from "./EchoObject";
import { EchoTabContent } from "./EchoTabContent";


export class EchoChannel implements IChannel {
    private setupVisible = false
    private paused = false
    SetupDialog: FC<ISetupProps> = EchoSetup
    TabContent: FC<IContentProps> = EchoTabContent
    
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.NONE}
    getChannelId(): string { return 'echo' }
    getChannelIcon(): JSX.Element { return EchoIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let msg = JSON.parse(wsEvent.data) as IEchoMessage

        let echoObject = channelObject.uiData as EchoObject
        let echoUiConfig:IEchoUiConfig = channelObject.uiConfig
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                echoObject.lines.push(msg.text)
                while (echoObject.lines.length > echoUiConfig.maxLines) echoObject.lines.shift()
                return IChannelMessageAction.REFRESH
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
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
        console.log('initChannel')
        channelObject.instanceConfig = new EchoInstanceConfig()
        channelObject.uiConfig = new EchoUiConfig()
        channelObject.uiData = new EchoObject()
        let echoObject = channelObject.uiData as EchoObject
        echoObject.lines = []
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        console.log('startChannel')
        let echoObject = channelObject.uiData as EchoObject
        echoObject.lines = [ 'Start']
        this.paused = false
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        console.log('pauseChannel')
        this.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        console.log('contChannel')
        this.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        console.log('stopChannel')
        let echoObject = channelObject.uiData as EchoObject
        echoObject.lines.push('==========================================================================')
        this.paused = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        return false
    }
    
    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
