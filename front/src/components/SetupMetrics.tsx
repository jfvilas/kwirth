import React, { useState, ChangeEvent } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, List, ListItem, ListItemButton, ListItemText, MenuItem, Select, SelectChangeEvent, Stack, TextField, Tooltip, Typography} from '@mui/material'
import { MetricsConfigModeEnum, ServiceConfigViewEnum } from '@jfvilas/kwirth-common'
import { Settings } from '../model/Settings'
import { MetricDescription } from '../model/MetricDescription'

interface IProps {
    onClose:(metrics:string[], mode:MetricsConfigModeEnum, depth: number, width:number, interval:number, aggregate:boolean, merge:boolean, stack:boolean, chart:string) => {}
    settings:Settings
    channelObject: any
    metricsList:Map<string,MetricDescription>
}

const SetupMetrics: React.FC<any> = (props:IProps) => {
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [metricsChecked, setMetricsChecked] = React.useState<string[]>([])
    const [assetAggregate, setAssetAggregate] = React.useState(false)
    const [assetMerge, setAssetMerge] = React.useState(false)
    const [assetStack, setAssetStack] = React.useState(false)
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
        setAssetAggregate(event.target.checked)
     }

     const onChangeAssetMerge = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAssetMerge(event.target.checked)
     }

     const onChangeAssetStack = (event: React.ChangeEvent<HTMLInputElement>) => {
        setAssetStack(event.target.checked)
     }

     const onChangeChartType = (event: SelectChangeEvent) => {
        setChartType(event.target.value)
    }

    const closeOk = () =>{
        props.onClose(metricsChecked, metricsMode as MetricsConfigModeEnum, metricsDepth, metricsWidth, metricsInterval, assetAggregate, assetMerge, assetStack, chartType)
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

    var multiAssets=false
    switch (props.channelObject.view) {
        case ServiceConfigViewEnum.NAMESPACE:
            multiAssets = props.channelObject.namespace.split(',').length > 1
            break
        case ServiceConfigViewEnum.GROUP:
            multiAssets = props.channelObject.group.split(',').length > 1
            break
        case ServiceConfigViewEnum.POD:
            multiAssets = props.channelObject.pod.split(',').length > 1
            break
        case ServiceConfigViewEnum.CONTAINER:
            multiAssets = props.channelObject.container.split(',').length > 1
            break

    }
    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '60vw', maxWidth: '60vw', height:'40vw', maxHeight:'40vw' } }}>
            <DialogTitle>Configure metrics for {props.channelObject.view}</DialogTitle>
            <DialogContent >
                <Stack spacing={2} sx={{ flexShrink: 0, display: 'flex', flexDirection: 'column', mt:'16px' }}>
                    <Stack direction={'row'} spacing={1} >
                        <FormControl sx={{width:'25%'}}>
                            <InputLabel>Mode</InputLabel>
                            <Select value={metricsMode} onChange={onChangeMetricsMode} variant='standard' disabled>
                                <MenuItem value={MetricsConfigModeEnum.SNAPSHOT}>Snapshot</MenuItem>
                                <MenuItem value={MetricsConfigModeEnum.STREAM}>Stream</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
                            <InputLabel>Depth</InputLabel>
                            <Select value={metricsDepth.toString()} onChange={onChangeMetricsDepth} variant='standard'>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={20}>20</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
                            <InputLabel>Width</InputLabel>
                            <Select value={metricsWidth.toString()} onChange={onChangeMetricsWidth} variant='standard'>
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

                    <Stack direction={'row'} spacing={1} >
                        <Stack direction={'column'} sx={{width:'70%'}}>
                            <TextField value={filter} onChange={(event) => setFilter(event.target.value)} sx={{width:'100%'}} variant='standard' label='Filter'></TextField>
                            <List sx={{ width: '100%', height:'100%', overflowY: 'auto' }}>
                                {Array.from(props.metricsList.keys()).map((value) => {
                                    if (value.includes(filter) && (value.startsWith('container_') || value.startsWith('kwirth_'))) {
                                        //const labelId = `checkbox-list-label-${value}`
                                        return (
                                            <ListItem key={value} disablePadding >
                                                <ListItemButton onClick={() => metricAddOrRemove(value)} dense>
                                                    <Tooltip title={<><Typography fontSize={12}><b>{props.metricsList.get(value)?.type}</b></Typography><Typography fontSize={12}>{props.metricsList.get(value)?.help}</Typography></>} placement="bottom-start" enterDelay={750}>
                                                        <ListItemText primary={value} sx={{color:metricsChecked.includes(value)?'black':'gray'}} />
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
                        </Stack>

                        <Stack direction={'column'} sx={{width:'30%'}} spacing={1}>
                            <FormControlLabel control={<Checkbox checked={assetAggregate} onChange={onChangeMetricsAggregate}/>} disabled={!multiAssets || assetMerge} label='Aggregate' />
                            <FormControlLabel control={<Checkbox checked={assetMerge} onChange={onChangeAssetMerge}/>} disabled={!multiAssets || assetAggregate} label='Merge' />
                            <FormControlLabel control={<Checkbox checked={assetStack} onChange={onChangeAssetStack}/>} disabled={!assetMerge || !('area bar'.includes(chartType))} label='Stack' />
                            <FormControl variant="standard">
                                <InputLabel sx={{ml:1}}>Chart</InputLabel>
                                <Select value={chartType.toString()} onChange={onChangeChartType} sx={{ml:1}} variant='standard'>
                                    <MenuItem value={'line'}>Line</MenuItem>
                                    <MenuItem value={'area'}>Area</MenuItem>
                                    <MenuItem value={'bar'}>Bar</MenuItem>
                                    <MenuItem value={'pie'}>Pie</MenuItem>
                                </Select>
                            </FormControl>

                        </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{width:'100%', flexWrap: 'wrap', maxWidth:'100%', height:'25%', overflowY:'auto'}} >
                        { metricsChecked.map((value,index) => <Chip key={index} label={value} onDelete={() => metricsDelete(value)} size="small"/> ) }
                    </Stack>


                </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk} disabled={metricsChecked.length===0}>OK</Button>
                <Button onClick={() => props.onClose([], MetricsConfigModeEnum.SNAPSHOT, 0, 0, 0, false, false, false, '')}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SetupMetrics }