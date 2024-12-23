import { MetricsConfigModeEnum, ServiceConfigViewEnum } from "@jfvilas/kwirth-common";
import { Alarm } from "./Alarm";

export class MetricsObject {
    public name?: string
    public mode: MetricsConfigModeEnum = MetricsConfigModeEnum.SNAPSHOT
    public interval: number = 60
    public aggregate: boolean = true
    public depth: number = 10
    public width : number = 3
    public metrics: string[] = []
    public values: number[][] = []
    public timestamps: number[] = []
    public cluster: any
    public view?: ServiceConfigViewEnum
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string
    public serviceInstance: string = ''
    public started:boolean=false
    public paused:boolean=false
    public pending:boolean=false
    public alarms:Alarm[]=[]
}
