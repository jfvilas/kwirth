import { IChannel, IChannelObject, IContentProps } from '../channels/IChannel'

interface IProps {
    channel?:IChannel
    channelObject?: IChannelObject
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    const showContent = () => {
        if (!props.channel) return
        let ChannelTabContent = props.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: props.channelObject!
        }
        return <ChannelTabContent {...channelProps}/>
    }
    return <>{ showContent() } </>
}
export { TabContent }