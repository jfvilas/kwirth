import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField} from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onMetricsSelected:(metrics?:string[], mode?:MetricsConfigModeEnum) => {}
    settings:Settings
}

const MetricsSelector: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsMetrics, setMetricsMetrics] = useState(props.settings.metricsMetrics.join(','))

    const onChangeMetricsMode = (event: SelectChangeEvent) => {
        setMetricsMode(event.target.value)
    }

    const onChangeMetricsMetrics = (event:ChangeEvent<HTMLInputElement>) => {
        setMetricsMetrics(event.target.value)
    }

    const closeOk = () =>{
        props.onMetricsSelected(metricsMetrics.split(','), MetricsConfigModeEnum[metricsMode as keyof typeof MetricsConfigModeEnum])
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                    <FormControl fullWidth>
                        <InputLabel id="modelabel">Age</InputLabel>
                        <Select value={metricsMode} onChange={onChangeMetricsMode} labelId="modelabel" label="Mode">
                            <MenuItem value={'SNAPSHOT'}>Snapshot</MenuItem>
                            <MenuItem value={'STREAM'}>Stream</MenuItem>
                        </Select>
                        </FormControl>
                    <TextField value={metricsMetrics} onChange={onChangeMetricsMetrics} variant='standard' label='Metrics' SelectProps={{native: true}}></TextField>
                </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onMetricsSelected(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export default MetricsSelector