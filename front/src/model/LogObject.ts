import { Alarm } from "./Alarm";
import { LogMessage, ServiceConfigViewEnum } from "@jfvilas/kwirth-common";
import { Cluster } from "./Cluster";

export class LogObject {
    //public name?: string
    public clusterName: string = ''
    public view?: ServiceConfigViewEnum
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string

    public serviceInstance: string = ''
    // public ws:WebSocket|null = null
    public messages:LogMessage[]=[]
    public maxMessages:number=10000
    public previous:boolean=false
    // public defaultLog:boolean=false
    public paused:boolean=false
    public pending:boolean=false
    public started:boolean=false
    public filter:string=''
    public addTimestamp:boolean=false
    public showBackgroundNotification:boolean=true
    public alarms:Alarm[]=[]
}
