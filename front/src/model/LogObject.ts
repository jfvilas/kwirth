import { Alert } from "./Alert";

export class LogObject {
  public name: any;
  public cluster: any;
  public scope:any;
  public namespace:any;
  public obj:any;
  public ws:any=null;
  public messages:string[]=[];
  public default:boolean=false;
  public paused:boolean=false;
  public pending:boolean=false;
  public started:boolean=false;
  public filter:string='';
  public addTimestamp:boolean=false;
  public showBackgroundNotification:boolean=true;
  public alerts:Alert[]=[];
}
