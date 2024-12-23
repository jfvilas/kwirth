import { ServiceConfig } from "./ServiceConfig";
export declare enum MetricsConfigModeEnum {
    SNAPSHOT = "snapshot",
    STREAM = "stream"
}
export interface MetricsConfig extends ServiceConfig {
    mode: MetricsConfigModeEnum;
    metrics: string[];
    interval?: number;
    aggregate: boolean;
}
