import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { MetricsIcon, MetricsSetup } from './MetricsSetup'
import { MetricsTabContent } from './MetricsTabContent'
import { MetricsObject, IMetricsMessage, MetricsEventSeverityEnum, IMetricsObject } from './MetricsObject'
import { IMetricsUiConfig, MetricsInstanceConfig, MetricsUiConfig } from './MetricsConfig'

export class MetricsChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = MetricsSetup
    TabContent: FC<IContentProps> = MetricsTabContent
    channelId = 'metrics'
    
    requiresMetrics() { return true }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.STREAM }
    getChannelIcon(): JSX.Element { return MetricsIcon }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        var msg:IMetricsMessage = JSON.parse(wsEvent.data)
        let metricsObject:IMetricsObject = channelObject.uiData
        let metricsUiConfig:IMetricsUiConfig = channelObject.uiConfig

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                if (msg.timestamp===0) {  // initial metrics values
                    let initialIndex = metricsObject.assetMetricsValues.findIndex(m => m.timestamp === 0)
                    if (initialIndex>=0) {
                        if (metricsObject.assetMetricsValues[initialIndex].assets.length<=msg.assets.length) {
                            metricsObject.assetMetricsValues[initialIndex] = msg
                            if (!metricsObject.paused) action = IChannelMessageAction.REFRESH
                        }
                    }
                    else {
                        metricsObject.assetMetricsValues.push(msg)
                        if (!metricsObject.paused) action = IChannelMessageAction.REFRESH
                    }
                }
                else {
                    metricsObject.assetMetricsValues.push(msg)
                    if (metricsObject.assetMetricsValues.length > metricsUiConfig.depth) metricsObject.assetMetricsValues.shift()
                    if (!metricsObject.paused) action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage:InstanceMessage = JSON.parse(wsEvent.data)
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else {
                    let signalMessage:SignalMessage = JSON.parse(wsEvent.data)
                    if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                        metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: signalMessage.text })
                    }
                    else {
                        if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                            metricsObject.events.push( { severity: MetricsEventSeverityEnum.ERROR, text: signalMessage.text })
                            action = IChannelMessageAction.REFRESH
                        }
                    }
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
        return action
    }

    initChannel(channelObject:IChannelObject): boolean {
        channelObject.uiData = new MetricsObject()
        channelObject.instanceConfig = new MetricsInstanceConfig()
        channelObject.uiConfig = new MetricsUiConfig()
        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        let metricsObject:IMetricsObject = channelObject.uiData
        channelObject.uiData.events = []
        channelObject.uiData.assetMetricsValues=[]
        metricsObject.paused = false
        metricsObject.started = true
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        let metricsObject:IMetricsObject = channelObject.uiData
        metricsObject.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        let metricsObject:IMetricsObject = channelObject.uiData
        metricsObject.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        let metricsObject:IMetricsObject = channelObject.uiData
        metricsObject.paused = false
        metricsObject.started = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let metricsObject:IMetricsObject = channelObject.uiData
        metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: '*** Lost connection ***' })
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
