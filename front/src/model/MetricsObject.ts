import { MetricsConfigModeEnum, InstanceMessage } from "@jfvilas/kwirth-common";

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
    public name?: string
    public mode: MetricsConfigModeEnum = MetricsConfigModeEnum.SNAPSHOT
    public interval: number = 60
    public depth: number = 10
    public width : number = 3
    public metrics: string[] = []
    public assetMetricsValues: IMetricsMessage[] = []
    public aggregate: boolean = true
    public merge : boolean = false
    public stack : boolean = false
    public chart : string = 'line'
    public errors : string = ''
}
