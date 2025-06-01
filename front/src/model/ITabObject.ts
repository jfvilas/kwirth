import { InstanceConfigViewEnum, InstanceMessageChannelEnum } from "@jfvilas/kwirth-common"
import { AlertObject } from "./AlertObject"
import { LogObject } from "./LogObject"
import { MetricsObject } from "./MetricsObject"
import { OpsObject } from "./OpsObject"
import { TrivyObject } from "./TrivyObject"

interface IChannelObject {
    clusterName: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    instance: string
    data: LogObject | MetricsObject | AlertObject | OpsObject | TrivyObject | undefined
}

interface ITabObject {
    name?: string
    ws: WebSocket|undefined
    keepaliveRef: number
    defaultTab: boolean
    channelId: InstanceMessageChannelEnum
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
}

export type { ITabObject }
export type { IChannelObject }