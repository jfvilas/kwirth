import { InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'
import { TabContentOps } from '../channels/ops/TabContentOps'
import { IChannel, IChannelObject, IContentProps } from '../channels/IChannel'

interface IProps {
    channel?:IChannel
    channelId?: InstanceMessageChannelEnum
    channelObject?: IChannelObject
    refreshTabContent?: number
    webSocket?: WebSocket
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    const showContent = () => {
        if (!props.channel) return
        let ChannelTabContent = props.channel.TabContent
        let cprops:IContentProps = {
            webSocket: props.webSocket,
            channelObject: props.channelObject!
        }
        return <ChannelTabContent {...cprops}/>
    }

    return (<>
        {/* show ops */}
        { props.channelObject && props.channelId === InstanceMessageChannelEnum.OPS && props.channelObject.uiData && 
            <TabContentOps channelObject={props.channelObject} webSocket={props.webSocket}/>
        }

        {/* show generic channels */}
        { 
            showContent()
        }


    </>)
}
export { TabContent }