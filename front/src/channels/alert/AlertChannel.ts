import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { AlertSeverityEnum, InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage } from '@jfvilas/kwirth-common'
import { AlertIcon, AlertSetup } from './AlertSetup'
import { AlertTabContent } from './AlertTabContent'
import { AlertObject, IAlertMessage } from './AlertObject'
import { AlertInstanceConfig, AlertUiConfig } from './AlertConfig'

export class AlertChannel implements IChannel {
    private setupVisible = false
    private paused = false
    SetupDialog: FC<ISetupProps> = AlertSetup
    TabContent: FC<IContentProps> = AlertTabContent
    
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.VIEW}
    getChannelId(): string { return 'alert' }
    getChannelIcon(): JSX.Element { return AlertIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        var msg = JSON.parse(wsEvent.data) as IAlertMessage
        let alertObject = channelObject.uiData as AlertObject
        let alertConfig = channelObject.uiConfig as AlertUiConfig

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                alertObject.firedAlerts.push ({
                    timestamp: msg.timestamp? new Date(msg.timestamp).getTime(): Date.now(),
                    severity: msg.severity,
                    text: msg.text,
                    namespace: msg.namespace,
                    group: '',
                    pod: msg.pod,
                    container: msg.container
                })
                if (alertObject.firedAlerts.length > alertConfig.maxAlerts) alertObject.firedAlerts.splice(0, alertObject.firedAlerts.length - alertConfig.maxAlerts)
                if (!this.paused) action = IChannelMessageAction.REFRESH
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    alertObject.firedAlerts.push({
                        timestamp: signalMessage.timestamp?.getTime() || 0,
                        severity: AlertSeverityEnum.INFO,
                        text: signalMessage.text
                    })
                    action = IChannelMessageAction.REFRESH
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        console.log('initChannel')
        channelObject.uiData = new AlertObject()
        channelObject.instanceConfig = new AlertInstanceConfig()
        channelObject.uiConfig = new AlertUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        console.log('startChannel')
        this.paused = false
        channelObject.uiData.firedAlerts = []
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
        let alertObject = channelObject.uiData as AlertObject
        alertObject.firedAlerts.push({
            timestamp: Date.now(),
            severity: AlertSeverityEnum.INFO,
            namespace:'',
            container: '',
            text: 'Channel stopped\n========================================================================='
        })
        this.paused = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let alertObject = channelObject.uiData as AlertObject
        alertObject.firedAlerts.push({
            timestamp: Date.now(),
            severity: AlertSeverityEnum.ERROR,
            namespace:'',
            container: '',
            text: '*** Lost connection ***'
        })
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
