import React, { useState, useEffect, useContext } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, TextField, Typography} from '@mui/material';
import { ApiKey } from '../model/ApiKey';
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox';
import { SessionContext, SessionContextType } from '../model/SessionContext';
import { AccessKey, accessKeyDeserialize, accessKeySerialize } from 'common/dist';
const copy = require('clipboard-copy');

interface IProps {
  onClose:() => {};
}

const ManageApiSecurity: React.FC<any> = (props:IProps) => {
  const {accessKey, backendUrl} = useContext(SessionContext) as SessionContextType;
  const [msgBox, setMsgBox] = useState(<></>);
  const [keys, setKeys] = useState<ApiKey[]|null>();
  const [selectedKey, setSelectedKey] = useState<ApiKey>();
  const [description, setDescrition] = useState<string>('');
  const [expire, setExpire] = useState<number>(0);

  const getKeys = async () => {
    var response = await fetch(`${backendUrl}/key`, { headers: { 'Authorization':'Bearer '+accessKey }});
    var data = await response.json();
    setKeys(data);
  }

  useEffect( () => {
    getKeys();
  },[]);

  const onKeySelected = (kselected:AccessKey|null) => {
    var key=keys?.find(k => k.accessKey===kselected);
    setSelectedKey(key);
    setDescrition(key?.description!);
    setExpire(key?.expire!);
  }

  const onClickCopy = () => {
    if (selectedKey) copy(selectedKey?.accessKey);
  }

  const onClickSave= async () => {
    if (selectedKey!==undefined) {
      var key={ accessKey:selectedKey?.accessKey, description, expire};
      await fetch(`${backendUrl}/key/${selectedKey?.accessKey.id}`, {method:'PUT', body:JSON.stringify(key), headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+accessKey}});
    }
    else {
      var newkey={ description, expire, type:'permanent', resource:'cluster:::::'};
      await fetch(`${backendUrl}/key`, {method:'POST', body:JSON.stringify(newkey), headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+accessKey}});
    }
    setDescrition('');
    setExpire(0);
    await getKeys();
  }

  const onClickNew= () => {
    setSelectedKey(undefined);
    setDescrition('');
    setExpire(0);
  }

  const onClickDelete= () => {
    setMsgBox(MsgBoxYesNo('Delete API Key',`Are you sure you want to delete API Key ${selectedKey?.accessKey}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}));
  }

  const onConfirmDelete= async () => {
    if (selectedKey!==undefined) {
      await fetch(`${backendUrl}/key/${selectedKey?.accessKey.id}`, {method:'DELETE', headers:{ 'Authorization':'Bearer '+accessKey }});
      setDescrition('');
      setExpire(0);
      getKeys();
    }
  }

  return (<>
    <Dialog open={true} fullWidth maxWidth='md'>
      <DialogTitle>API Key management</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
          <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
            { keys?.map( (k,index) => <ListItemButton key={index} onClick={() => onKeySelected(k.accessKey)}><ListItem>{accessKeySerialize(k.accessKey)}</ListItem></ListItemButton>)}
          </List>
          { <>
            <Stack sx={{width:'50vh'}} spacing={1}>
              <TextField value={description} onChange={(e) => setDescrition(e.target.value)} variant='standard' label='Description'></TextField>
              <TextField value={expire} onChange={(e) => setExpire(+e.target.value)} variant='standard' label='Expire'></TextField>
            </Stack>
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Stack direction='row' spacing={1}>
          <Button onClick={onClickNew}>NEW</Button>
          <Button onClick={onClickSave} disabled={description==='' || expire===0}>SAVE</Button>
          <Button onClick={onClickCopy} disabled={selectedKey===undefined}>COPY</Button>
          <Button onClick={onClickDelete} disabled={selectedKey===undefined || accessKeySerialize(selectedKey?.accessKey!)===accessKey}>DELETE</Button>
        </Stack>
        <Typography sx={{flexGrow:1}}></Typography>
        <Button onClick={() => props.onClose()}>CLOSE</Button>
      </DialogActions>
    </Dialog>
    {msgBox}
  </>);
};

export default ManageApiSecurity;