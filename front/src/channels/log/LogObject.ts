export interface ILogLine {
    namespace:string
    pod:string
    container:string
    timestamp?: Date
    type:string
    text:string
}

export interface ILogObject {
    messages: ILogLine[]
    pending: boolean
    backgroundNotification: boolean
    counters: Map<string,number>
    buffers: Map<string,string>
    paused:boolean
    started:boolean
}

export class LogObject implements ILogObject{
    messages: ILogLine[] = []
    pending = false
    backgroundNotification = true
    counters = new Map()
    buffers = new Map()
    paused = false
    started = false
}
