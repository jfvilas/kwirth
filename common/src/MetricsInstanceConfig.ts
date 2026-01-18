//transient
export enum MetricsConfigModeEnum {
    SNAPSHOT='snapshot',
    STREAM='stream'
}

//transient
export interface MetricsConfig {
    mode: MetricsConfigModeEnum
    aggregate: boolean
    interval: number
    metrics: string[]
}

export enum EMetricsConfigMode {
    SNAPSHOT='snapshot',
    STREAM='stream'
}

export interface IMetricsConfig {
    mode: MetricsConfigModeEnum
    aggregate: boolean
    interval: number
    metrics: string[]
}