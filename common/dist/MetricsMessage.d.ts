import { ServiceMessage } from "./ServiceMessage";
export interface AssetMetrics {
    assetName: string;
    values: {
        metricName: string;
        metricValue: number;
    }[];
}
export interface MetricsMessage extends ServiceMessage {
    assets: AssetMetrics[];
    timestamp: number;
}
