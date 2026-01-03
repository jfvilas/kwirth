import { TChannelConstructor, IChannel } from "../channels/IChannel"
import { ENotifyLevel } from "./Global"


const createChannelInstance = (channelConstructor:TChannelConstructor, notify: (level: ENotifyLevel, msg: string) => void): IChannel | null => {
    if (!channelConstructor) throw 'Error: channelConstructor is null'
    let channel = new channelConstructor()
    if (channel) channel.setNotifier(notify)
    return channel
}

export { createChannelInstance }