import { ServiceMessage } from './ServiceMessage';

export interface LogMessage extends ServiceMessage {
    timestamp?:Date
    text:string
}
