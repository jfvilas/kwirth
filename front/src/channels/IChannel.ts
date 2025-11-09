import { InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { MetricDefinition } from './metrics/MetricDefinition'
import { ENotifyLevel } from '../tools/Global'
import { IChannelSettings } from '../model/Settings'

enum IChannelMessageAction {
    NONE,
    REFRESH,
    STOP
}

interface ISetupProps {
    onChannelSetupClosed: (channel:IChannel, channelSettings:IChannelSettings, start:boolean, defaultValues:boolean) => void
    channel: IChannel
    setupConfig?: IChannelSettings
    channelObject: IChannelObject
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
    config: any
    data: any
    metricsList?: Map<string, MetricDefinition>
    accessString?: string
    webSocket?: WebSocket
    clusterUrl?: string
    onUpdateChannelSettings?: (channelSettings:IChannelSettings) => void
    channelSettings?: IChannelSettings
}

interface IChannel {
    SetupDialog: React.FC<ISetupProps>
    TabContent: React.FC<IContentProps>
    readonly channelId: string

    requiresSetup(): boolean
    requiresSettings(): boolean
    requiresMetrics(): boolean
    requiresClusterUrl(): boolean
    requiresAccessString(): boolean
    requiresWebSocket(): boolean
    setNotifier(notifier:(level:ENotifyLevel, message:string) => void): void
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

type ChannelConstructor = (new () => IChannel)|undefined

export { IChannelMessageAction }
export type { IChannel, IChannelObject, ISetupProps, IContentProps, ChannelConstructor }
