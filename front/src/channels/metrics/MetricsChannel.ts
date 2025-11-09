import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, IInstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, ISignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { MetricsIcon, MetricsSetup } from './MetricsSetup'
import { MetricsTabContent } from './MetricsTabContent'
import { MetricsData, IMetricsMessage, MetricsEventSeverityEnum, IMetricsData } from './MetricsData'
import { IMetricsConfig, MetricsInstanceConfig, MetricsConfig } from './MetricsConfig'
import { ENotifyLevel } from '../../tools/Global'

export class MetricsChannel implements IChannel {
    private setupVisible = false
    private notify: (level:ENotifyLevel, message:string) => void = (level:ENotifyLevel, message:string) => {}
    SetupDialog: FC<ISetupProps> = MetricsSetup
    TabContent: FC<IContentProps> = MetricsTabContent
    channelId = 'metrics'
    
    requiresSetup() { return true }
    requiresSettings() { return true }
    requiresMetrics() { return true }
    requiresAccessString() { return false }
    requiresClusterUrl() { return false }
    requiresWebSocket() { return false }
    setNotifier(notifier: (level:ENotifyLevel, message:string) => void) { this.notify = notifier }

    getScope() { return InstanceConfigScopeEnum.STREAM }
    getChannelIcon(): JSX.Element { return MetricsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        var metricsMessage:IMetricsMessage = JSON.parse(wsEvent.data)
        let metricsData:IMetricsData = channelObject.data
        let metricsConfig:IMetricsConfig = channelObject.config

        switch (metricsMessage.type) {
            case InstanceMessageTypeEnum.DATA:
                if (metricsMessage.timestamp===0) {  // initial metrics values
                    metricsMessage.timestamp = Date.now()
                    if (metricsData.assetMetricsValues.length===0)
                        metricsData.assetMetricsValues.push(metricsMessage)
                    else
                        metricsData.assetMetricsValues[0] = metricsMessage
                }
                else {
                    metricsData.assetMetricsValues.push(metricsMessage)
                    if (metricsData.assetMetricsValues.length > metricsConfig.depth) metricsData.assetMetricsValues.shift()
                }
                if (!metricsData.paused) action = IChannelMessageAction.REFRESH
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:IInstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else {
                    let signalMessage:ISignalMessage = JSON.parse(wsEvent.data)
                    if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                        if (signalMessage.text) {
                            metricsData.events.push( { severity: MetricsEventSeverityEnum.INFO, text: signalMessage.text })
                        }
                    }
                    else {
                        if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                            if (signalMessage.text) {
                                metricsData.events.push( { severity: MetricsEventSeverityEnum.ERROR, text: signalMessage.text })
                                action = IChannelMessageAction.REFRESH
                            }
                        }
                    }
                }
                break
            default:
                console.log(`Invalid message type ${metricsMessage.type}`)
                break
        }
        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.data = new MetricsData()
        channelObject.instanceConfig = new MetricsInstanceConfig()
        channelObject.config = new MetricsConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let metricsData:IMetricsData = channelObject.data
        metricsData.events = []
        metricsData.assetMetricsValues=[]
        metricsData.paused = false
        metricsData.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let metricsData:IMetricsData = channelObject.data
        metricsData.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let metricsData:IMetricsData = channelObject.data
        metricsData.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let metricsData:IMetricsData = channelObject.data
        metricsData.paused = false
        metricsData.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let metricsData:IMetricsData = channelObject.data
        metricsData.events.push( { severity: MetricsEventSeverityEnum.INFO, text: '*** Lost connection ***' })
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
