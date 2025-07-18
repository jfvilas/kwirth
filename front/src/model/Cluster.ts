import { v4 as uuid } from 'uuid'
import { MetricDescription } from '../channels/metrics/MetricDescription'
import { KwirthData } from '@jfvilas/kwirth-common'

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