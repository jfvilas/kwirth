export interface LogConfig {
    key:string;
    timestamp:boolean;
    previous:boolean;
    maxMessages:number;
    scope:string;
    namespace:string;
    setType:string;
    setName:string;
    pod:string;
    container:string;
}