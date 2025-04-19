import { Box } from '@mui/material'
import { TabContentLog } from './TabContentLog'
import { TabContentAlert } from './TabContentAlert'
import { TabContentMetrics } from './TabContentMetrics'
import { IChannelObject } from '../../model/ITabObject'

interface IProps {
    channel?: string
    lastLineRef: React.MutableRefObject<null>
    channelObject?: IChannelObject
    refreshTabContent: number
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    
    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
            {/* show log lines */}
            { props.channelObject && props.channel === 'log' && props.channelObject.data &&
                <TabContentLog channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
            }

            {/* show alerts */}
            { props.channelObject && props.channel==='alert' && props.channelObject.data && 
                <TabContentAlert channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
            }

            {/* show metrics */}
            { props.channelObject && props.channel==='metrics' && props.channelObject.data && 
                <TabContentMetrics channelObject={props.channelObject} />
            }
        </Box>
    )
}
export { TabContent }