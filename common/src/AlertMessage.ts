import { IInstanceMessage } from "./InstanceMessage"

export enum EAlertSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface IAlertMessage extends IInstanceMessage {
    msgtype: 'alertmessage'
    timestamp?: Date
    severity: EAlertSeverity
    namespace: string
    pod: string
    container: string
    text: string
}
