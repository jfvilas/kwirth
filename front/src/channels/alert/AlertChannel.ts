import { FC } from 'react'
import { ChannelRefreshAction, IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { AlertSeverityEnum, IAlertMessage, InstanceConfigScopeEnum, IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage } from '@jfvilas/kwirth-common'
import { AlertIcon, AlertSetup } from './AlertSetup'
import { AlertTabContent } from './AlertTabContent'
import { AlertData, IAlertData } from './AlertData'
import { AlertInstanceConfig, AlertConfig, IAlertConfig } from './AlertConfig'
import { ENotifyLevel } from '../../tools/Global'

export class AlertChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = AlertSetup
    TabContent: FC<IContentProps> = AlertTabContent
    channelId = 'alert'

    requiresSetup() { return true }
    requiresSettings() { return false }
    requiresMetrics() { return false }
    requiresAccessString() { return false }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return false }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return InstanceConfigScopeEnum.VIEW}
    getChannelIcon(): JSX.Element { return AlertIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = ChannelRefreshAction.NONE
        let msg:IAlertMessage = JSON.parse(wsEvent.data)
        let alertData:IAlertData = channelObject.data
        let alertConfig:IAlertConfig = channelObject.config

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                alertData.firedAlerts.push ({
                    timestamp: msg.timestamp? new Date(msg.timestamp).getTime(): Date.now(),
                    severity: msg.severity,
                    text: msg.text,
                    namespace: msg.namespace,
                    group: '',
                    pod: msg.pod,
                    container: msg.container
                })
                if (alertData.firedAlerts.length > alertConfig.maxAlerts) alertData.firedAlerts.splice(0, alertData.firedAlerts.length - alertConfig.maxAlerts)
                if (!alertData.paused) action = ChannelRefreshAction.REFRESH
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:IInstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                    alertData.firedAlerts.push({
                        timestamp: signalMessage.timestamp?.getTime() || 0,
                        severity: AlertSeverityEnum.INFO,
                        text: signalMessage.text || ''
                    })
                    action = ChannelRefreshAction.REFRESH
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
        return {
            action
        }
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.data = new AlertData()
        channelObject.instanceConfig = new AlertInstanceConfig()
        channelObject.config = new AlertConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let alertData:IAlertData = channelObject.data
        alertData.firedAlerts = []
        alertData.paused = false
        alertData.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let alertData:IAlertData = channelObject.data
        alertData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let alertData:IAlertData = channelObject.data
        alertData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let alertData:IAlertData = channelObject.data 
        alertData.firedAlerts.push({
            timestamp: Date.now(),
            severity: AlertSeverityEnum.INFO,
            namespace:'',
            container: '',
            text: 'Channel stopped\n========================================================================='
        })
        alertData.paused = false
        alertData.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let alertData:IAlertData = channelObject.data
        alertData.firedAlerts.push({
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
