import { InstanceMessage } from "./InstanceMessage";
export interface AssetMetrics {
    assetName: string;
    values: {
        metricName: string;
        metricValue: number;
    }[];
}
export interface MetricsMessage extends InstanceMessage {
    msgtype: 'metricsmessage';
    assets: AssetMetrics[];
    timestamp: number;
    namespace: string;
    pod: string;
    container: string;
}
