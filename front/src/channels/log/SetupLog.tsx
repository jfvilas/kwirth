import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormLabel, Radio, RadioGroup, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { LogObject } from './LogObject'
import { IChannelObject } from '../IChannel'

interface IProps {
    onClose:(maxMessages:number, previous:boolean, timestamp:boolean, follow:boolean, fromStart:boolean, startDiagnostics:boolean, maxPerPodMessages:number, sortOrder:string) => void
    channelObject?: IChannelObject
}

const SetupLog: React.FC<IProps> = (props:IProps) => {
    var dataLog = props.channelObject?.uiData as LogObject
    const [selectedTab, setSelectedTab] = useState(dataLog.startDiagnostics?'sd':'log')
    const [maxMessages, setMaxMessages] = useState(dataLog.maxMessages||5000)
    const [maxPerPodMessages, setMaxPerPodMessages] = useState(dataLog.maxPerPodMessages||1000)
    const [previous, setPrevious] = useState(dataLog.previous)
    const [timestamp, setTimestamp] = useState(dataLog.timestamp)
    const [follow, setFollow] = useState(dataLog.follow)
    const [fromStart, setFromStart] = useState(dataLog.fromStart)
    const [sortOrder, setSortOrder] = useState(dataLog.sortOrder)

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

    const onClose = () => {
        if (selectedTab==='sd')
            props.onClose(2000, false, true, false, true, true, maxPerPodMessages, sortOrder)
        else
            props.onClose(maxMessages, previous, timestamp, follow, fromStart, false, maxPerPodMessages, '')
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
                <Button onClick={onClose}>OK</Button>
                <Button onClick={() => props.onClose(0,false,false,false, false, false,0,'')}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SetupLog }