import { FC } from 'react'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps, ISetupProps } from '../IChannel'
import { InstanceConfigScopeEnum, InstanceMessage, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { MetricsIcon, MetricsSetup } from './MetricsSetup'
import { MetricsTabContent } from './MetricsTabContent'
import { MetricsObject, IMetricsMessage, MetricsEventSeverityEnum } from './MetricsObject'
import { MetricsInstanceConfig, MetricsUiConfig } from './MetricsConfig'

export class MetricsChannel implements IChannel {
    private setupVisible = false
    private paused = false
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
        var msg = JSON.parse(wsEvent.data) as IMetricsMessage
        let metricsObject = channelObject.uiData as MetricsObject
        let metricsUiConfig = channelObject.uiConfig as MetricsUiConfig

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                if (msg.timestamp===0) {  // initial metrics values
                    let initialIndex = metricsObject.assetMetricsValues.findIndex(m => m.timestamp === 0)
                    if (initialIndex>=0) {
                        if (metricsObject.assetMetricsValues[initialIndex].assets.length<=msg.assets.length) {
                            metricsObject.assetMetricsValues[initialIndex] = msg
                            if (!this.paused) action = IChannelMessageAction.REFRESH
                        }
                    }
                    else {
                        metricsObject.assetMetricsValues.push(msg)
                        if (!this.paused) action = IChannelMessageAction.REFRESH
                    }
                }
                else {
                    metricsObject.assetMetricsValues.push(msg)
                    if (metricsObject.assetMetricsValues.length > metricsUiConfig.depth) metricsObject.assetMetricsValues.shift()
                    if (!this.paused) action = IChannelMessageAction.REFRESH
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    channelObject.instanceId = instanceMessage.instance
                }
                else {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
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
        channelObject.uiData.events = []
        channelObject.uiData.assetMetricsValues=[]
        this.paused = false
        return true
    }

    pauseChannel(channelObject:IChannelObject): boolean {
        this.paused = true
        return false
    }

    continueChannel(channelObject:IChannelObject): boolean {
        this.paused = false
        return true
    }

    stopChannel(channelObject: IChannelObject): boolean {
        this.paused = false
        return true
    }

    socketDisconnected(channelObject: IChannelObject): boolean {
        let metricsObject = channelObject.uiData as MetricsObject
        metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: '*** Lost connection ***' })
        return true
    }

    socketReconnect(channelObject: IChannelObject): boolean {
        return false
    }

}    
