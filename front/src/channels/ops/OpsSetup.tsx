import React, { useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Stack, Switch, Typography, Checkbox } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { Terminal } from '@mui/icons-material'
import { IOpsInstanceConfig, IOpsUiConfig } from './OpsConfig'
import { ColorModeEnum } from './terminal/Terminal'

const OpsIcon = <Terminal />

const OpsSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let opsInstanceConfig:IOpsInstanceConfig = props.channelObject?.instanceConfig
    let opsUiConfig:IOpsUiConfig = props.channelObject?.uiConfig
    
    const [sessionKeepAlive, setSessionKeepAlive] = useState(props.instanceSettings? props.instanceSettings.sessionKeepAlive : opsInstanceConfig.sessionKeepAlive)
    const [colorMode, setColorMode] = useState<ColorModeEnum>(props.uiSettings? props.uiSettings.colorMode : ColorModeEnum.Light)
    const defaultRef = useRef<HTMLInputElement|null>(null)

    const ok = () => {
        opsInstanceConfig.sessionKeepAlive = sessionKeepAlive
        opsUiConfig.colorMode = colorMode
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked || false)
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
                    <Typography style={{width:'100%'}}>Color mode</Typography>
                    <Select value={colorMode} onChange={(e) => setColorMode(e.target.value as ColorModeEnum)} variant='standard' sx={{width:'150px', textAlign: 'center'}}>
                        <MenuItem value={ColorModeEnum.Dark}>Dark</MenuItem>
                        <MenuItem value={ColorModeEnum.Light}>Light</MenuItem>
                        <MenuItem value={ColorModeEnum.Terminal3270}>3270</MenuItem>
                    </Select>
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

export { OpsSetup, OpsIcon }
