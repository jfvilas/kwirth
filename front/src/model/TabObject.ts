import { LogObject } from "./LogObject"
import { MetricsObject } from "./MetricsObject"

export class TabObject {
    public name?: string
    public ws:WebSocket|null = null
    public logObject?: LogObject
    public metricsObject?: MetricsObject
    public defaultTab:boolean = false
    //public operObject?: OperObject
    //public auditObject?: AuditObject
    //public alertObject?: AlertObject
}
