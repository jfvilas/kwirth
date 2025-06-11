import { InstanceConfigViewEnum } from "@jfvilas/kwirth-common"
import { LogObject } from "./log/LogObject"
import { MetricsObject } from "./metrics/MetricsObject"
import { OpsObject } from "./ops/OpsObject"
import { TrivyObject } from "./trivy/TrivyObject"

enum IChannelMessageAction {
    NONE,
    REFRESH,
    STOP
}

interface ISetupProps {
    onChannelSetupClosed: (channel:IChannel, start:boolean) => void
    channel: IChannel
    channelObject?: IChannelObject
}

interface IContentProps {
    webSocket?: WebSocket
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
    uiData: LogObject | MetricsObject | OpsObject | TrivyObject | undefined | any
}

interface IChannel {
    getChannelUiConfig(): any
    getChannelInstanceConfig(): any
    SetupDialog: React.FC<ISetupProps>
    TabContent: React.FC<IContentProps>

    getScope(): string
    getChannelId(): string
    getChannelIcon(): JSX.Element
    getSetupVisibility():boolean
    setSetupVisibility(visibility:boolean):void
    processChannelMessage (channelObject:IChannelObject, wsEvent:any): IChannelMessageAction
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
