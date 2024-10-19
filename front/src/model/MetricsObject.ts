import { Alarm } from "./Alarm";

export class MetricsObject {
    public name?: string
    public cluster: any
    public view?: string
    public namespace?: string
    public group?: string
    public pod?: string
    public container?: string
    public ws:WebSocket|null = null
    public started:boolean=false
    public alarms:Alarm[]=[]
}
