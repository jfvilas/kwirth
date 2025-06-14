import { InstanceMessageChannelEnum } from "@jfvilas/kwirth-common"
import { IChannel, IChannelObject } from "../channels/IChannel"

interface ITabObject {
    name?: string
    ws: WebSocket|undefined
    keepaliveRef: number
    defaultTab: boolean
    channel: IChannel|undefined
    channelId: InstanceMessageChannelEnum
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
}

export type { ITabObject }
