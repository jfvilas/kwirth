import React, { useState, useRef, ChangeEvent } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, IconButton, InputLabel, Menu, MenuItem, MenuList, Select, SelectChangeEvent, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material';

const AlertConfig: React.FC<any> = ({onClose, expression}) => {
  const [expr, setExpr] = useState(expression);
  const [severity, setSeverity] = useState('default');
  const [type, setType] = useState('timed');
  const [message, setMessage] = useState('Alert received matching expression '+expression);
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

  return (
    <>
    <Dialog open={true} >
    <DialogTitle>Create alert</DialogTitle>
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
      <Button onClick={() => onClose({expression:expression, severity:severity, type:type, message:message, beep:beep})}>OK</Button>
      <Button onClick={() => onClose({})}>CANCEL</Button>
    </DialogActions>
  </Dialog>
  </>
  );
};

export default AlertConfig;