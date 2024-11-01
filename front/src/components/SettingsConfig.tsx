import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Settings } from '../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onClose:(newSettings:Settings|undefined) => {}
    settings:Settings
}
    // +++ revisar los settings del modo de stream en metrics
    // +++ revisat los servicemessages, deben inclir el subtipo de mensaje: tipo-> log, metrics, subtipo(log) -> text, info, error  subtipo(metrics) -> metrics, info, error....
const SettingsConfig: React.FC<any> = (props:IProps) => {
    const [value, setValue] = React.useState('log')
    const [logMaxMessages, setLogMaxMessages] = useState(props.settings.logMaxMessages)
    const [logPrevious, setLogPrevious] = useState(props.settings.logPrevious)
    const [logTimestamp, setLogTimestamp] = useState(props.settings.logTimestamp)
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsMetrics, setMetricsMetrics] = useState(props.settings.metricsMetrics.join(','))

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

    const closeOk = () =>{
        var newSettings=new Settings()
        newSettings.logMaxMessages=logMaxMessages
        newSettings.logPrevious=Boolean(logPrevious)
        newSettings.logTimestamp=Boolean(logTimestamp)
        newSettings.metricsMode = MetricsConfigModeEnum[metricsMode as keyof typeof MetricsConfigModeEnum]
        newSettings.metricsMetrics = metricsMetrics.split(',')
        props.onClose(newSettings)
    }

    return (<>
        <Dialog open={true} >
            <DialogTitle>Settings</DialogTitle>
            <DialogContent sx={{height:'30vh'}}>
                <Tabs value={value} onChange={(_: React.SyntheticEvent, newValue: string) => { setValue(newValue)}} sx={{mb:'16px'}}>
                    <Tab key='log' label='Log' value='log' />
                    <Tab key='metrics' label='Metrics' value='metrics' />
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