import { Alarm } from "./Alarm";
import { LogMessage } from "@jfvilas/kwirth-common";

export class LogObject {
    public name?: string
    public cluster: any
    public view?: string
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string
    public ws:WebSocket|null = null
    public messages:LogMessage[]=[]
    public maxMessages:number=10000
    public previous:boolean=false
    public defaultLog:boolean=false
    public paused:boolean=false
    public pending:boolean=false
    public started:boolean=false
    public filter:string=''
    public addTimestamp:boolean=false
    public showBackgroundNotification:boolean=true
    public alarms:Alarm[]=[]
}
