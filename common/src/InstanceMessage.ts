export enum InstanceMessageTypeEnum {
    DATA='data',
    SIGNAL='signal'
}

export interface InstanceMessage {
    channel: string
    instance: string
    reconnectKey?: string
    type: InstanceMessageTypeEnum
    namespace?: string
    pod?: string
    container?: string
}
