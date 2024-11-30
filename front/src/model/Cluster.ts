import Guid from 'guid';
import { MetricDescription } from './MetricDescription';
import { KwirthData } from '@jfvilas/kwirth-common';

export class Cluster {
    public id:string
    public name:string=''
    public url:string=''
    public accessString:string=''
    public source:boolean|undefined=false
    public inCluster:boolean=false
    public metricsList:Map<string,MetricDescription> = new Map()
    public kwirthData?: KwirthData
    
    constructor () {
        this.id=Guid.create().toString()
    }
}