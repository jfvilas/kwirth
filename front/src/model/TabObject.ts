import { LogObject } from "./LogObject"
import { MetricsObject } from "./MetricsObject"

export class TabObject {
    public name?: string
    public ws: WebSocket|null = null
    public defaultTab: boolean = false
    public logObject?: LogObject
    public metricsObject?: MetricsObject
    //public operObject?: OperObject
    //public auditObject?: AuditObject
    //public alertObject?: AlertObject
}
