import React, { useState, ChangeEvent, useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, TextField, Typography } from '@mui/material';
import { Settings } from '../model/Settings';

interface IProps {
    onClose:(newSettings:Settings|undefined) => {};
    settings:Settings;
}

const SettingsConfig: React.FC<any> = (props:IProps) => {
    const [maxMessages, setMaxMessages] = useState(props.settings.maxMessages);
    const [previous, setPrevious] = useState(props.settings.previous);
    const [timestamp, setTimestamp] = useState(props.settings.timestamp);

    const onChangeMaxMessages = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxMessages(+event.target.value);
    }

    const onChangePrevious = (event:ChangeEvent<HTMLInputElement>) => {
        setPrevious(event.target.checked);
    }

    const onChangeTimestamp = (event:ChangeEvent<HTMLInputElement>) => {
        setTimestamp(event.target.checked);
    }

    const closeOk = () =>{
        var newSettings=new Settings();
        newSettings.maxMessages=maxMessages;
        newSettings.previous=Boolean(previous);
        newSettings.timestamp=Boolean(timestamp);
        props.onClose(newSettings);
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
            <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                <TextField value={maxMessages} onChange={onChangeMaxMessages} variant='standard'label='Max messages' SelectProps={{native: true}} type='number'></TextField>
                <Stack direction='row' alignItems={'baseline'}>
                    <Switch checked={previous} onChange={onChangePrevious}/><Typography>Get messages of previous deployment</Typography>
                </Stack>
                <Stack direction='row' alignItems={'baseline'}>
                    <Switch checked={timestamp} onChange={onChangeTimestamp}/><Typography>Add timestamp to messages</Typography>
                </Stack>
            </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={closeOk}>OK</Button>
                <Button onClick={() => props.onClose(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>);
};

export default SettingsConfig;