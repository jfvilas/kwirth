import { ServiceConfigChannelEnum } from './ServiceConfig';
export interface ServiceMessage {
    channel: ServiceConfigChannelEnum;
    instance: string;
    type: string;
    namespace?: string;
    pod?: string;
}
