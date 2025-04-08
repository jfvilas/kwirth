import Guid from 'guid';
import { MetricDescription } from './MetricDescription';
import { KwirthData } from '@jfvilas/kwirth-common';

export enum ClusterTypeEnum {
    KUBERNETES = 'kubernetes',
    DOCKER = 'docker'
}

export class Cluster {
    public id: string
    public name: string = ''
    public enabled: boolean = true
    public url: string = ''
    public accessString: string = ''
    public source: boolean|undefined = false
    public inCluster: boolean = false
    public metricsList: Map<string,MetricDescription> = new Map()
    public kwirthData?: KwirthData
    public metricsInterval: number = 60
    public type: ClusterTypeEnum = ClusterTypeEnum.KUBERNETES
    public channels: string[] = []
    
    constructor () {
        this.id=Guid.create().toString()
    }
}