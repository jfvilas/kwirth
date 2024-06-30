import React, { useState, ChangeEvent } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { LogObject } from '../model/LogObject';

interface IProps {
  onClose:(a:string|null) => {};
  logs:LogObject[];
  oldname:string;
}

const RenameLog: React.FC<any> = (props:IProps) => {
  const [newname, setNewname] = useState(props.oldname);

  const onChangeNewname = (event:ChangeEvent<HTMLInputElement>) => {
      setNewname(event.target.value);
  }

  return (<>
    <Dialog open={true} disableRestoreFocus={true}>
      <DialogTitle>Rename tab</DialogTitle>
      <DialogContent>
      <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column', width: '50vh' }}>
        <Typography>Old name: {props.oldname}</Typography>
        <TextField value={newname} onChange={onChangeNewname} variant='standard'label='New name' autoFocus></TextField>
      </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose(newname)} disabled={props.logs.some(t => t.name===newname)}>OK</Button>
        <Button onClick={() => props.onClose(null)}>CANCEL</Button>
      </DialogActions>
    </Dialog>
  </>);
};

export default RenameLog;