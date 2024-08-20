import { AccessKey } from "common/dist";

export interface ApiKey {
    accessKey:AccessKey;
    description:string;
    expire:number;
}
