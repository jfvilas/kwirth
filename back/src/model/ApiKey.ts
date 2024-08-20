import { AccessKey } from '../model/AccessKey';

export interface ApiKey {
    accessKey:AccessKey;
    description:string;
    expire:number;
}