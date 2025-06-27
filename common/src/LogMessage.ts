import { InstanceMessage } from './InstanceMessage'

export interface ILogMessage extends InstanceMessage {
    msgtype: 'logmessage'
    timestamp?: Date
    text: string
    namespace: string
    pod:string
    container: string
}
