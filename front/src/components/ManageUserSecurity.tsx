import React, { useState, useEffect, useRef } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, TextField, Typography} from '@mui/material';
const copy = require('clipboard-copy');

interface IProps {
  onClose:() => {};
  backend:string;
}

const ManageUserSecurity: React.FC<any> = (props:IProps) => {
  const [users, setUsers] = useState<[]>();
  const [selectedUser, setSelectedUser] = useState<string|undefined>(undefined);
  const [id, setId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  const getUsers = async () => {
    var response = await fetch(`${props.backend}/user`);
    var data = await response.json();
    setUsers(data);
  }

  useEffect( () => {
    getUsers();
  },[]);

  const onUserSelected = async (uselected:string) => {
    setId(uselected);
    setSelectedUser(uselected);
    var data = await (await fetch(`${props.backend}/user/${uselected}`)).json();
    setPassword(data.password);
    setDescription(data.description);
  }

  const onClickCopyPassword = () => {
    if (password!!=='') copy(password)
  }

  const onClickSave= async () => {
    if (selectedUser!==undefined) {
      // var newkey={ description:name, expire:expire};
      // await fetch(`${props.cluster!.url}/config/key`, {method:'POST', body:JSON.stringify(newkey), headers:{'Content-Type':'application/json'}});
      var user={ id:id, password:password,description:description }
      await fetch(`${props.backend}/user/id`, {method:'PUT', body:JSON.stringify(user), headers:{'Content-Type':'application/json'}})
    }
    else {
      var user={ id:id, password:password,description:description }
      await fetch(`${props.backend}/user`, {method:'POST', body:JSON.stringify(user), headers:{'Content-Type':'application/json'}})
      setSelectedUser(undefined)
    }
    setSelectedUser(undefined)
    setId('')
    setPassword('')
    setDescription('')
  await getUsers()
  }
  
  const onClickNew= () => {
    setSelectedUser(undefined);
    setId('');
    var pwd='';
    for (var i=0;i<8;i++) {
      var pos = Math.random()*60;
      pwd+='ABCDEFGHJKMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz23456789.-#$'.substring(pos,pos+1);
    }
    setPassword(pwd);
    setDescription('');
  }

  const onClickDelete= async () => {
    if (selectedUser!==undefined) {
      await fetch(`${props.backend}/user/${selectedUser}`, {method:'DELETE'});
      setId('')
      setPassword('')
      setDescription('')
      getUsers();
    }
  }

  return (<>
    <Dialog open={true} fullWidth maxWidth='md'>
      <DialogTitle>User management</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
          <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
            { users?.map(u => <ListItemButton key={u} onClick={() => onUserSelected(u)}><ListItem>{u}</ListItem></ListItemButton>)}
          </List>
          { <>
            <Stack sx={{width:'50vh'}} spacing={1}>
              <TextField value={id} onChange={(e) => setId(e.target.value)} variant='standard' label='Id'></TextField>
              <TextField value={password} onChange={(e) => setPassword(e.target.value)} variant='standard' label='Password'></TextField>
              <TextField value={description} onChange={(e) => setDescription(e.target.value)} variant='standard' label='Description'></TextField>
            </Stack>
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Stack direction='row' spacing={1}>
          <Button onClick={onClickNew}>NEW</Button>
          <Button onClick={onClickSave} disabled={id==='' || password===''}>SAVE</Button>
          <Button onClick={onClickCopyPassword} disabled={password===''}>COPY PASSWORD</Button>
          <Button onClick={onClickDelete} disabled={id==='admin'}>DELETE</Button>
        </Stack>
        <Typography sx={{flexGrow:1}}></Typography>
        <Button onClick={() => props.onClose()}>CLOSE</Button>
      </DialogActions>
    </Dialog>
  </>);
};

export default ManageUserSecurity;