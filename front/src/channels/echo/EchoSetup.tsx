import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { IEchoInstanceConfig, IEchoUiConfig } from './EchoConfig'
import { Science } from '@mui/icons-material'

const EchoIcon = <Science />

const EchoSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let echoUiConfig:IEchoUiConfig = props.channelObject?.uiConfig
    let echoInstanceConfig:IEchoInstanceConfig = props.channelObject?.instanceConfig
    const [interval, setInterval] = useState(echoInstanceConfig.interval)
    const [maxLines, setMaxLines] = useState(echoUiConfig.maxLines)

    const ok = () => {
        echoUiConfig.maxLines = maxLines
        echoInstanceConfig.interval = interval
        props.onChannelSetupClosed(props.channel, true)
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '30vw', maxWidth: '40vw', height:'48vh', maxHeight:'48vh' } }}>
            <DialogTitle>Configure Echo channel</DialogTitle>
            <DialogContent >
                <Stack direction={'column'} spacing={2}>
                    <TextField value={maxLines} onChange={(e) => setMaxLines(+e.target.value)} variant='standard' label='Max lines' fullWidth/>
                    <TextField value={interval} onChange={(e) => setInterval(+e.target.value)} variant='standard' label='Interval' fullWidth/>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { EchoSetup, EchoIcon }
