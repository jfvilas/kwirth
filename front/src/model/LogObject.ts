import { LogMessage, InstanceMessage } from "@jfvilas/kwirth-common";

export interface ILogMessage extends InstanceMessage {
    timestamp?: Date
    text: string
    namespace: string
    pod: string
    container: string
    msgtype: 'logmessage'
}

export class LogObject {
    public accessKey: string = ''
    public messages: LogMessage[] = []
    public maxMessages: number = 5000
    public previous: boolean = false
    public paused: boolean = false
    public pending: boolean = false
    public timestamp: boolean = false
    public follow: boolean = true
    public fromStart: boolean = false
    public startDiagnostics: boolean = false
    public backgroundNotification: boolean = true
}
