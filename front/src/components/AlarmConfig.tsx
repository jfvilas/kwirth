import React, { useState, ChangeEvent } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Switch, TextField, Typography } from '@mui/material';

interface IProps {
    onClose:(arg:any) => {};
    expression:string;
}

const AlarmConfig: React.FC<any> = (props:IProps) => {
    const [expr, setExpr] = useState(props.expression);
    const [severity, setSeverity] = useState('default');
    const [type, setType] = useState('timed');
    const [message, setMessage] = useState('Alarm received matching '+props.expression);
    const [beep, setBeep] = useState(false);

    const onChangeExpr = (event:ChangeEvent<HTMLInputElement>) => {
        setExpr(event.target.value);
    }

    const onChangeSeverity = (event:ChangeEvent<HTMLInputElement>) => {
        setSeverity(event.target.value);
    }

    const onChangeMessage = (event:ChangeEvent<HTMLInputElement>) => {
        setMessage(event.target.value);
    }

    const onChangeType = (event:ChangeEvent<HTMLInputElement>) => {
        setType(event.target.value);
    }

    const onChangeBeep = (event:ChangeEvent<HTMLInputElement>) => {
        setBeep(event.target.checked);
    }

    return (<>
        <Dialog open={true} >
            <DialogTitle>Create alarm</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
                <TextField value={expr} onChange={onChangeExpr} variant='standard'label='Expression'></TextField>
                <TextField select value={severity} onChange={onChangeSeverity} variant='standard' label='Severity' SelectProps={{native: true}}>
                    {['default','info','success','warning','error'].map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>))}
                </TextField>
                <TextField select value={type} onChange={onChangeType} variant='standard' label='Type' SelectProps={{native: true}}>
                    {['timed','permanent','blocking'].map((option) => (
                        <option key={option} value={option}>
                            {option}
                        </option>))}
                </TextField>
                <TextField value={message} onChange={onChangeMessage} variant='standard'label='Message'></TextField>
                <Stack direction='row' alignItems={'baseline'}>
                    <Switch checked={beep} onChange={onChangeBeep}/><Typography>Beep on alarm</Typography>
                </Stack>
                </Stack>
                </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose({expression:expr, severity:severity, type:type, message:message, beep:beep})}>OK</Button>
                <Button onClick={() => props.onClose({})}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>);
};

export default AlarmConfig;