import { ServiceMessage } from "./ServiceMessage";
export interface MetricsMessage extends ServiceMessage {
    metrics: string[];
    value: number[];
}
