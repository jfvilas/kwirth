import React, { useState, useEffect, useContext } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, List, ListItem, ListItemButton, MenuItem, Select, SelectChangeEvent, Stack, TextField, Typography} from '@mui/material';
import { ApiKey } from '../model/ApiKey';
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox';
import { SessionContext, SessionContextType } from '../model/SessionContext';
import { AccessKey, accessKeySerialize, buildResource, parseResource } from '../model/AccessKey';
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
  const [keyType, setKeyType] = useState('volatile');
  const [scope, setScope] = useState('cluster');
  const [namespace, setNamespace] = useState('');
  const [setType, setSetType] = useState('');
  const [setName, setSetName] = useState('');
  const [pod, setPod] = useState('');
  const [container, setContainer] = useState('');

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
    console.log(key);
    var res=parseResource(key?.accessKey.resource!);
    console.log(res);
    setScope(res.scope);
    setKeyType(key?.accessKey.type!);
    setNamespace(res.namespace);
    var [setType, setName]=res.set.split('+');
    setSetType(setType);
    setSetName(setName);
    setPod(res.pod);
    setContainer(res.container);
  }

  const onClickCopy = () => {
    if (selectedKey) copy(accessKeySerialize(selectedKey?.accessKey));
  }

  const onClickSave= async () => {
    var res=buildResource(scope, namespace, setType, setName, pod, container);
    if (selectedKey!==undefined) {
      console.log(selectedKey);
      selectedKey.accessKey.type=keyType;
      selectedKey.accessKey.resource=res;
      var key={ accessKey:selectedKey?.accessKey, description, expire };
      await fetch(`${backendUrl}/key/${selectedKey?.accessKey.id}`, {method:'PUT', body:JSON.stringify(key), headers:{'Content-Type':'application/json', 'Authorization':'Bearer '+accessKey}});
    }
    else {
      var newkey={ description, expire, type:'volatile', resource:res};
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
    setMsgBox(MsgBoxYesNo('Delete API Key',`Are you sure you want to delete API Key ${selectedKey?.accessKey.id}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}));
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
              <FormControl variant='standard'>
                <InputLabel id='keytype'>Scope</InputLabel>
                <Select labelId='keytype' value={keyType} onChange={(e) => setKeyType(e.target.value)} >
                  { ['volatile','permanent'].map( (value:string) => {
                      return <MenuItem key={value} value={value}>{value}</MenuItem>
                  })}
                </Select>
              </FormControl>
              <FormControl variant='standard'>
                <InputLabel id='scope'>Scope</InputLabel>
                <Select labelId='scope' value={scope} onChange={(e) => setScope(e.target.value)} >
                  { ['cluster','namespace','set','pod','container'].map( (value:string) => {
                      return <MenuItem key={value} value={value}>{value}</MenuItem>
                  })}
                </Select>
              </FormControl>
              <TextField value={namespace} onChange={(e) => setNamespace(e.target.value)} variant='standard' label='Namespace'></TextField>
              <Grid container direction='row'>
                <Grid item xs={4}>
                  <FormControl variant='standard' style={{width:'100%'}}>
                    <InputLabel id='settype'>SetType</InputLabel>
                    <Select labelId='settype' value={setType} onChange={(e) => setSetType(e.target.value) }>
                      { ['','replica','stateful','daemon'].map( (value:string) => {
                          return <MenuItem key={value} value={value}>{value}</MenuItem>
                      })}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid xs={1}></Grid>
                <Grid item xs={7}>
                  <TextField value={setName} onChange={(e) => setSetName(e.target.value)} variant='standard' label='Set' style={{width:'100%'}}></TextField>
                </Grid>
              </Grid>
              <TextField value={pod} onChange={(e) => setPod(e.target.value)} variant='standard' label='Pod'></TextField>
              <TextField value={container} onChange={(e) => setContainer(e.target.value)} variant='standard' label='Container'></TextField>

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