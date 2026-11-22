import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Terminal } from '@mui/icons-material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { SdsfConfig, SdsfInstanceConfig } from './SdsfConfig'

const SdsfIcon = <Terminal />

const SdsfSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const instanceConfig: SdsfInstanceConfig = props.setupConfig?.channelInstanceConfig || new SdsfInstanceConfig()
    const config: SdsfConfig = props.setupConfig?.channelConfig || new SdsfConfig()

    const ok = () => {
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: config, channelInstanceConfig: instanceConfig }, true, false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: undefined, channelInstanceConfig: undefined }, false, false)
    }

    return (
        <Dialog open={true}>
            <DialogTitle>SDSF settings</DialogTitle>
            <DialogContent>
            </DialogContent>
            <DialogActions>
                <Button variant='contained' onClick={ok}>OK</Button>
                <Button onClick={cancel}>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SdsfSetup, SdsfIcon }
