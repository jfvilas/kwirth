import { InstanceMessage } from "./InstanceMessage"

export interface IEchoMessage extends InstanceMessage {
    msgtype: 'echomessage'
    namespace: string
    pod: string
    container: string
    text: string
}

export interface IEchoMessageResponse extends InstanceMessage {
    msgtype: 'echomessageresponse'
    text: string
}

