import React, { useState, ChangeEvent } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { Settings } from '../../model/Settings'
import { MetricsConfigModeEnum } from '@jfvilas/kwirth-common'

interface IProps {
    onClose:(newSettings:Settings|undefined) => {}
    settings:Settings
}

const SettingsUser: React.FC<any> = (props:IProps) => {
    const [value, setValue] = React.useState('log')
    const [logMaxMessages, setLogMaxMessages] = useState(props.settings.logMaxMessages)
    const [logPrevious, setLogPrevious] = useState(props.settings.logPrevious)
    const [logTimestamp, setLogTimestamp] = useState(props.settings.logTimestamp)
    const [logFollow, setLogFollow] = useState(props.settings.logFollow)
    const [alertMaxAlerts, setAlertMaxAlerts] = useState(props.settings.alertMaxAlerts)
    const [metricsMode, setMetricsMode] = useState(props.settings.metricsMode.toString())
    const [metricsDepth, setMetricsDepth] = useState(props.settings.metricsDepth)
    const [metricsWidth, setMetricsWidth] = useState(props.settings.metricsWidth)
    const [metricsInterval, setMetricsInterval] = useState(props.settings.metricsInterval)
    const [metricsAggregate, setMetricsAggregate] = useState(props.settings.metricsAggregate)
    const [keepAliveInterval, setKeepAliveInterval] = useState(props.settings.keepAliveInterval)

    const closeOk = () =>{
        var newSettings=new Settings()
        newSettings.logMaxMessages=logMaxMessages
        newSettings.logPrevious=Boolean(logPrevious)
        newSettings.logTimestamp=Boolean(logTimestamp)
        newSettings.metricsMode = metricsMode as MetricsConfigModeEnum
        newSettings.metricsWidth = metricsWidth
        newSettings.metricsDepth = metricsDepth
        newSettings.metricsInterval = metricsInterval
        newSettings.metricsAggregate = metricsAggregate
        newSettings.keepAliveInterval = keepAliveInterval
        props.onClose(newSettings)
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent sx={{height:'40vh'}}>
                <Typography>
                    This settings do establishes the defult settings to use when you start a new instance.
                </Typography>
                <Tabs value={value} onChange={(_: React.SyntheticEvent, newValue: string) => { setValue(newValue)}} sx={{mb:'16px'}}>
                    <Tab key='log' label='Log' value='log' />
                    <Tab key='alert' label='Alert' value='alert' />
                    <Tab key='metrics' label='Metrics' value='metrics' />
                    <Tab key='kwirth' label='Kwirth' value='kwirth' />
                </Tabs>

                <div hidden={value!=='log'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={logMaxMessages} onChange={(e) => setLogMaxMessages(+e.target.value)} variant='standard'label='Max messages' SelectProps={{native: true}} type='number'></TextField>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={logPrevious} onChange={(e) => setLogPrevious(e.target.checked)}/><Typography>Get messages of previous container</Typography>
                        </Stack>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={logTimestamp} onChange={(e) => setLogTimestamp(e.target.checked)}/><Typography>Add timestamp to messages</Typography>
                        </Stack>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={logFollow} onChange={(e) => setLogFollow(e.target.checked)}/><Typography>Follow new messages</Typography>
                        </Stack>
                    </Stack>
                </div>
                
                <div hidden={value!=='alert'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={alertMaxAlerts} onChange={(e) => setAlertMaxAlerts(+e.target.value)} variant='standard'label='Max alerts' SelectProps={{native: true}} type='number'></TextField>
                    </Stack>
                </div>

                <div hidden={value!=='metrics'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <FormControl fullWidth variant='standard'>
                            <InputLabel>Mode</InputLabel>
                            <Select value={metricsMode} onChange={(e) => setMetricsMode(e.target.value)}>
                                <MenuItem value={'snapshot'}>Snapshot</MenuItem>
                                <MenuItem value={'stream'}>Stream</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControlLabel control={<Checkbox checked={metricsAggregate} onChange={(e) => setMetricsAggregate(e.target.checked)}/>} label='Aggregate resource metrics' />
                        {/* <TextField value={metricsMetrics} onChange={onChangeMetricsMetrics} variant='standard'label='Metrics' SelectProps={{native: true}}></TextField> */}
                        <Stack spacing={1} direction={'row'}>
                            <FormControl variant='standard' sx={{width:'33%'}}>
                                <InputLabel>Depth</InputLabel>
                                <Select value={metricsDepth.toString()} onChange={(e) => setMetricsDepth(+e.target.value)} variant='standard'>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={20}>20</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                                </Select>
                            </FormControl>
                            <FormControl variant='standard' sx={{width:'33%'}}>
                                <InputLabel>Width</InputLabel>
                                <Select value={metricsWidth.toString()} onChange={(e) => setMetricsWidth(+e.target.value)} variant='standard'>
                                <MenuItem value={1}>1</MenuItem>
                                <MenuItem value={2}>2</MenuItem>
                                <MenuItem value={3}>3</MenuItem>
                                <MenuItem value={4}>4</MenuItem>
                                <MenuItem value={5}>5</MenuItem>
                                <MenuItem value={6}>6</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField value={metricsInterval} onChange={(e) => setMetricsInterval(+e.target.value)} sx={{width:'33%'}} variant='standard' label='Interval' type='number' ></TextField>
                        </Stack>
                    </Stack>
                </div>

                <div hidden={value!=='kwirth'}>
                    <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={keepAliveInterval} onChange={(e) => setKeepAliveInterval(+e.target.value)} variant='standard' label='Keep-alive interval (seconds)' SelectProps={{native: true}} type='number'></TextField>
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

export { SettingsUser }