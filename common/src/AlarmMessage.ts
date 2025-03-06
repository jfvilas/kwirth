import { ServiceMessage } from './ServiceMessage'

export enum AlarmSeverityEnum {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface AlarmMessage extends ServiceMessage {
    timestamp?: Date
    severity: AlarmSeverityEnum
    text: string
}
