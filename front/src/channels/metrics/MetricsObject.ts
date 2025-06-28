import { InstanceMessage } from "@jfvilas/kwirth-common"

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

export interface IMetricsMessage extends InstanceMessage {
    assets: IAssetMetrics[]
    timestamp: number
}

export interface IMetricsObject {
    assetMetricsValues: IMetricsMessage[]
    events: { severity:MetricsEventSeverityEnum, text:string }[]
    paused:boolean
    started:boolean
}

export class MetricsObject implements IMetricsObject{
    assetMetricsValues = []
    events = []
    paused = false
    started = false
}
