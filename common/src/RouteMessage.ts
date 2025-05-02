import { InstanceMessage } from "./InstanceMessage"

export interface RouteMessage extends InstanceMessage {
    msgtype: 'routemessage'
    accessKey: string
    destChannel: string
    data: any
}

export interface RouteMessageResponse extends InstanceMessage {
    msgtype: 'routemessageresponse'
    data?: any
}