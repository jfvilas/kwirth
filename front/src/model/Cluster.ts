import { v4 as uuid } from 'uuid'
import { MetricDescription } from '../channels/metrics/MetricDescription';

export enum ClusterTypeEnum {
    KUBERNETES = 'kubernetes',
    DOCKER = 'docker'
}

export interface BackChannelData {
    id: string
    routable: boolean  // instance can receive routed commands
    pauseable: boolean  // instance can be paused
    modifyable: boolean  // instance can be modified
    reconnectable: boolean  // instance supports client reconnect requests
    sources: string[]  // array of sources (kubernetes, docker...)
    metrics: boolean  // this channel requires metrics
}

export interface KwirthData {
    version: string
    lastVersion: string
    clusterName: string
    clusterType: ClusterTypeEnum
    inCluster: boolean
    namespace: string
    deployment: string
    metricsInterval: number
    channels: BackChannelData[]
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
    
    constructor () {
        this.id = uuid()
    }
}