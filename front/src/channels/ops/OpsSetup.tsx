import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, Typography } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { Terminal } from '@mui/icons-material'
import { IOpsInstanceConfig } from './OpsConfig'

const OpsIcon = <Terminal />

const OpsSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let opsInstanceConfig:IOpsInstanceConfig = props.channelObject?.instanceConfig
    
    const [sessionKeepAlive, setSessionKeepAlive] = useState(opsInstanceConfig.sessionKeepAlive)

    const ok = () => {
        opsInstanceConfig.sessionKeepAlive = sessionKeepAlive
        props.onChannelSetupClosed(props.channel, true)
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Configure Ops</DialogTitle>
            <DialogContent>
                <Stack direction={'row'} alignItems={'center'}>
                    <Typography>KeepAlive shell session on backend</Typography>
                    <Switch checked={sessionKeepAlive} onChange={(e) => setSessionKeepAlive(e.target.checked)}/>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { OpsSetup, OpsIcon }