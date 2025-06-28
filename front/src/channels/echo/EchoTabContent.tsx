import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { IChannelObject } from '../IChannel'
import { IEchoObject } from './EchoObject'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const EchoTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let echoObject:IEchoObject = props.channelObject.uiData
    const echoBoxRef = useRef<HTMLDivElement | null>(null)
    const [echoBoxTop, setEchoBoxTop] = useState(0)

    useEffect(() => {
        if (echoBoxRef.current) setEchoBoxTop(echoBoxRef.current.getBoundingClientRect().top)
    })


    const formatContent = () => {
        if (!echoObject || !echoObject.lines) return <></>
        return echoObject.lines.map( (line,index) => <Typography key={index}>{line}</Typography> )
    }

    return <Box ref={echoBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${echoBoxTop}px - 25px)`}}>
        <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
            { formatContent() }
        </Box>
    </Box>
    
}
export { EchoTabContent }