import { IInstanceMessage } from './InstanceMessage'

// transient
export enum SignalMessageLevelEnum {
    INFO='info',
    WARNING='warning',
    ERROR='error'
}

// transient
export enum SignalMessageEventEnum {
    ADD='add',
    DELETE='delete',
    OTHER='other'
}

export enum ESignalMessageLevel {
    INFO='info',
    WARNING='warning',
    ERROR='error'
}

export enum ESignalMessageEvent {
    ADD='add',
    DELETE='delete',
    OTHER='other'
}

export interface ISignalMessage extends IInstanceMessage {
    timestamp?: Date
    namespace?: string
    pod?: string
    container?: string
    level: ESignalMessageLevel
    data?: any
    text?: string
    event?: ESignalMessageEvent
}
