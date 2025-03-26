import React, { useState, useEffect, useContext } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, Grid, InputLabel, List, ListItem, ListItemButton, MenuItem, Select, Stack, TextField, Typography} from '@mui/material'
import { User } from '../model/User'
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox'
import { SessionContext, SessionContextType } from '../model/SessionContext'
import { addDeleteAuthorization, addGetAuthorization, addPostAuthorization, addPutAuthorization } from '../tools/AuthorizationManagement'
const copy = require('clipboard-copy')

interface IProps {
    onClose:() => {};
}

const ManageUserSecurity: React.FC<any> = (props:IProps) => {
    const {accessKey: accessString, backendUrl} = useContext(SessionContext) as SessionContextType
    const [users, setUsers] = useState<string[]>()
    const [selectedUser, setSelectedUser] = useState<User|undefined>(undefined)
    const [msgBox, setMsgBox] = useState(<></>)

    const [id, setId] = useState<string>('')
    const [name, setName] = useState<string>('')
    const [password, setPassword] = useState<string>('')

    const [scope, setScope] = useState('cluster')
    const [namespace, setNamespace] = useState('')
    const [groupType, setGroupType] = useState('')
    const [groupName, setGroupName] = useState('')
    const [pod, setPod] = useState('')
    const [container, setContainer] = useState('')
    
    const getUsers = async () => {
        var response = await fetch(`${backendUrl}/user`, addGetAuthorization(accessString))
        var data = await response.json()
        setUsers(data)
    }

    useEffect( () => {
        getUsers()
    },[]);

    const onUserSelected = async (uname:string) => {
        setId(uname)
        var data = await (await fetch(`${backendUrl}/user/${uname}`, addGetAuthorization(accessString))).json()
        setSelectedUser(data)
        setName(data.name||'')
        setPassword(data.password||'')
        setScope(data.scope||'')
        setNamespace(data.namespace||'')
        var [type,name]=data.group.split('+')
        setGroupType(type||'')
        setGroupName(name||'')
        setPod(data.pod||'')
        setContainer(data.container||'')
    }

    const onClickCopyPassword = () => {
        if (password!!=='') copy(password)
    }

    const onClickSave= async () => {
        var user={ id, name, password, scope, namespace, group: (groupType!==''? groupType+'+'+groupName:''), pod, container }
        var payload=JSON.stringify(user)
        if (selectedUser!==undefined) {
            await fetch(`${backendUrl}/user/${user.id}`, addPutAuthorization(accessString, payload))
        }
        else {
            await fetch(`${backendUrl}/user`, addPostAuthorization(accessString, payload))
            setSelectedUser(undefined)
        }
        setSelectedUser(undefined)
        setId('')
        setName('')
        setPassword('')
        setScope('')
        setNamespace('')
        setGroupType('')
        setGroupName('')
        setPod('')
        setContainer('')
        await getUsers()
    }
    
    const onClickNew= () => {
        setSelectedUser(undefined)
        setId('')
        var pwd=''
        for (var i=0;i<8;i++) {
            var pos = Math.random()*60
            pwd+='ABCDEFGHJKMNOPQRSTUVWXYZabcdefghjkmnopqrstuvwxyz23456789.-#$'.substring(pos,pos+1)
        }
        setName('')
        setPassword(pwd)
        setScope('')
        setNamespace('')
        setGroupType('')
        setGroupName('')
        setPod('')
        setContainer('')
    }

    const onClickDelete= () => {
        setMsgBox(MsgBoxYesNo('Delete user',`Are you sure you want to delete user ${selectedUser?.id}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}))
    }
    const onConfirmDelete= async () => {
        if (selectedUser!==undefined) {
            await fetch(`${backendUrl}/user/${selectedUser.id}`, addDeleteAuthorization(accessString))
            setId('')
            setName('')
            setPassword('')
            setScope('')
            setNamespace('')
            setGroupType('')
            setGroupName('')
            setPod('')
            setContainer('')
            getUsers()
        }
    }

    return (<>
        <Dialog open={true} fullWidth maxWidth='md'>
            <DialogTitle>User management</DialogTitle>
            <DialogContent>
                <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
                    <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
                        { users?.map(u => 
                        <ListItemButton key={u} onClick={() => onUserSelected(u)} style={{backgroundColor:(u===selectedUser?.id?'lightgray':'')}}>
                            <ListItem>{u}</ListItem>
                        </ListItemButton>
                        )}
                    </List>
                    
                    <Stack sx={{width:'50vh'}} spacing={1}>
                        <Box sx={{ flex: 1, display: 'flex', alignItems: 'start', paddingLeft: '16px'}} >

                            <Stack spacing={1} style={{width:'100%'}}>
                                <TextField value={id} onChange={(e) => setId(e.target.value)} variant='standard' label='Id'></TextField>
                                <TextField value={name} onChange={(e) => setName(e.target.value)} variant='standard' label='Name'></TextField>
                                <TextField value={password} onChange={(e) => setPassword(e.target.value)} variant='standard' label='Password'></TextField>

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
                                            <InputLabel id='grouptype'>GroupType</InputLabel>
                                            <Select labelId='grouptype' value={groupType} onChange={(e) => setGroupType(e.target.value) }>
                                            { ['','replica','stateful','daemon'].map( (value:string) => {
                                                return <MenuItem key={value} value={value}>{value}</MenuItem>
                                            })}
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid item xs={0.5}></Grid>
                                    <Grid item xs={7.5}>
                                        <TextField value={groupName} onChange={(e) => setGroupName(e.target.value)} disabled={groupType===''} variant='standard' label='Group' style={{width:'100%'}}></TextField>
                                    </Grid>
                                </Grid>
                                <TextField value={pod} onChange={(e) => setPod(e.target.value)} variant='standard' label='Pod'></TextField>
                                <TextField value={container} onChange={(e) => setContainer(e.target.value)} variant='standard' label='Container'></TextField>
                            </Stack>
                        </Box>
                    </Stack>
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
        {msgBox}
    </>)
}

export default ManageUserSecurity