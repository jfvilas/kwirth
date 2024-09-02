export interface LogConfig {
    accessKey:string;
    timestamp:boolean;
    previous:boolean;
    maxMessages:number;
    view:string;
    scope:string;
    namespace:string;
    group:string;
    set:string;
    pod:string;
    container:string;
}