import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

class Settings {
    public logMaxMessages: number = 5000
    public logMaxPerPodMessages: number = 500
    public logFromStart: boolean = false
    public logPrevious: boolean = false
    public logTimestamp: boolean = false
    public logFollow: boolean = true
    public fromStart: boolean = false

    public metricsMode: MetricsConfigModeEnum = MetricsConfigModeEnum.STREAM
    public metricsDepth: number = 10
    public metricsWidth: number = 3
    public metricsInterval: number = 60
    public metricsAggregate: boolean = false
    public metricsMerge: boolean = false
    public metricsStack: boolean = false
    public metricsChart: string = 'area'
    
    public alertMaxAlerts: number = 25

    public trivyMaxCritical: number = 1
    public trivyMaxHigh: number = 2
    public trivyMaxMedium: number = 5
    public trivyMaxLow: number = -1

    public keepAliveInterval: number = 60
}

export { Settings }