import { TChannelConstructor, IChannel } from "../channels/IChannel"

const createChannelInstance = (channelConstructor:TChannelConstructor): IChannel | null => {
    if (!channelConstructor) throw  new Error('Error: channelConstructor is null')
    return new channelConstructor()
}

export { createChannelInstance }