import React, { useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Stack, Switch, Typography, Checkbox } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { Terminal } from '@mui/icons-material'
import { IOpsInstanceConfig, IOpsConfig, OpsInstanceConfig, OpsConfig, AccessKeyEnum } from './OpsConfig'

const OpsIcon = <Terminal />

const OpsSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let opsInstanceConfig:IOpsInstanceConfig = props.setupConfig?.channelInstanceConfig || new OpsInstanceConfig()
    let opsConfig:IOpsConfig = props.setupConfig?.channelConfig || new OpsConfig()
    
    const [sessionKeepAlive, setSessionKeepAlive] = useState(opsInstanceConfig.sessionKeepAlive)
    const [accessKey, setAccessKey] = useState(opsConfig.accessKey || AccessKeyEnum.DISABLED)
    const defaultRef = useRef<HTMLInputElement|null>(null)

    const ok = () => {
        opsInstanceConfig.sessionKeepAlive = sessionKeepAlive
        opsConfig.accessKey = accessKey
        props.onChannelSetupClosed(props.channel,
        {
            channelId: props.channel.channelId,
            channelConfig: opsConfig,
            channelInstanceConfig: opsInstanceConfig
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
        <Dialog open={true}>
            <DialogTitle>Configure Ops</DialogTitle>
            <DialogContent>
                <Stack direction={'row'} alignItems={'center'}>
                    <Typography>KeepAlive shell session on backend</Typography>
                    <Switch checked={sessionKeepAlive} onChange={(e) => setSessionKeepAlive(e.target.checked)}/>
                </Stack>
                <Stack direction={'row'} alignItems={'center'}>
                    <Typography style={{width:'100%'}}>Function access key</Typography>
                    <Select value={accessKey} onChange={(e) => setAccessKey(e.target.value as AccessKeyEnum)} variant='standard' sx={{width:'150px', textAlign: 'center'}}>
                        <MenuItem value={AccessKeyEnum.DISABLED}>Disabled</MenuItem>
                        <MenuItem value={AccessKeyEnum.NONE}>None</MenuItem>
                        <MenuItem value={AccessKeyEnum.ALT}>Alt</MenuItem>
                        <MenuItem value={AccessKeyEnum.CTRL}>Control</MenuItem>
                        <MenuItem value={AccessKeyEnum.SHIFT}>Shift</MenuItem>
                    </Select>
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

export { OpsSetup, OpsIcon }
