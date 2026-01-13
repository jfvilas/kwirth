import { IInstanceMessage } from './InstanceMessage'

export enum SignalMessageLevelEnum {
    INFO='info',
    WARNING='warning',
    ERROR='error'
}

export enum SignalMessageEventEnum {
    ADD='add',
    DELETE='delete',
    OTHER='other'
}

export interface ISignalMessage extends IInstanceMessage {
    timestamp?: Date
    namespace?: string
    pod?: string
    container?: string
    level: SignalMessageLevelEnum
    data?: any
    text?: string
    event?: SignalMessageEventEnum
}
