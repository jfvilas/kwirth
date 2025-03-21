export enum ServiceMessageTypeEnum {
    DATA='data',
    SIGNAL='signal'
}

export interface ServiceMessage {
    channel: string
    instance: string
    reconnectKey?: string
    type: ServiceMessageTypeEnum
    namespace?: string
    pod?: string
    container?: string
}
