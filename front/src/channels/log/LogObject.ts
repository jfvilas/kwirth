import { InstanceMessage } from "@jfvilas/kwirth-common";

export interface ILogMessage extends InstanceMessage {
    msgtype: 'logmessage'
    timestamp?: Date
    text: string
    namespace: string
    pod: string
    container: string
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
    public messages: ILogLine[] = []
    public paused: boolean = false
    public pending: boolean = false
    public backgroundNotification: boolean = true
    public counters: Map<string,number> = new Map()
    public buffers: Map<string,string> = new Map()
}
