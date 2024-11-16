import { ServiceConfig } from './ServiceConfig';

export interface LogConfig extends ServiceConfig {
    timestamp: boolean
    previous: boolean
    maxMessages: number
}