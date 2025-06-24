import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { VerifiedUser } from '@mui/icons-material'

const TrivyIcon = <VerifiedUser />

const TrivySetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let trivyInstanceConfig:ITrivyInstanceConfig = props.channelObject.instanceConfig
    
    const [maxCritical, setMaxCritical] = useState(props.instanceSettings? props.instanceSettings.maxCritical : trivyInstanceConfig.maxCritical)
    const [maxHigh, setMaxHigh] = useState(props.instanceSettings? props.instanceSettings.maxHigh : trivyInstanceConfig.maxHigh)
    const [maxMedium, setMaxMedium] = useState(props.instanceSettings? props.instanceSettings.maxMedium : trivyInstanceConfig.maxMedium)
    const [maxLow, setMaxLow] = useState(props.instanceSettings? props.instanceSettings.maxLow : trivyInstanceConfig.maxLow)
    const defaultRef = useRef<any>(null)

    const ok = () =>{
        trivyInstanceConfig.maxCritical = maxCritical
        trivyInstanceConfig.maxHigh = maxHigh
        trivyInstanceConfig.maxMedium = maxMedium
        trivyInstanceConfig.maxLow = maxLow
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked)
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '28vw', maxWidth: '40vw', height:'50vh', maxHeight:'55vh' } }}>
            <DialogTitle>Configure Trivy channel</DialogTitle>
            <DialogContent >
                <Stack spacing={2} direction={'column'} sx={{ mt:'16px' }}>
                    <Typography>Set maximum number of accepted issues on each category:</Typography>
                    <Stack direction={'row'} spacing={4}>
                        <RadioGroup defaultValue={'none'} value={maxCritical} onChange={(event) => setMaxCritical(+event.target.value)}>
                        <Stack spacing={-1}>
                            <Typography fontWeight={800}>Critical</Typography>
                            <Typography><Radio value='0'/>0</Typography>
                            <Typography><Radio value='1'/>1</Typography>
                            <Typography><Radio value='2'/>2</Typography>
                            <Typography><Radio value='3'/>3</Typography>
                            <Typography><Radio value='4'/>4</Typography>
                            <Typography><Radio value='5'/>5</Typography>
                            <Typography><Radio value='-1'/>Ignore</Typography>
                        </Stack>
                        </RadioGroup>
                        <RadioGroup defaultValue={'none'} value={maxHigh} onChange={(event) => setMaxHigh(+event.target.value)}>
                        <Stack spacing={-1}>
                            <Typography fontWeight={800}>High</Typography>
                            <Typography><Radio value='0'/>0</Typography>
                            <Typography><Radio value='1'/>1</Typography>
                            <Typography><Radio value='2'/>2</Typography>
                            <Typography><Radio value='3'/>3</Typography>
                            <Typography><Radio value='4'/>4</Typography>
                            <Typography><Radio value='5'/>5</Typography>
                            <Typography><Radio value='-1'/>Ignore</Typography>
                        </Stack>
                        </RadioGroup>
                        <RadioGroup defaultValue={'none'} value={maxMedium} onChange={(event) => setMaxMedium(+event.target.value)}>
                        <Stack spacing={-1}>
                            <Typography fontWeight={800}>Medium</Typography>
                            <Typography><Radio value='0'/>0</Typography>
                            <Typography><Radio value='1'/>1</Typography>
                            <Typography><Radio value='2'/>2</Typography>
                            <Typography><Radio value='3'/>3</Typography>
                            <Typography><Radio value='4'/>4</Typography>
                            <Typography><Radio value='5'/>5</Typography>
                            <Typography><Radio value='-1'/>Ignore</Typography>
                        </Stack>
                        </RadioGroup>
                        <RadioGroup defaultValue={'none'} value={maxLow} onChange={(event) => setMaxLow(+event.target.value)}>
                        <Stack spacing={-1}>
                            <Typography fontWeight={800}>Low</Typography>
                            <Typography><Radio value='0'/>0</Typography>
                            <Typography><Radio value='1'/>1</Typography>
                            <Typography><Radio value='2'/>2</Typography>
                            <Typography><Radio value='3'/>3</Typography>
                            <Typography><Radio value='4'/>4</Typography>
                            <Typography><Radio value='5'/>5</Typography>
                            <Typography><Radio value='-1'/>Ignore</Typography>
                        </Stack>
                        </RadioGroup>
                    </Stack>
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

export { TrivySetup, TrivyIcon }