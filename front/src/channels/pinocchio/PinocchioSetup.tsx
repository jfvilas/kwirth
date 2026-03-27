import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { IPinocchioInstanceConfig, IPinocchioConfig, PinocchioInstanceConfig, PinocchioConfig } from './PinocchioConfig'
import { AutoFixHigh } from '@mui/icons-material'

const PinocchioIcon = <AutoFixHigh />

const PinocchioSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let pinocchioInstanceConfig:IPinocchioInstanceConfig = props.setupConfig?.channelInstanceConfig || new PinocchioInstanceConfig()
    let pinocchioConfig:IPinocchioConfig = props.setupConfig?.channelConfig || new PinocchioConfig()

    const [interval, setInterval] = useState(pinocchioInstanceConfig.interval)
    const [name, setName] = useState(pinocchioInstanceConfig.name)
    const defaultRef = useRef<HTMLInputElement|null>(null)

    const ok = () => {
        pinocchioInstanceConfig.name = name
        pinocchioInstanceConfig.interval = interval
        props.onChannelSetupClosed(props.channel,
        {
            channelId: props.channel.channelId,
            channelConfig: pinocchioConfig,
            channelInstanceConfig: pinocchioInstanceConfig
        }, true, defaultRef.current?.checked || false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, 
        {
            channelId: props.channel.channelId,
            channelConfig: undefined,
            channelInstanceConfig:undefined
        }, false, false)
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '30vw', maxWidth: '40vw', height:'48vh', maxHeight:'48vh' } }}>
            <DialogTitle>Configure Pinocchio channel</DialogTitle>
            <DialogContent >
                <Stack direction={'column'} spacing={2}>
                    <TextField value={name} onChange={(e) => setName(e.target.value)} variant='standard' label='Name' fullWidth/>
                    <TextField value={interval} onChange={(e) => setInterval(+e.target.value)} variant='standard' label='Interval' fullWidth/>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }}/>} label='Set as default' sx={{width:'100%', ml:'8px'}}/>
                <Button onClick={ok}>OK</Button>
                <Button onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { PinocchioSetup, PinocchioIcon }
