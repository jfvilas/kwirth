import React, { useState, ChangeEvent } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, List, ListItem, ListItemButton, ListItemText, MenuItem, Select, SelectChangeEvent, Stack, TextField, Tooltip, Typography} from '@mui/material'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'
import { Settings } from '../model/Settings'
import { MetricDescription } from '../model/MetricDescription'

interface IProps {
    onMetricsSelected:(metrics:string[], mode:MetricsConfigModeEnum, depth: number, width:number, interval:number, aggregate:boolean, objectMerge:boolean, chart:string) => {}
    settings:Settings
    channelObject: any
    metricsList:Map<string,MetricDescription>
}

const MetricsSelector: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [metricsChecked, setMetricsChecked] = React.useState<string[]>([])
    const [metricsAggregate, setMetricsAggregate] = React.useState(true)
    const [objectMerge, setObjectMerge] = React.useState(false)
    const [chartType, setChartType] = useState('line')
    const [filter, setFilter] = useState('')

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

    const onChangeMetricsAggregate = (event: React.ChangeEvent<HTMLInputElement>) => {
        setMetricsAggregate(event.target.checked)
     }

     const onChangeObjectMerge = (event: React.ChangeEvent<HTMLInputElement>) => {
        setObjectMerge(event.target.checked)
     }

     const onChangeChartType = (event: SelectChangeEvent) => {
        setChartType(event.target.value)
    }

    const closeOk = () =>{
        props.onMetricsSelected(metricsChecked, metricsMode as MetricsConfigModeEnum, metricsDepth, metricsWidth, metricsInterval, metricsAggregate, objectMerge, chartType)
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

    var mergeable=false
    switch (props.channelObject.view) {
        case 'namespace':
            mergeable = props.channelObject.namespace.split(',').length > 1
            break
        case 'group':
            mergeable = props.channelObject.group.split(',').length > 1
            break
        case 'pod':
            mergeable = props.channelObject.pod.split(',').length > 1
            break
        case 'container':
            mergeable = props.channelObject.container.split(',').length > 1
            break

    }
    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '60vw', maxWidth: '60vw', height:'40vw', maxHeight:'40vw' } }}>
            <DialogTitle>Configure metrics for {props.channelObject.view}</DialogTitle>
            <DialogContent >
                <Stack spacing={2} sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', mt:'16px' }}>
                    <Stack direction={'row'} spacing={1} >
                        <FormControl sx={{width:'25%'}}>
                            <InputLabel id="modelabel">Mode</InputLabel>
                            <Select value={metricsMode} onChange={onChangeMetricsMode} labelId="modelabel" variant='standard' disabled>
                                <MenuItem value={MetricsConfigModeEnum.SNAPSHOT}>Snapshot</MenuItem>
                                <MenuItem value={MetricsConfigModeEnum.STREAM}>Stream</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
                            <InputLabel id="labeldepth">Depth</InputLabel>
                            <Select value={metricsDepth.toString()} onChange={onChangeMetricsDepth} labelId="labeldepth" variant='standard'>
                            <MenuItem value={10}>10</MenuItem>
                            <MenuItem value={20}>20</MenuItem>
                            <MenuItem value={50}>50</MenuItem>
                            <MenuItem value={100}>100</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
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
                        <TextField value={metricsInterval} onChange={onChangeMetricsInterval} sx={{width:'25%'}} variant='standard' label='Interval' type='number'></TextField>
                    </Stack>

                    <Stack direction={'row'} spacing={1}>
                        <TextField value={filter} onChange={(event) => setFilter(event.target.value)} sx={{width:'100%'}} variant='standard' label='Filter'></TextField>
                        <Stack direction={'column'} spacing={1}>
                            <FormControlLabel control={<Checkbox checked={metricsAggregate} onChange={onChangeMetricsAggregate}/>} label='Aggregate' />
                            <FormControlLabel control={<Checkbox checked={objectMerge} onChange={onChangeObjectMerge}/>} disabled={!mergeable} label='Merge' />
                            <FormControl variant="standard">
                                <InputLabel id="charttype">Chart</InputLabel>
                                <Select value={chartType.toString()} onChange={onChangeChartType} labelId="chattype" variant='standard'>
                                    <MenuItem value={'line'}>Line</MenuItem>
                                    <MenuItem value={'area'}>Area</MenuItem>
                                    <MenuItem value={'bar'}>Bar</MenuItem>
                                    <MenuItem value={'pie'}>Pie</MenuItem>
                                </Select>
                            </FormControl>

                        </Stack>
                    </Stack>

                    <List sx={{ width: '100%', height:'40%', overflowY: 'auto' }}>
                        {Array.from(props.metricsList.keys()).map((value) => {
                            if (value.includes(filter) && (value.startsWith('container_') || value.startsWith('kwirth_'))) {
                                const labelId = `checkbox-list-label-${value}`
                                return (
                                    <ListItem key={value} disablePadding >
                                        <ListItemButton onClick={() => metricAddOrRemove(value)} dense>
                                            <Tooltip title={<><Typography fontSize={12}><b>{props.metricsList.get(value)?.type}</b></Typography><Typography fontSize={12}>{props.metricsList.get(value)?.help}</Typography></>} placement="bottom-start" enterDelay={750}>
                                            <ListItemText id={labelId} primary={value} sx={{color:metricsChecked.includes(value)?'black':'gray'}} />
                                            </Tooltip>
                                        </ListItemButton>
                                    </ListItem>
                                )
                            }
                            else {
                                return <></>
                            }
                        })}
                    </List>
                    <Stack direction="row" spacing={1} sx={{width:'100%', flexWrap: 'wrap', maxWidth:'100%', height:'25%', overflowY:'auto'}} >
                        { metricsChecked.map((value,index) => <Chip key={index} label={value} onDelete={() => metricsDelete(value)} size="small"/> ) }
                    </Stack>

                </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk} disabled={metricsChecked.length===0}>OK</Button>
                <Button onClick={() => props.onMetricsSelected([], MetricsConfigModeEnum.SNAPSHOT, 0, 0, 0, false, false,'')}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { MetricsSelector }