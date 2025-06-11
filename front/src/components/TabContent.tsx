import { TabContentLog } from '../channels/log/TabContentLog'
import { TabContentMetrics } from '../channels/metrics/TabContentMetrics'
import { InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'
import { TabContentOps } from '../channels/ops/TabContentOps'
import { TabContentTrivy } from '../channels/trivy/TabContentTrivy'
import { IChannel, IChannelObject, IContentProps } from '../channels/IChannel'

interface IProps {
    channel?:IChannel
    channelId?: InstanceMessageChannelEnum
    lastLineRef: React.MutableRefObject<null>
    channelObject?: IChannelObject
    refreshTabContent?: number
    webSocket?: WebSocket
    //xfrontChannels: Map<string, ChannelConstructor>
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
        {/* show log lines */}
        { props.channelObject && props.channelId === InstanceMessageChannelEnum.LOG && props.channelObject.uiData &&
            <TabContentLog channelObject={props.channelObject} lastLineRef={props.lastLineRef} webSocket={props.webSocket}/>
        }

        {/* show metrics */}
        { props.channelObject && props.channelId === InstanceMessageChannelEnum.METRICS && props.channelObject.uiData && 
            <TabContentMetrics channelObject={props.channelObject}/>
        }

        {/* show ops */}
        { props.channelObject && props.channelId === InstanceMessageChannelEnum.OPS && props.channelObject.uiData && 
            <TabContentOps channelObject={props.channelObject} webSocket={props.webSocket}/>
        }

        {/* show trivy */}
        { props.channelObject && props.channelId === InstanceMessageChannelEnum.TRIVY && props.channelObject.uiData &&
            <TabContentTrivy channelObject={props.channelObject} webSocket={props.webSocket!}/>
        }

        {/* show generic channels */}
        { 
            showContent()
        }


    </>)
}
export { TabContent }