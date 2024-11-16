import { MetricsConfigModeEnum, ServiceConfigViewEnum } from "@jfvilas/kwirth-common";
import { Alarm } from "./Alarm";

export class MetricsObject {
    public name?: string
    public mode: MetricsConfigModeEnum = MetricsConfigModeEnum.SNAPSHOT
    public metrics: string[] = []
    public values: number[] = []
    public cluster: any
    public view?: ServiceConfigViewEnum
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string
    public serviceInstance: string = ''
//    public ws:WebSocket|null = null
    public started:boolean=false
    public alarms:Alarm[]=[]
}
