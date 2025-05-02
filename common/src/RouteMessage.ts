import { InstanceMessage } from "./InstanceMessage"

export interface RouteMessage extends InstanceMessage {
    accessKey: string
    destChannel: string
    data: any
}
