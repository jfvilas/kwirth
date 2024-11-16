import { ServiceMessage } from "./ServiceMessage";

export interface MetricsMessage extends ServiceMessage  {
    value: number[]
    timestamp?: Date
}
