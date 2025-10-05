import { IInstanceMessage } from "./InstanceMessage"

export enum AlertSeverityEnum {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface IAlertMessage extends IInstanceMessage {
    msgtype: 'alertmessage'
    timestamp?: Date
    severity: AlertSeverityEnum
    namespace: string
    pod: string
    container: string
    text: string
}
