import { MetricsConfigModeEnum, MetricsMessage } from "@jfvilas/kwirth-common";

export class MetricsObject {
    public name?: string
    public mode: MetricsConfigModeEnum = MetricsConfigModeEnum.SNAPSHOT
    public interval: number = 60
    public depth: number = 10
    public width : number = 3
    public metrics: string[] = []
    public assetMetricsValues: MetricsMessage[] = []
    public aggregate: boolean = true
    public merge : boolean = false
    public stack : boolean = false
    public type : string = 'line'
}
