import { ServiceMessage } from './ServiceMessage'

export enum SignalMessageLevelEnum {
    INFO='info',
    WARNING='warning',
    ERROR='error'
}

export interface SignalMessage extends ServiceMessage {
    timestamp?: Date
    level: SignalMessageLevelEnum
    text: string
}
