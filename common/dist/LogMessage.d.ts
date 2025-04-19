import { InstanceMessage } from './InstanceMessage';
export interface LogMessage extends InstanceMessage {
    timestamp?: Date;
    text: string;
    namespace: string;
    pod: string;
    container: string;
}
