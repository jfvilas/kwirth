import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { Place } from '@kwirthmagnify/kwirth-common-front/icons'
import { IV16MapInstanceConfig } from '../common/V16MapTypes'
import { V16MapInstanceConfig } from './V16MapData'

export const V16MapIcon = <Place />

export const V16MapSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const instanceConfig: IV16MapInstanceConfig = props.setupConfig?.channelInstanceConfig || new V16MapInstanceConfig()
    const [v16Only, setV16Only] = useState(instanceConfig.v16Only)
    const defaultRef = useRef<HTMLInputElement | null>(null)

    const ok = () => {
        const chosen: IV16MapInstanceConfig = { v16Only }
        props.onChannelSetupClosed(props.channel, {
            channelId: props.channel.channelId,
            channelConfig: {},
            channelInstanceConfig: chosen
        }, true, defaultRef.current?.checked || false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, {
            channelId: props.channel.channelId,
            channelConfig: undefined,
            channelInstanceConfig: undefined
        }, false, false)
    }

    return (
        <Dialog open={true} maxWidth='sm' fullWidth>
            <DialogTitle>Configure V16 Map channel</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ m: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                        Traffic incidents published by the DGT, fed by the v16 provider. The provider polls the feed on its own
                        schedule (60 s by default); the map only receives what changed.
                    </Typography>
                    <FormControlLabel control={<Checkbox checked={v16Only} onChange={e => setV16Only(e.target.checked)} />}
                        label='Only V16 emergency beacons' />
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }} />} label='Set as default' sx={{ width: '100%', ml: '8px' }} />
                <Button variant='outlined' onClick={ok}>OK</Button>
                <Button variant='outlined' onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}
