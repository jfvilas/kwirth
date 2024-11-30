import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, TextField} from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onMetricsSelected:(metrics:string[], mode:MetricsConfigModeEnum, depth: number, width:number, interval:number) => {}
    settings:Settings
}

const MetricsSelector: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsMetrics, setMetricsMetrics] = useState(props.settings.metricsMetrics.join(','))
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)

    const onChangeMetricsMode = (event: SelectChangeEvent) => {
        setMetricsMode(event.target.value)
    }

    const onChangeMetricsMetrics = (event:ChangeEvent<HTMLInputElement>) => {
        setMetricsMetrics(event.target.value)
    }

    const onChangeMetricsDepth = (event: SelectChangeEvent) => {
        setMetricsDepth(+event.target.value)
    }

    const onChangeMetricsWidth = (event: SelectChangeEvent) => {
        setMetricsWidth(+event.target.value)
    }

    const onChangeMetricsInterval = (event:ChangeEvent<HTMLInputElement>) => {
        setMetricsInterval(+event.target.value)
    }

    const closeOk = () =>{
        console.log(metricsWidth)
        props.onMetricsSelected(metricsMetrics.split(','), metricsMode as MetricsConfigModeEnum, metricsDepth, metricsWidth, metricsInterval)
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
                    <FormControl fullWidth variant="standard">
                        <InputLabel id="labeldepth">Depth</InputLabel>
                        <Select value={metricsDepth.toString()} onChange={onChangeMetricsDepth} labelId="labeldepth" variant='standard'>
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={20}>20</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl fullWidth variant="standard">
                        <InputLabel id="labelwidth">Width</InputLabel>
                        <Select value={metricsWidth.toString()} onChange={onChangeMetricsWidth} labelId="labelwidth" variant='standard'>
                        <MenuItem value={1}>1</MenuItem>
                        <MenuItem value={2}>2</MenuItem>
                        <MenuItem value={3}>3</MenuItem>
                        <MenuItem value={4}>4</MenuItem>
                        <MenuItem value={5}>5</MenuItem>
                        <MenuItem value={6}>6</MenuItem>
                        </Select>
                    </FormControl>
                    <TextField value={metricsInterval} onChange={onChangeMetricsInterval} variant='standard'label='Interval' type='number' ></TextField>
                </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onMetricsSelected([], MetricsConfigModeEnum.SNAPSHOT, 0, 0, 0)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export default MetricsSelector