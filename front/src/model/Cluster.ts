import Guid from 'guid';

export class Cluster {
    public id:string;
    public name:string='';
    public url:string='';
    public apiKey:string='';
    public source:boolean|undefined=false;
    public inCluster:boolean=false;

    constructor () {
        this.id=Guid.create().toString();
    }
}