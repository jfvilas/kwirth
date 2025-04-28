import { InstanceMessage } from './InstanceMessage'

export interface LogMessage extends InstanceMessage {
    msgtype: 'logmessage'
    timestamp?: Date
    text: string
    namespace: string
    pod:string
    container: string
}
