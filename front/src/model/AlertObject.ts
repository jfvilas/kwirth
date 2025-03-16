import { ServiceConfigViewEnum } from "@jfvilas/kwirth-common";

export interface FiredAlert {
    timestamp: number
    severity: any  //+++
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
