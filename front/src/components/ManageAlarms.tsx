import React, { useState, useEffect, useContext } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, Switch, TextField, Typography} from '@mui/material';
import { Alarm, AlarmSeverity, AlarmType } from '../model/Alarm';
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox';
import { LogObject } from '../model/LogObject';
import { SessionContext, SessionContextType } from '../model/SessionContext';

interface IProps {
  onClose:() => {};
  log:LogObject;
}

const ManageAlarms: React.FC<any> = (props:IProps) => {
  const {apiKey} = useContext(SessionContext) as SessionContextType;
  const [alarms, setAlarms] = useState<Alarm[]>();
  const [msgBox, setMsgBox] = useState(<></>);
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm|undefined>(undefined);

  const [id, setId] = useState<string>('');
  const [expression, setExpression] = useState<string>('');
  const [severity, setSeverity] = useState<AlarmSeverity>();
  const [message, setMessage] = useState<string>('');
  const [type, setType] = useState<AlarmType>();
  const [beep, setBeep] = useState<boolean>(false);

  useEffect( () => {
    setAlarms(props.log.alarms);
  },[]);

  const onAlarmSelected = async (alarmId:string) => {
    // setId(uname);
    // var data = await (await fetch(`${props.backend}/user/${uname}`)).json();
    // setSelectedAlarm(data);
    // setName(data.name||'');
    // setPassword(data.password||'');
    // setRoles(data.roles||'');
    // setDescription(data.description||'');
  }

  const onClickSave = async () => {
    // var user={ id:id, name:name, password:password, roles:roles, description:description }
    // if (selectedAlarm!==undefined) {
    //   await fetch(`${props.backend}/user/${user.id}`, {method:'PUT', body:JSON.stringify(user), headers:{'Content-Type':'application/json'}})
    // }
    // else {
    //   await fetch(`${props.backend}/user`, {method:'POST', body:JSON.stringify(user), headers:{'Content-Type':'application/json'}})
    //   setSelectedAlarm(undefined)
    // }
    // setSelectedAlarm(undefined)
    // setId('')
    // setName('');
    // setPassword('')
    // setRoles('');
    // setDescription('')
    // await getAlarms()
  }
  
  const onClickNew= () => {
    // setSelectedAlarm(undefined);
    // setId('');
    // var pwd='';
    // for (var i=0;i<8;i++) {
    //   var pos = Math.random()*60;
    //   pwd+='ABCDEFGHJKMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz23456789.-#$'.substring(pos,pos+1);
    // }
    // setName('');
    // setPassword(pwd);
    // setRoles('');
    // setDescription('');
  }

  const onClickDelete= () => {
    setMsgBox(MsgBoxYesNo('Delete Alarm',`Are you sure you want to delete alarm ${selectedAlarm?.id}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}));
  }
  const onConfirmDelete = async () => {
    if (selectedAlarm!==undefined) {
      // await fetch(`${props.backend}/user/${selectedAlarm.id}`, {method:'DELETE'});
      // setId('')
      // setName('');
      // setPassword('')
      // setRoles('');
      // setDescription('')
      // getAlarms();
    }
  }

  return (<>
    <Dialog open={true} fullWidth maxWidth='md'>
      <DialogTitle>Alarm management</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
          <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
            { alarms?.map(a => <ListItemButton key={a.id} onClick={() => onAlarmSelected(a.id)}><ListItem>{a.id}</ListItem></ListItemButton>)}
          </List>
          { <>
            <Stack sx={{width:'50vh'}} spacing={1}>
              <TextField value={id} onChange={(e) => setId(e.target.value)} variant='standard' label='Id'></TextField>
              <TextField value={expression} onChange={(e) => setExpression(e.target.value)} variant='standard' label='Expression'></TextField>
              {/* <TextField value={severity} onChange={(e) => setSeverity(e.target.value)} variant='standard' label='Severity'></TextField> */}
              <TextField value={message} onChange={(e) => setMessage(e.target.value)} variant='standard' label='Message'></TextField>
              {/* <TextField value={type} onChange={(e) => setType(e.target.value)} variant='standard' label='Type'></TextField> */}
              <Stack direction='row' alignItems={'baseline'}>
                <Switch checked={beep} onChange={() => setBeep(beep)}/><Typography>Beep on alarm</Typography>
              </Stack>
            </Stack>
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Stack direction='row' spacing={1}>
          <Button onClick={onClickNew}>NEW</Button>
          <Button onClick={onClickSave} disabled={id===''}>SAVE</Button>
          <Button onClick={onClickDelete} disabled={id==='admin'}>DELETE</Button>
        </Stack>
        <Typography sx={{flexGrow:1}}></Typography>
        <Button onClick={() => props.onClose()}>CLOSE</Button>
      </DialogActions>
    </Dialog>
    {msgBox}
  </>);
};

export default ManageAlarms;