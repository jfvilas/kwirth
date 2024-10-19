import { ServiceConfig } from "./ServiceConfig";

export enum MetricsConfigModeEnum {
    SNAPSHOT='snapshot',
    STREAM='stream'
}

export interface MetricsConfig extends ServiceConfig {
    mode: MetricsConfigModeEnum
    metrics: string[]
    interval?: number
}