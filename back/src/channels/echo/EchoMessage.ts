import { InstanceMessage } from "@jfvilas/kwirth-common"

export interface IEchoMessageResponse extends InstanceMessage {
    msgtype: 'echomessage'
    text: string
}
