import { MetricsConfigModeEnum } from "@jfvilas/kwirth-common"
import { MetricDescription } from "./MetricDescription"

interface IMetricsUiConfig {
    metricsList: Map<string,MetricDescription>
    depth: number
    width: number
    merge: boolean 
    stack: boolean
    chart: string
}

class MetricsUiConfig implements IMetricsUiConfig{
    metricsList = new Map()
    depth = 20
    width = 3
    merge = false
    stack = false
    chart = 'line'
}

interface IMetricsInstanceConfig {
    mode: MetricsConfigModeEnum
    aggregate: boolean
    interval: number
    metrics: string[]
}

class MetricsInstanceConfig implements IMetricsInstanceConfig{
    mode = MetricsConfigModeEnum.STREAM
    aggregate = false
    interval = 15
    metrics:string[] = []
}

export type { IMetricsUiConfig, IMetricsInstanceConfig }
export { MetricsUiConfig, MetricsInstanceConfig }
