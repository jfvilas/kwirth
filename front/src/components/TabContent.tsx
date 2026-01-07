import { InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'
import { IChannel, IChannelMessageAction, IChannelObject, IContentProps } from '../channels/IChannel'

interface IProps {
    channel?:IChannel
    // channelId?: InstanceMessageChannelEnum
    // channelObject?: IChannelObject
    //channelMessageAction: IChannelMessageAction
    // webSocket?: WebSocket
    channelObject?: IChannelObject
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    const showContent = () => {
        if (!props.channel) return
        let ChannelTabContent = props.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: props.channelObject!,
            //maxHeight: -1
        }
        return <ChannelTabContent {...channelProps}/>
    }
    return <>{ showContent() } </>
}
export { TabContent }