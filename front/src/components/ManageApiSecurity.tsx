import React, { useState, useEffect, useContext } from 'react';
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Grid, InputLabel, List, ListItem, ListItemButton, MenuItem, Select, SelectChangeEvent, Stack, TextField, Typography} from '@mui/material';
import { ApiKey } from '../model/ApiKey';
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox';
import { SessionContext, SessionContextType } from '../model/SessionContext';
import { AccessKey, accessKeySerialize, buildResource, parseResource } from '../model/AccessKey';
import { addDeleteAuthorization, addGetAuthorization, addPostAuthorization, addPutAuthorization } from '../tools/AuthorizationManagement';
const copy = require('clipboard-copy');

interface IProps {
    onClose:() => {};
}

const ManageApiSecurity: React.FC<any> = (props:IProps) => {
    const {accessKey: accessString, backendUrl} = useContext(SessionContext) as SessionContextType;
    const [msgBox, setMsgBox] = useState(<></>);
    const [keys, setKeys] = useState<ApiKey[]|null>();
    const [selectedKey, setSelectedKey] = useState<ApiKey>();
    const [description, setDescrition] = useState<string>('');
    const [expire, setExpire] = useState<number>(0);
    const [keyType, setKeyType] = useState('volatile');
    const [scope, setScope] = useState('cluster');
    const [namespace, setNamespace] = useState('');
    const [groupType, setGroupType] = useState('');
    const [groupName, setGroupName] = useState('');
    const [pod, setPod] = useState('');
    const [container, setContainer] = useState('');
    const [showPermanent, setShowPermanent] = useState<boolean>(true);
    const [showVolatile, setShowVolatile] = useState<boolean>(false);

    const getKeys = async () => {
        var response = await fetch(`${backendUrl}/key`, addGetAuthorization(accessString));
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
        if (res.set===''){
            setGroupType('');
            setGroupName('');
        }
        else {
            var [setType, setName]=res.set.split('+');
            setGroupType(setType);
            setGroupName(setName);
        }
        setPod(res.pod);
        setContainer(res.container);
    }

    const onClickCopy = () => {
        if (selectedKey) copy(accessKeySerialize(selectedKey?.accessKey));
    }

    const onClickSave= async () => {
        var res=buildResource(scope, namespace, groupType, groupName, pod, container);
        if (selectedKey!==undefined) {
            console.log(selectedKey);
            selectedKey.accessKey.type=keyType;
            selectedKey.accessKey.resource=res;
            var key={ accessKey:selectedKey?.accessKey, description, expire };
            var payload=JSON.stringify(key);
            await fetch(`${backendUrl}/key/${selectedKey?.accessKey.id}`, addPutAuthorization(accessString, payload));
        }
        else {
            var newkey={ description, expire, type:keyType, resource:res};
            var payload=JSON.stringify(newkey);
            await fetch(`${backendUrl}/key`, addPostAuthorization(accessString, payload));
        }
        setDescrition('');
        setExpire(0);
        await getKeys();
    }

    const onClickNew= () => {
        setSelectedKey(undefined);
        setDescrition('');
        var a = Date.now();
        a+=1000*60*60*24*30; // 30 days
        setExpire(a);
        setKeyType('permanent');
        setScope('');
        setNamespace('');
        setGroupType('');
        setGroupName('');
        setPod('');
        setContainer('');
    }

    const onClickDelete= () => {
        setMsgBox(MsgBoxYesNo('Delete API Key',`Are you sure you want to delete API Key ${selectedKey?.accessKey.id}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}));
    }

    const onConfirmDelete= async () => {
        if (selectedKey!==undefined) {
            await fetch(`${backendUrl}/key/${selectedKey?.accessKey.id}`, addDeleteAuthorization(accessString));
            setDescrition('');
            setExpire(0);
            getKeys();
        }
    }

    return (<>
        <Dialog open={true} fullWidth maxWidth='md' PaperProps={{ style: {height: '60vh' }}}>
            <DialogTitle>API Key management</DialogTitle>
            <DialogContent style={{ display:'flex', height:'100%'}}>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', maxWidth: 'calc(50% - 8px)'}}>
                    <Box alignSelf={'center'}>
                        <Stack flexDirection={'row'} alignItems={'center'}>
                            <Checkbox checked={showPermanent} onChange={() => setShowPermanent(!showPermanent)}/><Typography>Permanent</Typography>
                            <Checkbox checked={showVolatile} onChange={() => setShowVolatile(!showVolatile)}/><Typography>Volatile</Typography>
                        </Stack>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto' }}>
                        <div style={{ flex:0.9, overflowY: 'auto', overflowX:'hidden'}} >
                            <List sx={{flexGrow:1, mr:2, width:'50vh', overflowY:'auto' }}>
                                { keys?.filter(k => (showPermanent && k.accessKey.type==='permanent') || (showVolatile && k.accessKey.type==='volatile')).map( (k,index) => 
                                    <ListItemButton key={index} onClick={() => onKeySelected(k.accessKey)} style={{backgroundColor:(k.accessKey.id===selectedKey?.accessKey.id?'lightgray':'')}}>
                                        <ListItem>{accessKeySerialize(k.accessKey)}</ListItem>
                                    </ListItemButton>
                                )}
                            </List>                            
                        </div>
                    </Box>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', alignItems: 'start', paddingLeft: '16px'}} >
                    <Stack spacing={1} style={{width:'100%'}}>
                        <TextField value={description} onChange={(e) => setDescrition(e.target.value)} variant='standard' label='Description'></TextField>
                        <TextField value={expire} onChange={(e) => setExpire(+e.target.value)} variant='standard' label='Expire'></TextField>
                        <FormControl variant='standard'>
                            <InputLabel id='keytype'>Scope</InputLabel>
                            <Select labelId='keytype' value={keyType} onChange={(e) => setKeyType(e.target.value)} disabled={true}>
                                { ['volatile','permanent'].map( (value:string) => {
                                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                                })}
                            </Select>
                        </FormControl>
                        <FormControl variant='standard'>
                            <InputLabel id='scope'>Scope</InputLabel>
                            <Select labelId='scope' value={scope} onChange={(e) => setScope(e.target.value)} >
                                { ['cluster','api','restart','view'].map( (value:string) => {
                                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                                })}
                            </Select>
                        </FormControl>
                        <TextField value={namespace} onChange={(e) => setNamespace(e.target.value)} variant='standard' label='Namespace'></TextField>
                        <Grid container direction='row'>
                            <Grid item xs={4}>
                                <FormControl variant='standard' style={{width:'100%'}}>
                                    <InputLabel id='settype'>SetType</InputLabel>
                                    <Select labelId='settype' value={groupType} onChange={(e) => setGroupType(e.target.value) }>
                                    { ['','replica','stateful','daemon'].map( (value:string) => {
                                        return <MenuItem key={value} value={value}>{value}</MenuItem>
                                    })}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={0.5}></Grid>
                            <Grid item xs={7.5}>
                                <TextField value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={groupType===''} variant='standard' label='Set' style={{width:'100%'}}></TextField>
                            </Grid>
                        </Grid>
                        <TextField value={pod} onChange={(e) => setPod(e.target.value)} variant='standard' label='Pod'></TextField>
                        <TextField value={container} onChange={(e) => setContainer(e.target.value)} variant='standard' label='Container'></TextField>
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions>
                <Stack direction='row' spacing={1}>
                    <Button onClick={onClickNew}>NEW</Button>
                    <Button onClick={onClickSave} disabled={
                        description==='' ||
                        expire===0 ||
                        selectedKey?.accessKey.type==='volatile' ||
                        accessKeySerialize(selectedKey?.accessKey!)===accessString
                        }>SAVE</Button>
                    <Button onClick={onClickCopy} disabled={selectedKey===undefined}>COPY</Button>
                    <Button onClick={onClickDelete} disabled={
                        selectedKey===undefined || 
                        accessKeySerialize(selectedKey?.accessKey!)===accessString ||
                        selectedKey.accessKey.type==='volatile'
                        }>DELETE</Button>
                </Stack>
                <Typography sx={{flexGrow:1}}></Typography>
                <Button onClick={() => props.onClose()}>CLOSE</Button>
            </DialogActions>
        </Dialog>
        {msgBox}
    </>);
};

export default ManageApiSecurity;