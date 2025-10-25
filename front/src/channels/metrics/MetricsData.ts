import { IInstanceMessage } from "@jfvilas/kwirth-common"

export enum MetricsEventSeverityEnum {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface IAssetMetrics {
    assetName: string
    values: {
        metricName: string
        metricValue: number
    }[]
}

export interface IMetricsMessage extends IInstanceMessage {
    assets: IAssetMetrics[]
    timestamp: number
}

export interface IMetricsData {
    assetMetricsValues: IMetricsMessage[]
    events: { severity:MetricsEventSeverityEnum, text:string }[]
    paused:boolean
    started:boolean
}

export class MetricsData implements IMetricsData{
    assetMetricsValues = []
    events = []
    paused = false
    started = false
}
