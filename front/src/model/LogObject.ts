import { InstanceMessage } from "@jfvilas/kwirth-common";

export interface ILogMessage extends InstanceMessage {
    timestamp?: Date
    text: string
    namespace: string
    pod: string
    container: string
    msgtype: 'logmessage'
}

export interface ILogLine {
    namespace:string
    pod:string
    container:string
    timestamp?: Date
    type:string
    text:string
}

export class LogObject {
    public accessKey: string = ''
    public messages: ILogLine[] = []
    public counters: Map<string,number> = new Map()
    public sortOrder:string = 'pod'
    public maxMessages: number = 5000
    public maxPerPodMessages: number = 1000
    public previous: boolean = false
    public paused: boolean = false
    public pending: boolean = false
    public timestamp: boolean = false
    public follow: boolean = true
    public fromStart: boolean = false
    public startDiagnostics: boolean = false
    public backgroundNotification: boolean = true
    public buffers: Map<string,string> = new Map()
}
