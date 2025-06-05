import { Box } from '@mui/material'
import { TabContentLog } from './log/TabContentLog'
import { TabContentAlert } from './alert/TabContentAlert'
import { TabContentMetrics } from './metrics/TabContentMetrics'
import { IChannelObject } from '../../model/ITabObject'
import { InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'
import { TabContentOps } from './ops/TabContentOps'
import { TabContentTrivy } from './trivy/TabContentTrivy'

interface IProps {
    channel?: InstanceMessageChannelEnum
    lastLineRef: React.MutableRefObject<null>
    channelObject?: IChannelObject
    refreshTabContent?: number
    webSocket?: WebSocket
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    return (<>
            {/* show log lines */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.LOG && props.channelObject.data &&
                <TabContentLog channelObject={props.channelObject} lastLineRef={props.lastLineRef} webSocket={props.webSocket}/>
            }

            {/* show alerts */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.ALERT && props.channelObject.data && 
                <TabContentAlert channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
            }

            {/* show metrics */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.METRICS && props.channelObject.data && 
                <TabContentMetrics channelObject={props.channelObject}/>
            }

            {/* show ops */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.OPS && props.channelObject.data && 
                <TabContentOps channelObject={props.channelObject} webSocket={props.webSocket}/>
            }

            {/* show trivy */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.TRIVY && props.channelObject.data &&
                <TabContentTrivy channelObject={props.channelObject} webSocket={props.webSocket!}/>

            }
    </>)
}
export { TabContent }