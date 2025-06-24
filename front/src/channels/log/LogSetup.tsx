import React, { useState, ChangeEvent, useRef } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormLabel, Radio, RadioGroup, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { Subject } from '@mui/icons-material'
import { ILogInstanceConfig, ILogUiConfig, LogSortOrderEnum } from './LogConfig'
import { DateTimePicker, LocalizationProvider, renderTimeViewClock } from '@mui/x-date-pickers'
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment'
import moment from 'moment'

const LogIcon = <Subject />

const LogSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let logUiConfig:ILogUiConfig = props.channelObject?.uiConfig
    let logInstanceConfig:ILogInstanceConfig = props.channelObject?.instanceConfig

    const [selectedTab, setSelectedTab] = useState(props.uiSettings? (props.uiSettings.startDiagnostics? 'sd':'log') : 'log')
    const [maxMessages, setMaxMessages] = useState(props.uiSettings? props.uiSettings.maxMessages : logUiConfig.maxMessages)
    const [maxPerPodMessages, setMaxPerPodMessages] = useState(props.uiSettings? props.uiSettings.maxPerPodMessages : logUiConfig.maxPerPodMessages)
    const [follow, setFollow] = useState(props.uiSettings? props.uiSettings.follow : logUiConfig.follow)
    const [sortOrder, setSortOrder] = useState(props.uiSettings? props.uiSettings.sortOrder : logUiConfig.sortOrder)
    const [previous, setPrevious] = useState(props.instanceSettings? props.instanceSettings.previous : logInstanceConfig.previous)
    const [timestamp, setTimestamp] = useState(props.instanceSettings? props.instanceSettings.timestamp : logInstanceConfig.timestamp)
    const [fromStart, setFromStart] = useState(props.instanceSettings? props.instanceSettings.fromStart : logInstanceConfig.fromStart)
    const startTimeRef = useRef<any>(null)
    const defaultRef = useRef<any>(null)

    const onChangeMaxMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxMessages(+event.target.value)
    }

    const onChangeMaxPerPodMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxPerPodMessages(+event.target.value)
    }

    const onChangePrevious = (event:ChangeEvent<HTMLInputElement>) => {
        setPrevious(event.target.checked)
    }

    const onChangeFromStart = (event:ChangeEvent<HTMLInputElement>) => {
        setFromStart(event.target.checked)
    }

    const onChangeTimestamp = (event:ChangeEvent<HTMLInputElement>) => {
        setTimestamp(event.target.checked)
    }

    const onChangeFollow = (event:ChangeEvent<HTMLInputElement>) => {
        setFollow(event.target.checked)
    }

    const ok = () => {
        logUiConfig.follow = follow
        logUiConfig.maxMessages = maxMessages
        logUiConfig.maxPerPodMessages = maxPerPodMessages
        logUiConfig.sortOrder = sortOrder
        logUiConfig.startDiagnostics = (selectedTab === 'sd')
        logInstanceConfig.previous  = previous
        logInstanceConfig.timestamp = timestamp
        logInstanceConfig.fromStart = fromStart
        logInstanceConfig.startTime = new Date(startTimeRef.current?.value).getTime()
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked)
    }

    return (
        <Dialog open={true}>
            <DialogTitle>Configure log stream</DialogTitle>
            <DialogContent sx={{height:'350px'}}>
                <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                        <TextField value={maxMessages} onChange={onChangeMaxMessages} variant='standard'label='Max messages' SelectProps={{native: true}} type='number' fullWidth />

                    <Tabs value={selectedTab} onChange={(_: React.SyntheticEvent, newValue: string) => { setSelectedTab(newValue)}}>
                        <Tab key='sd' label='Start Diagnostics' value='sd' sx={{width:'50%'}}/>
                        <Tab key='log' label='Logging' value='log' sx={{width:'50%'}}/>
                    </Tabs>
                    <div hidden={selectedTab!=='sd'}>
                        <Stack spacing={2}>
                            <TextField value={maxPerPodMessages} onChange={onChangeMaxPerPodMessages} variant='standard'label='Max per Pod messages' SelectProps={{native: true}} type='number' fullWidth />
                            <Stack spacing={1}>
                                <FormLabel >Message sort order:</FormLabel>
                                <RadioGroup defaultValue={'none'} value={sortOrder} onChange={(event) => setSortOrder(event.target.value as LogSortOrderEnum)}>
                                    <Stack spacing={-1}>
                                        <Typography><Radio value='none'/>Show messages as they arrive</Typography>
                                        <Typography><Radio value='pod' />Keep together messages from the same pod</Typography>
                                        <Typography><Radio value='time'/>Use message time for sorting</Typography>
                                    </Stack>
                                </RadioGroup>
                            </Stack>
                        </Stack>
                    </div>
                    <div hidden={selectedTab!=='log'}>
                        <Stack direction='column'>
                            <Stack direction='row' alignItems={'baseline'}>
                                <Switch checked={fromStart} onChange={onChangeFromStart}/>
                                <Typography>Get messages from container start time</Typography>
                            </Stack>
                                <LocalizationProvider dateAdapter={AdapterMoment}>
                                    <DateTimePicker
                                        defaultValue={moment(Date.now()-30*60*1000)}
                                        viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                        slots={{ textField: (p) => <TextField {...p} variant='standard' sx={{ml:'60px', '& .MuiInputBase-root': {border: 'none'}, '& .MuiInputLabel-root': { color: fromStart?'light-gray':'black' } }}/> }}
                                        inputRef={startTimeRef}
                                        disabled={fromStart}
                                        label="Start time"
                                    />
                                </LocalizationProvider>
                        </Stack>

                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={previous} onChange={onChangePrevious}/>
                            <Typography>Get messages of previous container</Typography>
                        </Stack>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={timestamp} onChange={onChangeTimestamp}/>
                            <Typography>Add timestamp to messages</Typography>
                        </Stack>
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={follow} onChange={onChangeFollow}/>
                            <Typography>Follow new messages</Typography>
                        </Stack>
                    </div>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }}/>} label='Set as default' sx={{width:'100%', ml:'8px'}}/>
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { LogSetup, LogIcon }