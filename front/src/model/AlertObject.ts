import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface IAlertMessage extends InstanceMessage {
    timestamp?: Date
    severity: AlertSeverityEnum
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
    public name?: string
    public regexInfo: string[] = []
    public regexWarning: string[] = []
    public regexError: string[] = []
    public firedAlerts: FiredAlert[] = []
    public maxAlerts: number = 15
}
