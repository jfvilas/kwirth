import { InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { MetricDescription } from './metrics/MetricDescription'

enum IChannelMessageAction {
    NONE,
    REFRESH,
    STOP
}

interface ISetupProps {
    onChannelSetupClosed: (channel:IChannel, start:boolean, defaultValues:boolean) => void
    channel: IChannel
    channelObject: IChannelObject
    uiSettings?: any
    instanceSettings?: any
}

interface IContentProps {
    channelObject: IChannelObject
}

interface IChannelObject {
    clusterName: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    instanceId: string
    instanceConfig: any
    uiConfig: any
    uiData: any
    metricsList?: Map<string, MetricDescription>
    accessString?: string
    webSocket?: WebSocket
}

interface IChannel {
    SetupDialog: React.FC<ISetupProps>
    TabContent: React.FC<IContentProps>
    readonly channelId: string

    requiresSetup(): boolean
    requiresMetrics(): boolean
    requiresAccessString(): boolean
    requiresWebSocket(): boolean
    setNotifier(notifier:any): void
    getScope(): string
    getChannelIcon(): JSX.Element
    getSetupVisibility():boolean
    setSetupVisibility(visibility:boolean):void
    processChannelMessage (channelObject:IChannelObject, wsEvent:MessageEvent): IChannelMessageAction
    initChannel(channelObject:IChannelObject): boolean
    startChannel(channelObject:IChannelObject): boolean
    pauseChannel(channelObject:IChannelObject): boolean
    continueChannel(channelObject:IChannelObject): boolean
    stopChannel(channelObject:IChannelObject): boolean
    socketDisconnected(channelObject: IChannelObject): boolean
    socketReconnect(channelObject: IChannelObject): boolean
}

type ChannelConstructor = new () => IChannel

export { IChannelMessageAction }
export type { IChannel, IChannelObject, ISetupProps, IContentProps, ChannelConstructor }
