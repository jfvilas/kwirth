import React, { useState, ChangeEvent } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, TextField, Typography } from '@mui/material'
import { IChannelObject } from '../../model/ITabObject'
import { LogObject } from '../../model/LogObject'

interface IProps {
    onClose:(maxMessages:number, previous:boolean, timestamp:boolean, follow:boolean, fromStart:boolean, startDiagnostics:boolean) => void
    channelObject?: IChannelObject
}

const SetupLog: React.FC<IProps> = (props:IProps) => {
    var dataLog = props.channelObject?.data as LogObject
    const [maxMessages, setMaxMessages] = useState(dataLog.maxMessages)
    const [previous, setPrevious] = useState(dataLog.previous)
    const [timestamp, setTimestamp] = useState(dataLog.timestamp)
    const [follow, setFollow] = useState(dataLog.follow)
    const [fromStart, setFromStart] = useState(dataLog.fromStart)
    const [startDiagnostics, setStartDiagnostics] = useState(false)

    const onChangeMaxMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxMessages(+event.target.value)
    }

    const onChangePrevious = (event:ChangeEvent<HTMLInputElement>) => {
        setPrevious(event.target.checked)
    }

    const onChangeFromStart = (event:ChangeEvent<HTMLInputElement>) => {
        setFromStart(event.target.checked)
    }

    const onChangeStartDiagnostics = (event:ChangeEvent<HTMLInputElement>) => {
        setStartDiagnostics(event.target.checked)
    }

    const onChangeTimestamp = (event:ChangeEvent<HTMLInputElement>) => {
        setTimestamp(event.target.checked)
    }

    const onChangeFollow = (event:ChangeEvent<HTMLInputElement>) => {
        setFollow(event.target.checked)
    }

    const onClose = () => {
        if (startDiagnostics)
            props.onClose(2000, false, true, false, true, true)
        else
            props.onClose(maxMessages, previous, timestamp, follow, fromStart, false)
    }

    return (
        <Dialog open={true}>
            <DialogTitle>Configure log stream</DialogTitle>
            <DialogContent>
                <Stack  spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                    <TextField value={maxMessages} onChange={onChangeMaxMessages} variant='standard'label='Max messages' SelectProps={{native: true}} type='number'></TextField>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={startDiagnostics} onChange={onChangeStartDiagnostics}/>
                        <Typography>Get ONLY first messages from container start time</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={fromStart} onChange={onChangeFromStart} disabled={startDiagnostics}/>
                        <Typography>Get messages from container start time</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={previous} onChange={onChangePrevious} disabled={startDiagnostics}/>
                        <Typography>Get messages of previous container</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={timestamp} onChange={onChangeTimestamp} disabled={startDiagnostics}/>
                        <Typography>Add timestamp to messages</Typography>
                    </Stack>
                    <Stack direction='row' alignItems={'baseline'}>
                        <Switch checked={follow} onChange={onChangeFollow} disabled={startDiagnostics}/>
                        <Typography>Follow new messages</Typography>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>OK</Button>
                <Button onClick={() => props.onClose(0,false,false,false, false, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SetupLog }