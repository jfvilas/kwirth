import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { IEchoInstanceConfig, IEchoConfig } from './EchoConfig'
import { Science } from '@mui/icons-material'

const EchoIcon = <Science />

const EchoSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let echoConfig:IEchoConfig = props.channelObject?.config
    let echoInstanceConfig:IEchoInstanceConfig = props.channelObject?.instanceConfig

    const [interval, setInterval] = useState(props.instanceSettings? props.instanceSettings.interval : echoInstanceConfig.interval)
    const [maxLines, setMaxLines] = useState(props.uiSettings? props.uiSettings.maxLines : echoConfig.maxLines)
    const defaultRef = useRef<HTMLInputElement|null>(null)

    const ok = () => {
        echoConfig.maxLines = maxLines
        echoInstanceConfig.interval = interval
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked || false)
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
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }}/>} label='Set as default' sx={{width:'100%', ml:'8px'}}/>
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { EchoSetup, EchoIcon }
