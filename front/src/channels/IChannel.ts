import { EInstanceConfigView } from '@jfvilas/kwirth-common'
import { MetricDefinition } from './metrics/MetricDefinition'
import { ENotifyLevel } from '../tools/Global'
import { IChannelSettings } from '../model/Settings'
import { IResourceSelected } from '../components/ResourceSelector'
import { IClusterInfo } from '../model/Cluster'

type TChannelConstructor = (new () => IChannel)|undefined

enum EChannelRefreshAction {
    NONE,
    REFRESH,
    STOP
}

interface IChannelMessageAction {
    action: EChannelRefreshAction
    data?:any
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
    view: EInstanceConfigView
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
    frontChannels?: Map<string, TChannelConstructor>
    webSocket?: WebSocket
    clusterUrl?: string
    clusterInfo?: IClusterInfo
    onUpdateChannelSettings?: (channelSettings:IChannelSettings) => void
    onCreateTab?: (resource:IResourceSelected, start:boolean, settings:any) => void
    channelSettings?: IChannelSettings
    channel:IChannel
    readChannelUserPreferences?: (channelId:string) => Promise<any>
    writeChannelUserPreferences?: (channelId:string, data:any) => Promise<boolean>
}

interface IChannel {
    SetupDialog: React.FC<ISetupProps>
    TabContent: React.FC<IContentProps>
    readonly channelId: string

    requiresSetup(): boolean
    requiresSettings(): boolean
    requiresFrontChannels(): boolean
    requiresMetrics(): boolean
    requiresClusterUrl(): boolean
    requiresClusterInfo(): boolean
    requiresAccessString(): boolean
    requiresWebSocket(): boolean
    requiresUserSettings(): boolean
    setNotifier(notifier:(channel:IChannel|undefined, level:ENotifyLevel, message:string) => void): void
    getScope(): string
    getChannelIcon(): JSX.Element
    getSetupVisibility(): boolean
    setSetupVisibility(visibility:boolean): void
    processChannelMessage (channelObject:IChannelObject, wsEvent:MessageEvent): IChannelMessageAction
    initChannel(channelObject:IChannelObject): Promise<boolean>
    startChannel(channelObject:IChannelObject): boolean
    pauseChannel(channelObject:IChannelObject): boolean
    continueChannel(channelObject:IChannelObject): boolean
    stopChannel(channelObject:IChannelObject): boolean
    socketDisconnected(channelObject: IChannelObject): boolean
    socketReconnect(channelObject: IChannelObject): boolean
}

export { EChannelRefreshAction }
export type { IChannel, IChannelObject, ISetupProps, IContentProps, TChannelConstructor, IChannelMessageAction }
