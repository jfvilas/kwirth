import { IInstanceMessage } from "./InstanceMessage"

export interface IEchoMessage extends IInstanceMessage {
    msgtype: 'echomessage'
    namespace: string
    pod: string
    container: string
    text: string
}

export interface IEchoMessageResponse extends IInstanceMessage {
    msgtype: 'echomessageresponse'
    text: string
}

