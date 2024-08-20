import { AccessKey } from "./AccessKey";

export interface LogConfig {
    accessKey:AccessKey;
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