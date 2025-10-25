import { AlertSeverityEnum } from "@jfvilas/kwirth-common"

export interface FiredAlert {
    timestamp: number
    severity: AlertSeverityEnum
    text:string
    namespace?:string
    group?:string
    pod?:string
    container?:string
}

export interface IAlertData {
    firedAlerts: FiredAlert[]
    paused:boolean
    started:boolean
}

export class AlertData implements IAlertData {
    firedAlerts = []
    paused = false
    started = false
}
