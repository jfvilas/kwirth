export enum MetricsConfigModeEnum {
    SNAPSHOT='snapshot',
    STREAM='stream'
}

export interface MetricsConfig {
    mode: MetricsConfigModeEnum
    aggregate: boolean
    interval: number
    metrics: string[]
}