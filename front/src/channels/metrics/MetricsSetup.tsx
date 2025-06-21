import React, { useState } from 'react'
import { Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, List, ListItem, ListItemButton, ListItemText, MenuItem, Select, Stack, TextField, Tooltip, Typography} from '@mui/material'
import { MetricsConfigModeEnum, InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { ISetupProps } from '../IChannel'
import { BarChart } from '@mui/icons-material'
import { MetricsInstanceConfig, MetricsUiConfig } from './MetricsConfig'

const MetricsIcon = <BarChart/>

const MetricsSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let metricsUiConfig:MetricsUiConfig = props.channelObject.uiConfig
    let metricsInstanceConfig:MetricsInstanceConfig = props.channelObject.instanceConfig
    let metricsList = props.channelObject.metricsList

    const [metrics, setMetrics] = React.useState<string[]>(metricsInstanceConfig.metrics)
    const [metricsMode, setMetricsMode] = useState(metricsInstanceConfig.mode)
    const [metricsDepth, setMetricsDepth] = useState(metricsUiConfig.depth)
    const [metricsWidth, setMetricsWidth] = useState(metricsUiConfig.width)
    const [metricsInterval, setMetricsInterval] = useState(metricsInstanceConfig.interval)
    const [assetAggregate, setAssetAggregate] = React.useState(metricsInstanceConfig.aggregate)
    const [assetMerge, setAssetMerge] = React.useState(metricsUiConfig.merge)
    const [assetStack, setAssetStack] = React.useState(metricsUiConfig.stack)
    const [chart, setChart] = useState(metricsUiConfig.chart)
    const [filter, setFilter] = useState('')

    console.log(props.channelObject)

    const ok = () =>{
        metricsInstanceConfig.mode = metricsMode
        metricsInstanceConfig.interval = metricsInterval
        metricsInstanceConfig.aggregate = assetAggregate
        metricsInstanceConfig.metrics = metrics
        metricsUiConfig.depth = metricsDepth
        metricsUiConfig.width = metricsWidth
        metricsUiConfig.merge = assetMerge
        metricsUiConfig.stack = assetStack
        metricsUiConfig.chart = chart
        props.onChannelSetupClosed(props.channel, true)
    }

    const metricAddOrRemove = (value:string) => {
        const currentIndex = metrics.indexOf(value)
        const newChecked = [...metrics]
        if (currentIndex < 0) 
            newChecked.push(value)
        else
            newChecked.splice(currentIndex, 1)
        setMetrics(newChecked);
    }

    const metricsDelete = (value:string) => {
        const currentIndex = metrics.indexOf(value)
        const newChecked = [...metrics]
        if (currentIndex >= 0) newChecked.splice(currentIndex, 1)
        setMetrics(newChecked);
    }

    var multiAssets=false
    if (props.channelObject) {
        switch (props.channelObject.view) {
            case InstanceConfigViewEnum.NAMESPACE:
                multiAssets = props.channelObject.namespace.split(',').length > 1
                break
            case InstanceConfigViewEnum.GROUP:
                multiAssets = props.channelObject.group.split(',').length > 1
                break
            case InstanceConfigViewEnum.POD:
                multiAssets = props.channelObject.pod.split(',').length > 1
                break
            case InstanceConfigViewEnum.CONTAINER:
                multiAssets = props.channelObject.container.split(',').length > 1
                break

        }
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '50vw', maxWidth: '60vw', height:'60vh', maxHeight:'40vw' } }}>
            <DialogTitle>Configure metrics for {props.channelObject?.view}</DialogTitle>
            <DialogContent >
                <Stack spacing={2} direction={'column'} sx={{ mt:'16px' }}>
                    <Stack direction={'row'} spacing={1} >
                        <FormControl sx={{width:'25%'}}>
                            <InputLabel>Mode</InputLabel>
                            <Select value={metricsMode} onChange={(e) => setMetricsMode(e.target.value as MetricsConfigModeEnum)} variant='standard' disabled>
                                <MenuItem value={MetricsConfigModeEnum.SNAPSHOT}>Snapshot</MenuItem>
                                <MenuItem value={MetricsConfigModeEnum.STREAM}>Stream</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
                            <InputLabel>Depth</InputLabel>
                            <Select value={metricsDepth} onChange={(e) => setMetricsDepth(+e.target.value)} variant='standard'>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={20}>20</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl variant="standard" sx={{width:'25%'}}>
                            <InputLabel>Width</InputLabel>
                            <Select value={metricsWidth} onChange={(e)=> setMetricsWidth(+e.target.value)} variant='standard'>
                                <MenuItem value={1}>1</MenuItem>
                                <MenuItem value={2}>2</MenuItem>
                                <MenuItem value={3}>3</MenuItem>
                                <MenuItem value={4}>4</MenuItem>
                                <MenuItem value={5}>5</MenuItem>
                                <MenuItem value={6}>6</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField value={metricsInterval} onChange={(e) => setMetricsInterval(+e.target.value)} sx={{width:'25%'}} variant='standard' label='Interval' type='number'></TextField>
                    </Stack>

                    <TextField value={filter} onChange={(event) => setFilter(event.target.value)} sx={{width:'100%'}} variant='standard' label='Filter' autoFocus></TextField>

                    <Stack direction={'row'} spacing={1} sx={{width:'100%', height:'22vh'}}>
                        <Stack direction={'column'} sx={{width:'70%'}}>
                            <List sx={{ width: '100%', overflowY: 'auto' }}>
                                { metricsList && Array.from(metricsList.keys()).map((value, index) => {
                                    if (value.includes(filter) && (value.startsWith('container_') || value.startsWith('kwirth_'))) {
                                        return (
                                            <ListItem key={index} disablePadding>
                                                <ListItemButton onClick={() => metricAddOrRemove(value)} dense>
                                                    <Tooltip title={<><Typography fontSize={12}><b>{metricsList && metricsList.get(value)?.type}</b></Typography><Typography fontSize={12}>{metricsList && metricsList.get(value)?.help}</Typography></>} placement="bottom-start" enterDelay={750}>
                                                        <ListItemText primary={value} sx={{color:metrics.includes(value)?'black':'gray'}} />
                                                    </Tooltip>
                                                </ListItemButton>
                                            </ListItem>
                                        )
                                    }
                                    else {
                                        return <React.Fragment key={index} />
                                        
                                    }
                                })}
                            </List>
                        </Stack>

                        <Stack direction={'column'} sx={{width:'30%'}} spacing={1}>
                            <FormControlLabel control={<Checkbox checked={assetAggregate} onChange={(e) => setAssetAggregate(e.target.checked)}/>} disabled={!multiAssets || assetMerge} label='Aggregate' />
                            <FormControlLabel control={<Checkbox checked={assetMerge} onChange={(e) => setAssetMerge(e.target.checked)}/>} disabled={!multiAssets || assetAggregate} label='Merge' />
                            <FormControlLabel control={<Checkbox checked={assetStack} onChange={(e) => setAssetStack(e.target.checked)}/>} disabled={!assetMerge || !('area bar'.includes(chart))} label='Stack' />
                            <FormControl variant="standard">
                                <InputLabel sx={{ml:1}}>Chart</InputLabel>
                                <Select value={chart} onChange={(e) => setChart(e.target.value)} sx={{ml:1}} variant='standard'>
                                    <MenuItem value={'value'}>Value</MenuItem>
                                    <MenuItem value={'line'}>Line</MenuItem>
                                    <MenuItem value={'area'}>Area</MenuItem>
                                    <MenuItem value={'bar'}>Bar</MenuItem>
                                    <MenuItem value={'pie'}>Pie</MenuItem>
                                </Select>
                            </FormControl>

                        </Stack>
                    </Stack>

                    <Stack direction="row" spacing={1} sx={{width:'100%', flexWrap: 'wrap', maxWidth:'100%', height:'25%', overflowY:'auto'}} >
                        { metrics.map((value,index) => <Chip key={index} label={value} onDelete={() => metricsDelete(value)} size="small"/> ) }
                    </Stack>

                </Stack>

            </DialogContent>
            <DialogActions>
                <Button onClick={ok} disabled={metrics.length===0}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { MetricsSetup, MetricsIcon }