import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface IAlertMessage extends InstanceMessage {
    timestamp?: Date
    severity: AlertSeverityEnum
    namespace: string
    pod: string
    container: string
    text: string
}

export enum AlertSeverityEnum {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface FiredAlert {
    timestamp: number
    severity: AlertSeverityEnum
    text:string
    namespace?:string
    group?:string
    pod?:string
    container?:string
}

export class AlertObject {
    public firedAlerts: FiredAlert[] = []
}
