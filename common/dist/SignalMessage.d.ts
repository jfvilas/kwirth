import { IInstanceMessage } from './InstanceMessage';
export declare enum SignalMessageLevelEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export declare enum SignalMessageEventEnum {
    ADD = "add",
    DELETE = "delete",
    OTHER = "other"
}
export declare enum ESignalMessageLevel {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export declare enum ESignalMessageEvent {
    ADD = "add",
    DELETE = "delete",
    OTHER = "other"
}
export interface ISignalMessage extends IInstanceMessage {
    timestamp?: Date;
    namespace?: string;
    pod?: string;
    container?: string;
    level: ESignalMessageLevel;
    data?: any;
    text?: string;
    event?: ESignalMessageEvent;
}
