import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography} from '@mui/material';
import { User } from '../model/User';
import { MsgBoxOkError, MsgBoxOkWarning } from '../tools/MsgBox';

interface IProps {
  onClose:(result:boolean,user:User|null, apiKey:string) => {},
  backend:string
}

const Login: React.FC<any> = (props:IProps) => {
  const [msgBox, setMsgBox] = useState(<></>);
  const [user, setUser] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const login = async (user:string, password:string, newPassword:string='') => {
    if (newPassword!=='') {
      var payload=JSON.stringify({user:user, password:password, newpassword:newPassword});
      return await fetch(props.backend+'/login/password', {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    }
    else {
      var payload=JSON.stringify({user:user, password:password});
      return await fetch(props.backend+'/login', {method:'POST', body:payload, headers:{'Content-Type':'application/json'}});
    }
  }

  const loginOk = (jsonResult:any) => {
    var receivedUser:User=jsonResult as User;
    props.onClose(true, receivedUser, jsonResult.apiKey);
  }

  const onClickOk= async () => {
    if(changingPassword) {
      if (newPassword1===newPassword2) {
        var result = await login(user,password,newPassword1);
        if (result.status===200) {
          setUser('');
          setPassword('');
          loginOk(await result.json());
        }
        else {
          setMsgBox(MsgBoxOkWarning('Login',`Password could not be changesd.`, setMsgBox));
          setUser('');
          setPassword('');
          setChangingPassword(false);
        }
      }
    }
    else {
      var result = await login(user,password);
      switch (result.status) {
        case 200:
          setUser('');
          setPassword('');
          loginOk(await result.json());
          break;
        case 201:
          setNewPassword1('');
          setNewPassword2('');
          setChangingPassword(true);
          break;
        case 401:
          setMsgBox(MsgBoxOkError('Login',`You have entered invalid credentials.`, setMsgBox));
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
      props.onClose(false,null,'');
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
        <Button onClick={onClickOk} disabled={((changingPassword && newPassword1!==newPassword2) || user==='' || password==='')}>OK</Button>
        <Button onClick={onClickCancel}>CANCEL</Button>
      </DialogActions>
    </Dialog>
    {msgBox}
  </>);
};

export default Login;
