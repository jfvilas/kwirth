import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material'
import { Terminal } from '@mui/icons-material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { WrkactjobConfig, WrkactjobInstanceConfig } from './WrkactjobConfig'

const WrkactjobIcon = <Terminal />

const WrkactjobSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const instanceConfig: WrkactjobInstanceConfig = props.setupConfig?.channelInstanceConfig || new WrkactjobInstanceConfig()
    const config: WrkactjobConfig = props.setupConfig?.channelConfig || new WrkactjobConfig()

    const ok = () => {
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: config, channelInstanceConfig: instanceConfig }, true, false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: undefined, channelInstanceConfig: undefined }, false, false)
    }

    return (
        <Dialog open={true}>
            <DialogTitle>WRKACTJOB settings</DialogTitle>
            <DialogContent>
            </DialogContent>
            <DialogActions>
                <Button variant='contained' onClick={ok}>OK</Button>
                <Button onClick={cancel}>Cancel</Button>
            </DialogActions>
        </Dialog>
    )
}

export { WrkactjobSetup, WrkactjobIcon }
