import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography} from '@mui/material';

interface IProps {
  onClose:(result:boolean,apiKey:string, user:string) => {},
  backend:string
}

const AddCluster: React.FC<any> = (props:IProps) => {
  const [user, setUser] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const login = async (u:string, p:string, n:string='') => {
    if (n!=='') {
      var payload=JSON.stringify({user:u, password:p, newpassword:n});
      return await fetch(props.backend+'/password', {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    }
    else {
      var payload=JSON.stringify({user:u, password:p});
      return await fetch(props.backend+'/login', {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    }
  }

  const onClickOk= async () => {
    if(changingPassword) {
      if (newPassword1===newPassword2) {
        var t = await login(user,password,newPassword1);
        if (t.status===200) {
          setUser('');
          setPassword('');
          props.onClose(true, await t.text(), user);
        }
        else {
          setUser('');
          setPassword('');
          setChangingPassword(false);
        }
      }
    }
    else {
      var t = await login(user,password);
      switch (t.status) {
        case 200:
          setUser('');
          setPassword('');
          props.onClose(true, await t.text(), user);
          break;
        case 201:
          setUser('');
          setPassword('');
          setChangingPassword(true);
          break;
      }
    }
  }

  const onClickCancel = () => {
    if (changingPassword){
      setChangingPassword(false);
      setUser('');
      setPassword('');
    }
    else {
      props.onClose(false,'', '');
    }
  }

  const onClickChangePassword = async () => {
    if ((await login(user,password)).status===200) {
      setChangingPassword(true);
    }
  }

  return (<>
    <Dialog open={true} disableRestoreFocus={true} fullWidth maxWidth={'xs'}>
      <DialogTitle>Enter credentials</DialogTitle>
      <DialogContent>
      <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column'}}>
        { !changingPassword &&<>
          <TextField value={user} onChange={(ev) => setUser(ev.target.value)} variant='standard'label='User' autoFocus></TextField>
          <TextField value={password} onChange={(ev) => setPassword(ev.target.value)} type='password' variant='standard'label='Password'></TextField>
        </>}
        { changingPassword && <>
          <Typography>Change your password, since it's your first login</Typography>
          <TextField value={newPassword1} onChange={(ev) => setNewPassword1(ev.target.value)} type='password' variant='standard' label='New Password' autoFocus></TextField>
          <TextField value={newPassword2} onChange={(ev) => setNewPassword2(ev.target.value)} type='password' variant='standard' label='Repeat New Password'></TextField>
        </>}
      </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClickChangePassword} sx={{display:changingPassword?'none':'block'}}>Change Password</Button>
        <Typography sx={{ flexGrow:1}}></Typography>
        <Button onClick={onClickOk} >OK</Button>
        <Button onClick={onClickCancel}>CANCEL</Button>
      </DialogActions>
    </Dialog>
  </>);
};

export default AddCluster;