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
    
    requiresMetrics() { return true }
    requiresAccessString() { return false }
    requiresWebSocket() { return false }

    getScope() { return InstanceConfigScopeEnum.STREAM }
    getChannelId(): string { return 'metrics' }
    getChannelIcon(): JSX.Element { return MetricsIcon }
    getChannelUiConfig(): any { return new MetricsUiConfig() }
    getChannelInstanceConfig(): any { return new MetricsInstanceConfig() }
    
    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility:boolean): void { this.setupVisible = visibility }

    processChannelMessage(channelObject:IChannelObject, wsEvent: any): IChannelMessageAction {
        let action = IChannelMessageAction.NONE
        var msg = JSON.parse(wsEvent.data) as IMetricsMessage
        let metricsObject = channelObject.uiData as MetricsObject
        let metricsUiConfig = channelObject.uiConfig as MetricsUiConfig

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                metricsObject.assetMetricsValues.push(msg)
                if (metricsObject.assetMetricsValues.length > metricsUiConfig.depth) {
                    metricsObject.assetMetricsValues.shift()
                }
                if (!this.paused) action = IChannelMessageAction.REFRESH
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    if (signalMessage.level === SignalMessageLevelEnum.INFO) {
                        channelObject.instanceId = instanceMessage.instance
                    }
                    else {
                        metricsObject.events.push( { severity: (signalMessage.level as string) as MetricsEventSeverityEnum, text: signalMessage.text })
                        action = IChannelMessageAction.REFRESH
                    }
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: signalMessage.text })
                }
                else {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                        metricsObject.events.push( { severity: MetricsEventSeverityEnum.ERROR, text: signalMessage.text })
                        action = IChannelMessageAction.REFRESH
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
        console.log('initChannel')
        channelObject.uiData = new MetricsObject()
        channelObject.instanceConfig = new MetricsInstanceConfig()
        channelObject.uiConfig = new MetricsUiConfig()

        // let metricsObject = new MetricsObject()
        // metricsObject.depth = settingsRef.current?.metricsDepth || 10
        // metricsObject.width = settingsRef.current?.metricsWidth || 2
        // metricsObject.chart = settingsRef.current?.metricsChart || 'line'
        // metricsObject.merge = settingsRef.current?.metricsMerge || false
        // metricsObject.stack = settingsRef.current?.metricsStack || false
        // metricsObject.metrics = []
        // newTab.channelObject.uiData = metricsObject

        return false
    }

    startChannel(channelObject:IChannelObject): boolean {
        console.log('startChannel')

        channelObject.uiData.events = []
        channelObject.uiData.assetMetricsValues=[]
        // let metricsConfig:MetricsInstanceConfig = {
        //     mode: channelObject.instanceConfig.mode,
        //     aggregate: channelObject.instanceConfig.aggregate,
        //     interval: channelObject.instanceConfig.interval,
        //     metrics: channelObject.instanceConfig.metrics,
        // }
        // instanceConfig.scope = InstanceConfigScopeEnum.STREAM
        // instanceConfig.data = metricsConfig

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

    // PRIVATE
    
}    
