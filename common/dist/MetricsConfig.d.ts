import { InstanceConfig } from "./InstanceConfig";
export declare enum MetricsConfigModeEnum {
    SNAPSHOT = "snapshot",
    STREAM = "stream"
}
export interface MetricsConfig extends InstanceConfig {
    mode: MetricsConfigModeEnum;
    metrics: string[];
    interval?: number;
    aggregate: boolean;
}
