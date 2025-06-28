import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { AlertSeverityEnum, IAlertMessage, InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage } from '@jfvilas/kwirth-common'
import { AlertIcon, AlertSetup } from './AlertSetup'
import { AlertTabContent } from './AlertTabContent'
import { AlertObject, IAlertObject } from './AlertObject'
import { AlertInstanceConfig, AlertUiConfig, IAlertUiConfig } from './AlertConfig'

export class AlertChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = AlertSetup
    TabContent: FC<IContentProps> = AlertTabContent
    channelId = 'alert'

    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.VIEW}
    getChannelIcon(): JSX.Element { return AlertIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        let msg:IAlertMessage = JSON.parse(wsEvent.data)
        let alertObject:IAlertObject = channelObject.uiData
        let alertConfig:IAlertUiConfig = channelObject.uiConfig

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
                if (!alertObject.paused) action = IChannelMessageAction.REFRESH
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:InstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage:SignalMessage = JSON.parse(wsEvent.data)
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
        channelObject.uiData = new AlertObject()
        channelObject.instanceConfig = new AlertInstanceConfig()
        channelObject.uiConfig = new AlertUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let alertObject:IAlertObject = channelObject.uiData
        alertObject.paused = false
        alertObject.started = true
        channelObject.uiData.firedAlerts = []
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let alertObject:IAlertObject = channelObject.uiData
        alertObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let alertObject:IAlertObject = channelObject.uiData
        alertObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let alertObject:IAlertObject = channelObject.uiData 
        alertObject.firedAlerts.push({
            timestamp: Date.now(),
            severity: AlertSeverityEnum.INFO,
            namespace:'',
            container: '',
            text: 'Channel stopped\n========================================================================='
        })
        alertObject.paused = false
        alertObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let alertObject:IAlertObject = channelObject.uiData
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
