import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { Settings } from '../../model/Settings'

interface IProps {
    onClose:(ok:boolean) => void
    settings:Settings | null
}

const SettingsUser: React.FC<IProps> = (props:IProps) => {
    const [keepAliveInterval, setKeepAliveInterval] = useState<number>(props.settings? props.settings.keepAliveInterval : 60)

    const ok = () =>{
        if (props.settings) {
            props.settings.keepAliveInterval = keepAliveInterval
            props.onClose(true)
        }
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent sx={{height:'20vh'}}>
                <Typography>
                    Default settings to use when you work with Kwirth.
                </Typography>
                <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', mt:2 }}>
                    <TextField value={keepAliveInterval} onChange={(e) => setKeepAliveInterval(+e.target.value)} variant='standard' label='Keep-alive interval (seconds)' slotProps = { { select: {native: true}}} type='number'></TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onClose(false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SettingsUser }