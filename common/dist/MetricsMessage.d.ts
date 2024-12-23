import { ServiceMessage } from "./ServiceMessage";
export interface AssetMetrics {
    name: string;
    values: {
        name: string;
        value: number;
    }[];
}
export interface MetricsMessage extends ServiceMessage {
    assets: AssetMetrics[];
    timestamp: number;
}
