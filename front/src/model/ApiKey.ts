export class ApiKey {
    public accessKey:string|null=null;
    public description:string|null=null;
    //+++ decide whether to use Date object or an epoch
    public expire:string|undefined=undefined;
}