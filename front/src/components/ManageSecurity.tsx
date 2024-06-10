import React, { useState, useEffect, useRef } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, TextField, Typography} from '@mui/material';
import { Key } from '../model/Key';
import { Cluster } from '../model/Cluster';
const copy = require('clipboard-copy');

interface IProps {
  onClose:() => {};
  cluster:Cluster;
}

const ManageSecurity: React.FC<any> = (props:IProps) => {
  const [keys, setKeys] = useState<Key[]|null>();
  const [selectedKey, setSelectedKey] = useState<Key|null>();
  const [description, setDescrition] = useState<string>('');
  const [expire, setExpire] = useState<string|null>('');

  const getKeys = async () => {
    var response = await fetch(`${props.cluster!.url}/config/key`);
    var data = await response.json();
    setKeys(data);
  }

  useEffect( () => {
    getKeys();
  },[]);

  const onKeySelected = (kselected:string|null) => {
    var key=keys?.find(k => k.key===kselected);
    setSelectedKey(key);
    setDescrition(key?.description!);
    setExpire(key?.expire!);
  }

  const onClickCopy = () => {
    if (selectedKey) copy(selectedKey?.key);
  }

  const onClickSave= async () => {
    if (selectedKey!==undefined) {
      var key={ key:selectedKey?.key, description:description, expire:expire};
      await fetch(`${props.cluster!.url}/config/key/${selectedKey?.key}`, {method:'PUT', body:JSON.stringify(key), headers:{'Content-Type':'application/json'}});
    }
    else {
      var newkey={ description:description, expire:expire};
      await fetch(`${props.cluster!.url}/config/key`, {method:'POST', body:JSON.stringify(newkey), headers:{'Content-Type':'application/json'}});
    }
    await getKeys();
  }

  const onClickNew= () => {
    setSelectedKey(undefined);
    setDescrition('');
    //var x=new Date().getFullYear()+1;
    //setExpire(new Date(new Date().setFullYear(x,1,1)));
    setExpire('');
  }

  const onClickDelete= async () => {
    if (selectedKey!==undefined) {
      await fetch(`${props.cluster!.url}/config/key/${selectedKey?.key}`, {method:'DELETE'});
      setDescrition('');
      setExpire('');
      getKeys();
    }
  }

  return (<>
    <Dialog open={true} fullWidth maxWidth='md'>
      <DialogTitle>API Key management</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
          <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
            { keys?.map(k => <ListItemButton key={k.key} onClick={() => onKeySelected(k.key)}><ListItem>{k.key}</ListItem></ListItemButton>)}
          </List>
          { <>
            <Stack sx={{width:'50vh'}} spacing={1}>
              <TextField value={description} onChange={(e) => setDescrition(e.target.value)} variant='standard' label='Description'></TextField>
              <TextField value={expire} onChange={(e) => setExpire(e.target.value)} variant='standard' label='Expire'></TextField>
            </Stack>
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Stack direction='row' spacing={1}>
          <Button onClick={onClickNew}>NEW</Button>
          <Button onClick={onClickSave} disabled={description==='' || expire===''}>SAVE</Button>
          <Button onClick={onClickCopy} disabled={selectedKey===undefined}>COPY</Button>
          <Button onClick={onClickDelete} disabled={selectedKey===undefined}>DELETE</Button>
        </Stack>
        <Typography sx={{flexGrow:1}}></Typography>
        <Button onClick={() => props.onClose()}>CLOSE</Button>
      </DialogActions>
    </Dialog>
  </>);
};

export default ManageSecurity;