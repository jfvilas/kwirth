import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Radio, RadioGroup, Stack, Typography } from '@mui/material'
import { TrivyObject } from './TrivyObject'
import { IChannelObject } from '../IChannel'

interface IProps {
    onClose:(maxCritical:number, maxHigh:number, maxMedium:number, maxLow:number) => void
    channelObject?: IChannelObject
}

const SetupTrivy: React.FC<IProps> = (props:IProps) => {
    const dataTrivy = props.channelObject?.uiData as TrivyObject
    const [maxCritical, setMaxCritical] = useState(dataTrivy.maxCritical)
    const [maxHigh, setMaxHigh] = useState(dataTrivy.maxHigh)
    const [maxMedium, setMaxMedium] = useState(dataTrivy.maxMedium)
    const [maxLow, setMaxLow] = useState(dataTrivy.maxLow)

    const closeOk = () =>{
        props.onClose(maxCritical, maxHigh, maxMedium, maxLow)
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '30vw', maxWidth: '40vw', height:'48vh', maxHeight:'48vh' } }}>
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
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onClose(-1,-1,-1,-1)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SetupTrivy }