import { ServiceConfigChannelEnum } from './ServiceConfig'

export interface ServiceMessage {
    channel: ServiceConfigChannelEnum
    instance: string
    type: string    // +++ need enum here
    namespace?: string
    pod?: string
}
