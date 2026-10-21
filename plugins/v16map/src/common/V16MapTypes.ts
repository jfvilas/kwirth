import { IInstanceMessage } from '@kwirthmagnify/kwirth-common'

/**
 * One DATEX2 situation reduced to what the map needs. The back end does the reduction: the raw
 * situation is a deep tree of strings, and shipping hundreds of them to every tab would be wasteful.
 */
export interface IV16Point {
    /** DATEX2 situation id */
    id: string
    /** absent when the situation carries no coordinates (it is listed, but not drawn) */
    lat?: number
    lon?: number
    /** raised by a V16 emergency beacon */
    v16: boolean
    road?: string
    km?: string
    /** DATEX2 causeType, or the record type when there is no cause */
    cause?: string
    detail?: string
    municipality?: string
    province?: string
    community?: string
    direction?: string
    /** ISO time the situation started */
    start?: string
}

/** What the instance setup decides. */
export interface IV16MapInstanceConfig {
    /** only V16 beacon situations; false means every situation in the feed */
    v16Only: boolean
}

/** Nature of the message the back end sends the front end. */
export enum EV16MapPayload {
    /** the whole picture: replaces whatever the tab had */
    SNAPSHOT = 'snapshot',
    /** only what changed since the previous message */
    CHANGES = 'changes'
}

export interface IV16MapMessageResponse extends IInstanceMessage {
    msgtype: 'v16mapmessageresponse'
    payloadType: EV16MapPayload
    added: IV16Point[]
    updated: IV16Point[]
    removed: string[]
    /** epoch ms the back end received the event */
    at: number
}

/** The provider this channel consumes. */
export const V16_PROVIDER_ID = 'v16'
