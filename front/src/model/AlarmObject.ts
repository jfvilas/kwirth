import { AlarmSeverityEnum, ServiceConfigViewEnum } from "@jfvilas/kwirth-common";

export interface FiredAlarm {
    timestamp: number
    severity: AlarmSeverityEnum
    text:string
    namespace?:string
    group?:string
    pod?:string
    container?:string
}

export class AlarmObject {
    public name?: string
    public clusterName: string = ''
    public view?: ServiceConfigViewEnum
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string
    public serviceInstance: string = ''
    public started: boolean=false
    public paused: boolean=false
    public pending: boolean=false
    public regexInfo: string[] = []
    public regexWarning: string[] = []
    public regexError: string[] = []
    public firedAlarms: FiredAlarm[] = []
}
