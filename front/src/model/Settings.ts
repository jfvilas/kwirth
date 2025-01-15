import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

class Settings {
    public logMaxMessages: number = 1000
    public logPrevious: boolean = false
    public logTimestamp: boolean = false

    public metricsMode: MetricsConfigModeEnum = MetricsConfigModeEnum.STREAM
    public metricsDepth: number = 10
    public metricsWidth: number = 3
    public metricsInterval: number = 60
    public metricsAggregate: boolean = true

    public clusterMetricsInterval: number = 120
}

export { Settings }