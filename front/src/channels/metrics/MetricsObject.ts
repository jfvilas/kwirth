import { InstanceMessage } from "@jfvilas/kwirth-common"

export enum MetricsEventSeverityEnum {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error'
}

export interface AssetMetrics {
    assetName: string
    values: {
        metricName: string
        metricValue: number
    }[]
}

export interface IMetricsMessage extends InstanceMessage {
    assets: AssetMetrics[]
    timestamp: number
}

export class MetricsObject {
    public assetMetricsValues: IMetricsMessage[] = []
    public events: { severity:MetricsEventSeverityEnum, text:string }[] = []
}
