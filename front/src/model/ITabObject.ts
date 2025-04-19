import { InstanceConfigViewEnum } from "@jfvilas/kwirth-common"
import { AlertObject } from "./AlertObject"
import { LogObject } from "./LogObject"
import { MetricsObject } from "./MetricsObject"

interface IChannelObject {
    clusterName: string
    view: InstanceConfigViewEnum
    namespace: string
    group: string
    pod: string
    container: string
    instance: string
    data: LogObject | MetricsObject | AlertObject | undefined
}

interface ITabObject {
    name?: string
    ws: WebSocket|null
    keepaliveRef: number
    defaultTab: boolean
    channelId: string
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
}

export type { ITabObject }
export type { IChannelObject }