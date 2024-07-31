import { Alarm } from "./Alarm";
import { Message } from "./Message";

export class LogObject {
  public name: any;
  public cluster: any;
  public scope:any;
  public namespace:any;
  public set:any;
  public setType:any;
  public pod:any;
  public container:any;
  public ws:any=null;
  public messages:Message[]=[];
  public buffer:string='';
  public maxMessages:number=10000;
  public previous:boolean=false;
  public defaultLog:boolean=false;
  public paused:boolean=false;
  public pending:boolean=false;
  public started:boolean=false;
  public filter:string='';
  public addTimestamp:boolean=false;
  public showBackgroundNotification:boolean=true;
  public alarms:Alarm[]=[];
}
