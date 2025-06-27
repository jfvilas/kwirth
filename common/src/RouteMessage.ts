import { InstanceMessage } from "./InstanceMessage"

export interface IRouteMessage extends InstanceMessage {
    msgtype: 'routemessage'
    accessKey: string
    destChannel: string
    data: any
}

export interface IRouteMessageResponse extends InstanceMessage {
    msgtype: 'routemessageresponse'
    data?: any
}