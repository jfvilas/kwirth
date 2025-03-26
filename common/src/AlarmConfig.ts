import { InstanceConfig } from './InstanceConfig'

export interface AlarmConfig extends InstanceConfig {
    regexInfo: string[]
    regexWarning: string[]
    regexError: string[]
}