import { InstanceMessage } from "./InstanceMessage"

export interface TrivyMessage extends InstanceMessage {
    msgtype: 'trivymessage'
    id: string
    accessKey: string
    instance: string
    namespace: string
    kind: string
    pod:string
    container: string
}

export interface TrivyMessageResponse extends InstanceMessage {
    msgtype: 'trivymessageresponse'
    id: string
    namespace: string
    kind: string
    pod: string
    container: string
    data?: any
}
