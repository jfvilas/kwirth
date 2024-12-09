import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onClose:(newSettings:Settings|undefined) => {}
    settings:Settings
}
const SettingsConfig: React.FC<any> = (props:IProps) => {
    const [value, setValue] = React.useState('log')
    const [logMaxMessages, setLogMaxMessages] = useState(props.settings.logMaxMessages)
    const [logPrevious, setLogPrevious] = useState(props.settings.logPrevious)
    const [logTimestamp, setLogTimestamp] = useState(props.settings.logTimestamp)
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsMetrics, setMetricsMetrics] = useState(props.settings.metricsMetrics.join(','))
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [clusterMetricsInterval, setClusterMetricsInterval] = useState(props.settings.clusterMetricsInterval)

    const onChangeLogMaxMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setLogMaxMessages(+event.target.value)
    }

    const onChangeLogPrevious = (event:ChangeEvent<HTMLInputElement>) => {
        setLogPrevious(event.target.checked)
    }

    const onChangeLogTimestamp = (event:ChangeEvent<HTMLInputElement>) => {
        setLogTimestamp(event.target.checked)
    }

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

    const onChangeClusterMetricsInterval = (event:ChangeEvent<HTMLInputElement>) => {
        setClusterMetricsInterval(+event.target.value)
    }

    const closeOk = () =>{
        var newSettings=new Settings()
        newSettings.logMaxMessages=logMaxMessages
        newSettings.logPrevious=Boolean(logPrevious)
        newSettings.logTimestamp=Boolean(logTimestamp)
        newSettings.metricsMode = metricsMode as MetricsConfigModeEnum
        newSettings.metricsMetrics = metricsMetrics.split(',')
        newSettings.metricsWidth = metricsWidth
        newSettings.metricsDepth = metricsDepth
        newSettings.metricsInterval = metricsInterval
        newSettings.clusterMetricsInterval = clusterMetricsInterval
        props.onClose(newSettings)
    }

    return (<>
        <Dialog open={true} >
            <DialogTitle>Settings</DialogTitle>
            <DialogContent sx={{height:'30vh'}}>
                <Tabs value={value} onChange={(_: React.SyntheticEvent, newValue: string) => { setValue(newValue)}} sx={{mb:'16px'}}>
                    <Tab key='log' label='Log' value='log' />
                    <Tab key='metrics' label='Metrics' value='metrics' />
                    <Tab key='kwirth' label='Kwirth' value='kwirth' />
                </Tabs>

                <div hidden={value!=='log'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={logMaxMessages} onChange={onChangeLogMaxMessages} variant='standard'label='Max messages' SelectProps={{native: true}} type='number'></TextField>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={logPrevious} onChange={onChangeLogPrevious}/><Typography>Get messages of previous deployment</Typography>
                        </Stack>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={logTimestamp} onChange={onChangeLogTimestamp}/><Typography>Add timestamp to messages</Typography>
                        </Stack>
                    </Stack>
                </div>
                
                <div hidden={value!=='metrics'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <FormControl fullWidth variant='standard'>
                            <InputLabel id='modelabel'>Mode</InputLabel>
                            <Select value={metricsMode} onChange={onChangeMetricsMode} labelId='modelabel'>
                                <MenuItem value={'snapshot'}>Snapshot</MenuItem>
                                <MenuItem value={'stream'}>Stream</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField value={metricsMetrics} onChange={onChangeMetricsMetrics} variant='standard'label='Metrics' SelectProps={{native: true}}></TextField>
                        <Stack spacing={1} direction={'row'}>
                            <FormControl variant='standard' sx={{width:'33%'}}>
                                <InputLabel id="labeldepth">Depth</InputLabel>
                                <Select value={metricsDepth.toString()} onChange={onChangeMetricsDepth} labelId="labeldepth" variant='standard'>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={20}>20</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl variant='standard' sx={{width:'33%'}}>
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

                            <TextField value={metricsInterval} onChange={onChangeMetricsInterval} sx={{width:'33%'}} variant='standard' label='Interval' type='number' ></TextField>
                        </Stack>
                    </Stack>
                </div>

                <div hidden={value!=='kwirth'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={clusterMetricsInterval} onChange={onChangeClusterMetricsInterval} variant='standard' label='Cluster metrics interval' SelectProps={{native: true}} type='number'></TextField>
                    </Stack>
                </div>
                

            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onClose(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export default SettingsConfig