import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField} from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onMetricsSelected:(metrics:string[], mode:MetricsConfigModeEnum, interval:number) => {}
    settings:Settings
}

const MetricsSelector: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [metricsMetrics, setMetricsMetrics] = useState(props.settings.metricsMetrics.join(','))

    const onChangeMetricsMode = (event: SelectChangeEvent) => {
        setMetricsMode(event.target.value)
    }

    const onChangeMetricsMetrics = (event:ChangeEvent<HTMLInputElement>) => {
        setMetricsMetrics(event.target.value)
    }

    const onChangeMetricsInterval = (event:ChangeEvent<HTMLInputElement>) => {
        setMetricsInterval(+event.target.value)
    }

    const closeOk = () =>{
        props.onMetricsSelected(metricsMetrics.split(','), metricsMode as MetricsConfigModeEnum, metricsInterval)
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Configure metrics</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh', mt:'16px' }}>
                    <FormControl fullWidth>
                        <InputLabel id="modelabel">Mode</InputLabel>
                        <Select value={metricsMode} onChange={onChangeMetricsMode} labelId="modelabel" variant='standard'>
                            <MenuItem value={MetricsConfigModeEnum.SNAPSHOT}>Snapshot</MenuItem>
                            <MenuItem value={MetricsConfigModeEnum.STREAM}>Stream</MenuItem>
                        </Select>
                        </FormControl>
                    <TextField value={metricsMetrics} onChange={onChangeMetricsMetrics} variant='standard' label='Metrics' SelectProps={{native: true}}></TextField>
                    <TextField value={metricsInterval} onChange={onChangeMetricsInterval} variant='standard'label='Interval' type='number' ></TextField>
                    </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onMetricsSelected([], MetricsConfigModeEnum.SNAPSHOT, 0)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export default MetricsSelector