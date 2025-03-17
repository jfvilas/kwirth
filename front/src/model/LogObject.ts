import { LogMessage, ServiceMessage } from "@jfvilas/kwirth-common";

// export class LogObject {
//     public clusterName: string = ''
//     public view?: ServiceConfigViewEnum
//     public namespace?: string
//     public group?: string
//     public pod?: string
//     public container?: string

//     public serviceInstance: string = ''
//     public messages: LogMessage[]=[]
//     public maxMessages: number=10000
//     public previous: boolean=false
//     public paused: boolean=false
//     public pending: boolean=false
//     public started: boolean=false
//     public filter: string=''
//     public addTimestamp: boolean=false
//     public showBackgroundNotification: boolean=true
//     public alarms: Alarm[]=[]
// }

export interface ILogMessage extends ServiceMessage {
    timestamp?: Date
    text: string
}

export class LogObject {
    public messages: LogMessage[] = []
    public maxMessages: number = 5000
    public previous: boolean = false
    public paused: boolean = false
    public pending: boolean = false
    public timestamp: boolean = false
    public follow: boolean = true
    public backgroundNotification: boolean = true
}
