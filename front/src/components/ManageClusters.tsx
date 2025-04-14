import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, TextField, Typography} from '@mui/material'
import { Cluster } from '../model/Cluster'
import { MsgBoxButtons, MsgBoxOk, MsgBoxYesNo } from '../tools/MsgBox'
import { addGetAuthorization } from '../tools/AuthorizationManagement'

interface IProps {
  onClose:(clusters:Cluster[]) => {}
  clusters:Cluster[]
}

const ManageClusters: React.FC<any> = (props:IProps) => {
    const [clusters, setClusters] = useState<Cluster[]>(props.clusters)
    const [selectedCluster, setSelectedCluster] = useState<Cluster|null>()
    const [name, setName] = useState<string>('')
    const [url, setUrl] = useState<string>('')
    const [accessKey, setAccessKey] = useState<string>('')
    const [msgBox, setMsgBox] =useState(<></>)

    const onClusterSelected = (idSelected:string|null) => {
        var cluster=clusters?.find(k => k.id===idSelected)
        setSelectedCluster(cluster)
        setName(cluster?.name!)
        setUrl(cluster?.url!)
        setAccessKey(cluster?.accessString!)
    }

    const onClickSave= async () => {
        if (selectedCluster) {
            selectedCluster.accessString=accessKey
            selectedCluster.name=name
            selectedCluster.url=url
            clusters.splice(clusters?.findIndex(c => c.id===selectedCluster.id)!,1)
            clusters?.push(selectedCluster)
        }
        else {
            var c=new Cluster()
            c.accessString=accessKey
            c.name=name
            c.url=url
            clusters?.push(c)
        }
        setName('')
        setUrl('')
        setAccessKey('')
        setClusters(clusters)
    }

    const onClickTest= async () => {
        try {
            let response = await fetch(`${url}/config/version`, addGetAuthorization(accessKey))
            let data = await response.json()
            let status = JSON.stringify(data).replaceAll(',',',<br/>')
            status = status.replaceAll('{','').replaceAll('}','')
            setMsgBox(MsgBoxOk('Test cluster',`Connection to cluster has been succesfully tested. This is cluster data: <br/><br/>${status}`, setMsgBox))
        }
        catch (error) {
            setMsgBox(MsgBoxOk('Test cluster',`Couldn't test connection. Error: <br/><br/>${error}`, setMsgBox))
        }
    }

    const onClickNew= () => {
        setSelectedCluster(undefined)
        setName('')
        setUrl('')
        setAccessKey('')
    }

    const onClickDelete= () => {
        setMsgBox(MsgBoxYesNo('Delete Cluster',`Are you sure you want to delete cluster ${selectedCluster?.name}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}))
    }

    const onConfirmDelete= async () => {
        if (selectedCluster) {
            clusters.splice(clusters?.findIndex(c => c.id===selectedCluster.id)!,1)
            setName('')
            setUrl('')
            setAccessKey('')
            setSelectedCluster(undefined)
        }
    }

    return (<>
        <Dialog open={true} fullWidth maxWidth='md'>
            <DialogTitle>Manage clusters</DialogTitle>
            <DialogContent>
                <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
                    <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
                        { clusters?.map(c => 
                            <ListItemButton key={c.name+c.id} onClick={() => onClusterSelected(c.id)} style={{backgroundColor:(c.id===selectedCluster?.id?'lightgray':'')}}>
                                <ListItem>
                                  <Stack direction={'column'}>
                                      <Typography>{c.name}</Typography>
                                      {c.kwirthData?.clusterType && <Typography color={'darkgray'} fontSize={12}>{c.kwirthData?.version}<b> ({c.kwirthData?.clusterType})</b></Typography>}
                                  </Stack>
                                </ListItem>
                            </ListItemButton>
                        )}
                    </List>
                    {
                        <Stack sx={{width:'50vh'}} spacing={1}>
                            <TextField value={name} onChange={(e) => setName(e.target.value)} disabled={selectedCluster?.source} variant='standard' label='Name'></TextField>
                            <TextField value={url} onChange={(e) => setUrl(e.target.value)} disabled={selectedCluster?.source}variant='standard' label='URL'></TextField>
                            <TextField value={accessKey} onChange={(e) => setAccessKey(e.target.value)} disabled={selectedCluster?.source} variant='standard' label='API Key'></TextField>
                        </Stack>
                    }
                </Stack>
            </DialogContent>
            <DialogActions>
              <Stack direction='row' spacing={1}>
                <Button onClick={onClickNew}>NEW</Button>
                <Button onClick={onClickSave} disabled={selectedCluster?.source || name==='' || url==='' || accessKey==='' }>SAVE</Button>
                <Button onClick={onClickTest} disabled={!url || !url.toLocaleLowerCase().startsWith('http') || !accessKey}>TEST</Button>
                <Button onClick={onClickDelete} disabled={selectedCluster===undefined || selectedCluster?.source}>DELETE</Button>
              </Stack>
              <Typography sx={{flexGrow:1}}></Typography>
              <Button onClick={() => props.onClose(clusters)}>CLOSE</Button>
            </DialogActions>
        </Dialog>
        {msgBox}
    </>)
}

export default ManageClusters