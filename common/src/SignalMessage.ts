import { InstanceMessage } from './InstanceMessage'

export enum SignalMessageLevelEnum {
    INFO='info',
    WARNING='warning',
    ERROR='error'
}

export interface SignalMessage extends InstanceMessage {
    timestamp?: Date
    level: SignalMessageLevelEnum
    text: string
}
