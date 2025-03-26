import { InstanceConfig } from './InstanceConfig';

export interface LogConfig extends InstanceConfig {
    timestamp: boolean
    previous: boolean
    maxMessages: number
}