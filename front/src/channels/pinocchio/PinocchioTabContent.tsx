import { useEffect, useRef, useState } from 'react'
import { Box, Card, CardContent, CardHeader, Stack, Typography } from '@mui/material'
import { IChannelObject } from '../IChannel'
import { IPinocchioData } from './PinocchioData'
import { Info } from '@mui/icons-material'
import { IPinocchioConfig, IPinocchioInstanceConfig } from './PinocchioConfig'

interface IContentProps {
    webSocket?: WebSocket
    channelObject: IChannelObject
}

const PinocchioTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    let pinocchioData:IPinocchioData = props.channelObject.data
    let pinocchioConfig:IPinocchioConfig = props.channelObject.config
    let pinocchioInstanceConfig:IPinocchioInstanceConfig = props.channelObject.instanceConfig
    const pinocchioBoxRef = useRef<HTMLDivElement | null>(null)
    const [pinocchioBoxTop, setPinocchioBoxTop] = useState(0)

    useEffect(() => {
        if (pinocchioBoxRef.current) setPinocchioBoxTop(pinocchioBoxRef.current.getBoundingClientRect().top)
    })


    const formatContent = () => {
        if (!pinocchioData || !pinocchioData.lines) return <></>
        return pinocchioData.lines.map( (line,index) => <Typography key={index}>{line}</Typography> )
    }

    return (
        <>
        { pinocchioData.started && 
        <Card sx={{flex:1, width:'98%', alignSelf:'center', margin:'8px'}}>
            <CardHeader title={
                <Stack direction={'row'} alignItems={'center'}>
                    <Typography marginRight={'32px'}><b>Lines:</b> {pinocchioData.lines.length} / {pinocchioConfig.maxLines}</Typography>
                    <Typography marginRight={'32px'}><b>Interval:</b> {pinocchioInstanceConfig.interval}</Typography>
                    <Typography marginRight={'32px'}><Info fontSize='small' sx={{marginBottom:'2px'}} /><b>&nbsp;Status:</b> {pinocchioData.paused?'paused':pinocchioData.started?'started':'stopped'}</Typography>
                </Stack>}>
            </CardHeader>
            <CardContent>
                <Box ref={pinocchioBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height: `calc(100vh - ${pinocchioBoxTop}px - 35px)`}}>
                    <Box sx={{ flex:1, overflowY: 'auto', ml:1, mr:1 }}>
                        { formatContent() }
                    </Box>
                </Box>
            </CardContent>
        </Card>}
        </>
    )
    
}
export { PinocchioTabContent }