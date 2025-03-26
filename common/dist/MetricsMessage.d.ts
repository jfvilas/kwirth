import { InstanceMessage } from "./InstanceMessage";
export interface AssetMetrics {
    assetName: string;
    values: {
        metricName: string;
        metricValue: number;
    }[];
}
export interface MetricsMessage extends InstanceMessage {
    assets: AssetMetrics[];
    timestamp: number;
}
