import { IInstanceMessage } from "./InstanceMessage"

export interface IRouteMessage extends IInstanceMessage {
    msgtype: 'routemessage'
    accessKey: string
    destChannel: string
    data: any
}

export interface IRouteMessageResponse extends IInstanceMessage {
    msgtype: 'routemessageresponse'
    data?: any
}