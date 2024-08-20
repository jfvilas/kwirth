import Guid from 'guid';

/*
    Access key format is:

        id|type|resource
    
    where:
        id: is a GUID
        type: is volatile' or 'permanent' (the second type is persisted when created)
        resource: is a stringified ResourceIdentifier
*/
export class AccessKey {
    public id:string='';
    public type:string='volatile';
    public resource:string='';
}

export function accessKeyCreate(type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey();
    accessKey.id=Guid.create().toString();
    accessKey.type=type;
    accessKey.resource=resource;
    return accessKey;
}

export function accessKeyBuild(id:string, type:string, resource:string) : AccessKey {
    var accessKey=new AccessKey();
    accessKey.id=id;
    accessKey.type=type;
    accessKey.resource=resource;
    return accessKey;
}

export function accessKeySerialize (accessKey:AccessKey) : string {
    return `${accessKey.id}|${accessKey.type}|${accessKey.resource}`;
}

export function accessKeyDeserialize (key:string) : AccessKey {
    var parts=key.split('|');
    return accessKeyBuild(parts[0], parts[1], parts[2]);
}      

