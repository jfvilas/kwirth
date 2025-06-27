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

export class AlertObject {
    public firedAlerts: FiredAlert[] = []
}
