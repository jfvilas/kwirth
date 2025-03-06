import { ServiceConfig } from './ServiceConfig'

export interface AlarmConfig extends ServiceConfig {
    regexInfo: string[]
    regexWarning: string[]
    regexError: string[]
}