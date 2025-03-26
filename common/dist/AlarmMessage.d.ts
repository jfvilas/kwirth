import { InstanceMessage } from './InstanceMessage';
export declare enum AlarmSeverityEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export interface AlarmMessage extends InstanceMessage {
    timestamp?: Date;
    severity: AlarmSeverityEnum;
    text: string;
}
