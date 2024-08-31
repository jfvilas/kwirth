import { AccessKey } from '../model/AccessKey';

export interface ApiKey {
    accessKey:AccessKey;
    description:string;
    expire:number;
}

export const cleanApiKeys = (apiKeys:ApiKey[]) => {
    apiKeys=apiKeys.filter(a => a.expire>=Date.now());
    return apiKeys;
}
