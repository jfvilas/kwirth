import React, { useState, ChangeEvent } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, IconButton, InputLabel, List, ListItem, ListItemButton, ListItemIcon, ListItemText, MenuItem, Select, SelectChangeEvent, Stack, TextField, Tooltip} from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'
import { MetricDescription } from '../model/MetricDescription'

interface IProps {
    onMetricsSelected:(metrics:string[], mode:MetricsConfigModeEnum, depth: number, width:number, interval:number) => {}
    settings:Settings
    metricsList:Map<string,MetricDescription>
}

const MetricsSelector: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [metricsChecked, setMetricsChecked] = React.useState<string[]>([])

    const onChangeMetricsMode = (event: SelectChangeEvent) => {
        setMetricsMode(event.target.value)
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
        props.onMetricsSelected(metricsChecked, metricsMode as MetricsConfigModeEnum, metricsDepth, metricsWidth, metricsInterval)
    }

    const metricAddOrRemove = (value:string) => {
        const currentIndex = metricsChecked.indexOf(value)
        const newChecked = [...metricsChecked]
        if (currentIndex < 0) 
            newChecked.push(value)
        else
            newChecked.splice(currentIndex, 1)
        setMetricsChecked(newChecked);
    }

    const metricsDelete = (value:string) => {
        const currentIndex = metricsChecked.indexOf(value)
        const newChecked = [...metricsChecked]
        if (currentIndex >= 0) newChecked.splice(currentIndex, 1)
        setMetricsChecked(newChecked);
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

                    <List sx={{ width: '100%', height:'100px', overflowX: 'auto' }}>
                        {Array.from(props.metricsList.keys()).map((value) => {
                            const labelId = `checkbox-list-label-${value}`;
                            return (
                                <ListItem key={value} disablePadding >
                                    <ListItemButton onClick={() => metricAddOrRemove(value)} dense>
                                        <Tooltip title={props.metricsList.get(value)?.help} placement="bottom-start">
                                        <ListItemText id={labelId} primary={value} sx={{color:metricsChecked.includes(value)?'black':'gray'}} />
                                        </Tooltip>
                                    </ListItemButton>
                                </ListItem>
                            )
                        })}
                    </List>
                    <Stack direction="row" spacing={1}>
                        { metricsChecked.map((value) => <Chip label={value} onDelete={() => metricsDelete(value)} size="small"/> ) }
                    </Stack>


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
                <Button onClick={closeOk} disabled={metricsChecked.length===0}>OK</Button>
                <Button onClick={() => props.onMetricsSelected([], MetricsConfigModeEnum.SNAPSHOT, 0, 0, 0)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export default MetricsSelector