import { InstanceMessage } from './InstanceMessage';
export declare enum SignalMessageLevelEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export interface SignalMessage extends InstanceMessage {
    timestamp?: Date;
    namespace?: string;
    pod?: string;
    container?: string;
    level: SignalMessageLevelEnum;
    text: string;
}
