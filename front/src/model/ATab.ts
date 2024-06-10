import { Alert } from "./Alerts";

export class ATab {
  public cluster: any;
  public tabname: any;
  public ws:any=null;
  public scope:any;
  public namespace:any;
  public obj:any;
  public messages:string[]=[];
  public paused:boolean=false;
  public pending:boolean=false;
  public started:boolean=false;
  public filter:string='';
  public addTimestamp:boolean=false;
  public showBackgroundNotification:boolean=true;
  public alerts:Alert[]=[];
}
  
  