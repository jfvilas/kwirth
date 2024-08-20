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

    constructor(type:string, resource:string) {
        this.id = Guid.create().toString();
        this.type = type;
        this.resource = resource;
    }

    public toString() {
        return `${this.id}|${this.type}|${this.resource}`;
    }

    public static fromString = (key:string) : AccessKey => {
        var parts=key.split('|');
        var accessKey=new AccessKey(parts[1],parts[2]);
        accessKey.id=parts[0];
        return accessKey;
      }      
}
