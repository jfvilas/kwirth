import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, TextField, Typography } from '@mui/material'
import { IChannelObject } from '../../model/ITabObject'
import { LogObject } from '../../model/LogObject'

interface IProps {
    onClose:(maxMessages:number, previous:boolean, timestamp:boolean, follow:boolean, fromStart:boolean) => void
    channelObject?: IChannelObject
}

const SetupLog: React.FC<IProps> = (props:IProps) => {
    var dataLog = props.channelObject?.data as LogObject
    const [maxMessages, setMaxMessages] = useState(dataLog.maxMessages)
    const [previous, setPrevious] = useState(dataLog.previous)
    const [timestamp, setTimestamp] = useState(dataLog.timestamp)
    const [follow, setFollow] = useState(dataLog.follow)
    const [fromStart, setFromStart] = useState(dataLog.fromStart)

    const onChangeMaxMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxMessages(+event.target.value)
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

    return (
        <Dialog open={true}>
            <DialogTitle>Configure log stream</DialogTitle>
            <DialogContent>
                <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                    <TextField value={maxMessages} onChange={onChangeMaxMessages} variant='standard'label='Max messages' SelectProps={{native: true}} type='number'></TextField>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={fromStart} onChange={onChangeFromStart}/><Typography>Get messages from container start time</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={previous} onChange={onChangePrevious}/><Typography>Get messages of previous container</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={timestamp} onChange={onChangeTimestamp}/><Typography>Add timestamp to messages</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={follow} onChange={onChangeFollow}/><Typography>Follow new messages</Typography>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(maxMessages, previous, timestamp, follow, fromStart)}>OK</Button>
                <Button onClick={() => props.onClose(0,false,false,false, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SetupLog }