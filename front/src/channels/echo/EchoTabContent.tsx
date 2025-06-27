import { Box, Typography } from '@mui/material'
import { EchoObject } from './EchoObject'
import { IChannelObject } from '../IChannel'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const EchoTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let echoObject = props.channelObject.uiData as EchoObject

    const formatContent = () => {
        if (!echoObject || !echoObject.lines) return <></>
        return echoObject.lines.map( (line,index) => <Typography key={index}>{line}</Typography> )
    }

    return (
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
            { formatContent() }
        </Box>
    )
}
export { EchoTabContent }