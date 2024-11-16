import { ServiceMessage } from './ServiceMessage';
export declare enum SignalMessageLevelEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export interface SignalMessage extends ServiceMessage {
    timestamp?: Date;
    level: SignalMessageLevelEnum;
    text: string;
}
