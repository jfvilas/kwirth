import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormLabel, Radio, RadioGroup, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { Subject } from '@mui/icons-material'
import { ILogInstanceConfig, ILogUiConfig } from './LogConfig'

const LogIcon = <Subject />

const LogSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let logUiConfig:ILogUiConfig = props.channelObject?.uiConfig
    let logInstanceConfig:ILogInstanceConfig = props.channelObject?.instanceConfig

    const [selectedTab, setSelectedTab] = useState(logUiConfig.startDiagnostics?'sd':'log')
    const [maxMessages, setMaxMessages] = useState(logUiConfig.maxMessages||5000)
    const [maxPerPodMessages, setMaxPerPodMessages] = useState(logUiConfig.maxPerPodMessages||1000)
    const [previous, setPrevious] = useState(logInstanceConfig.previous)
    const [timestamp, setTimestamp] = useState(logInstanceConfig.timestamp)
    const [follow, setFollow] = useState(logUiConfig.follow)
    const [fromStart, setFromStart] = useState(logInstanceConfig.fromStart)
    const [sortOrder, setSortOrder] = useState(logUiConfig.sortOrder)

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
        props.onChannelSetupClosed(props.channel, true)
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
                                <RadioGroup defaultValue={'none'} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
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
                        <Stack direction='row' alignItems={'baseline'}>
                            <Switch checked={fromStart} onChange={onChangeFromStart}/>
                            <Typography>Get messages from container start time</Typography>
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
                <Button onClick={ok}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { LogSetup, LogIcon }