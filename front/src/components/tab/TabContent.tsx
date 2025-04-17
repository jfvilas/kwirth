import { Box } from '@mui/material'
import { TabContentLog } from './TabContentLog'
import { TabContentAlert } from './TabContentAlert'
import { TabContentMetrics } from './TabContentMetrics'

interface IProps {
    channel: string
    lastLineRef: React.MutableRefObject<null>
    channelObject: any
}

const TabContent: React.FC<any> = (props:IProps) => {

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
            {/* show log lines */}
            {/* {props.channelObject &&  props.channel === 'log' && props.channelObject.data && props.channelObject.data.messages && formatLog() } */}
            {props.channelObject && props.channel === 'log' && props.channelObject.data && props.channelObject.data.messages && 
                <TabContentLog channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
            }

            {/* show alerts */}
            {/* { props.channelObject && props.channel==='alert' && props.channelObject.data && props.channelObject.data.firedAlerts && formatAlert() } */}
            { props.channelObject && props.channel==='alert' && props.channelObject.data && props.channelObject.data.firedAlerts && 
                <TabContentAlert channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
            }

            {/* show metrics */}
            {/* { props.channelObject && props.channel==='metrics' && props.channelObject.data.assetMetricsValues && formatMetrics() } */}
            { props.channelObject && props.channel==='metrics' && props.channelObject.data.assetMetricsValues && 
                <TabContentMetrics channelObject={props.channelObject} />
            }
        </Box>
    )
}
export { TabContent }