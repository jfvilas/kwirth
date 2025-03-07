import { AlarmObject } from "./AlarmObject"
import { LogObject } from "./LogObject"
import { MetricsObject } from "./MetricsObject"

export class TabObject {
    public name?: string
    public ws: WebSocket|null = null
    public keepalive: number = 60
    public defaultTab: boolean = false
    public logObject?: LogObject
    public metricsObject?: MetricsObject
    public alarmObject?: AlarmObject
    //public operObject?: OperObject
    //public auditObject?: AuditObject
}
