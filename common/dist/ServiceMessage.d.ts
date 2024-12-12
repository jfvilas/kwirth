import { ServiceConfigChannelEnum } from './ServiceConfig';
export declare enum ServiceMessageTypeEnum {
    DATA = "data",
    SIGNAL = "signal"
}
export interface ServiceMessage {
    channel: ServiceConfigChannelEnum;
    instance: string;
    type: ServiceMessageTypeEnum;
    namespace?: string;
    pod?: string;
}
