import { Box } from '@mui/material'
import { TabContentLog } from './TabContentLog'
import { TabContentAlert } from './TabContentAlert'
import { TabContentMetrics } from './TabContentMetrics'
import { IChannelObject } from '../../model/ITabObject'
import { InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'
import { TabContentOps } from './TabContentOps'

interface IProps {
    channel?: InstanceMessageChannelEnum
    lastLineRef: React.MutableRefObject<null>
    channelObject?: IChannelObject
    refreshTabContent?: number
    webSocket?: WebSocket
    onShellInput: (prompt:string, terminalInput:string) => void
}

const TabContent: React.FC<IProps> = (props:IProps) => {
    
    return (<>
            {/* show log lines */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.LOG && props.channelObject.data &&
                <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                    <TabContentLog channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
                </Box>
                }

            {/* show alerts */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.ALERT && props.channelObject.data && 
                <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                    <TabContentAlert channelObject={props.channelObject} lastLineRef={props.lastLineRef}/>
                </Box>

            }

            {/* show metrics */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.METRICS && props.channelObject.data && 
                <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                    <TabContentMetrics channelObject={props.channelObject} />
                </Box>
            }
            {/* show ops */}
            { props.channelObject && props.channel === InstanceMessageChannelEnum.OPS && props.channelObject.data && 
                <TabContentOps channelObject={props.channelObject} webSocket={props.webSocket} onShellInput={props.onShellInput}/>
            }
    </>)
}
export { TabContent }