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

export interface IAlertObject {
    firedAlerts: FiredAlert[]
    paused:boolean
    started:boolean
}

export class AlertObject implements IAlertObject {
    firedAlerts = []
    paused = false
    started = false
}
