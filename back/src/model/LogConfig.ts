export interface LogConfig {
    key:string;
    timestamp:boolean;
    previous:boolean;
    maxMessages:number;
    scope:string;
    namespace:string;
    setType:string;
    pod:string;
    container:string;
}