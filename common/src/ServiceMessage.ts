import { ServiceConfigChannelEnum } from './ServiceConfig'

export enum ServiceMessageTypeEnum {
    DATA='data',
    SIGNAL='signal'
}

export interface ServiceMessage {
    channel: ServiceConfigChannelEnum
    instance: string
    type: ServiceMessageTypeEnum
    namespace?: string
    pod?: string
    container?: string
}
