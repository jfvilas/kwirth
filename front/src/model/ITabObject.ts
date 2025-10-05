import { InstanceMessageChannelEnum } from "@jfvilas/kwirth-common"
import { IChannel, IChannelObject } from "../channels/IChannel"

interface ITabObject {
    name: string
    ws: WebSocket|undefined
    keepaliveRef: number
    defaultTab: boolean
    channel: IChannel
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
    headerEl:any
}

interface ITabSummary {
    name: string
    channel: string
    channelObject: {
        clusterName: string
        view: string
        namespace: string
        group: string
        pod: string
        container: string
    }
}

export type { ITabObject, ITabSummary }
