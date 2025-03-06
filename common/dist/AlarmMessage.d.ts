import { ServiceMessage } from './ServiceMessage';
export declare enum AlarmSeverityEnum {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error"
}
export interface AlarmMessage extends ServiceMessage {
    timestamp?: Date;
    severity: AlarmSeverityEnum;
    text: string;
}
