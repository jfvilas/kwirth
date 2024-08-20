export interface LogConfig {
    accessKey:string;
    timestamp:boolean;
    previous:boolean;
    maxMessages:number;
    scope:string;
    namespace:string;
    set:string;
    pod:string;
    container:string;
}