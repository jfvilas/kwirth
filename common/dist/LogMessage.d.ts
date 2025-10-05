import { IInstanceMessage } from './InstanceMessage';
export interface ILogMessage extends IInstanceMessage {
    msgtype: 'logmessage';
    timestamp?: Date;
    text: string;
    namespace: string;
    pod: string;
    container: string;
}
