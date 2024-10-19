import Guid from 'guid';
import { MetricDescription } from './MetricDescription';

export class Cluster {
    public id:string
    public name:string=''
    public url:string=''
    public accessString:string=''
    public source:boolean|undefined=false
    public inCluster:boolean=false
    public metricList:Map<string,MetricDescription> = new Map()
    
    constructor () {
        this.id=Guid.create().toString()
    }
}