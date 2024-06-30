import React, { useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, ListItemButton, Stack, TextField, Typography} from '@mui/material';
import { Cluster } from '../model/Cluster';
import { MsgBoxButtons, MsgBoxYesNo } from '../tools/MsgBox';

interface IProps {
  onClose:(clusters:Cluster[]) => {};
  clusters:Cluster[];
}

const ManageClusters: React.FC<any> = (props:IProps) => {
  const [clusters, setClusters] = useState<Cluster[]>(props.clusters);
  const [selectedCluster, setSelectedCluster] = useState<Cluster|null>();
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [msgBox, setMsgBox] =useState(<></>);

  const onClusterSelected = (idSelected:string|null) => {
    var cluster=clusters?.find(k => k.id===idSelected);
    setSelectedCluster(cluster);
    setName(cluster?.name!);
    setUrl(cluster?.url!);
    setApiKey(cluster?.apiKey!);
  }

  const onClickSave= async () => {
    if (selectedCluster) {
      selectedCluster.apiKey=apiKey;
      selectedCluster.name=name;
      selectedCluster.url=url;
      clusters.splice(clusters?.findIndex(c => c.id===selectedCluster.id)!,1);
      clusters?.push(selectedCluster);
    }
    else {
      var c=new Cluster();
      c.apiKey=apiKey;
      c.name=name;
      c.url=url;
      clusters?.push(c);
    }
    setName('');
    setUrl('');
    setApiKey('');
    setClusters(clusters);
  }

  const onClickNew= () => {
    setSelectedCluster(undefined);
    setName('');
    setUrl('');
    setApiKey('');
  }

  const onClickDelete= () => {
    setMsgBox(MsgBoxYesNo('Delete API Key',`Are you sure you want to delete API Key ${selectedCluster?.name}?`, setMsgBox, (a:MsgBoxButtons)=> a===MsgBoxButtons.Yes? onConfirmDelete() : {}));
  }

  const onConfirmDelete= async () => {
    if (selectedCluster) {
      clusters.splice(clusters?.findIndex(c => c.id===selectedCluster.id)!,1);
      setName('');
      setUrl('');
      setApiKey('');
      setSelectedCluster(undefined);
    }
  }

  return (<>
    <Dialog open={true} fullWidth maxWidth='md'>
      <DialogTitle>Manage clusters</DialogTitle>
      <DialogContent>
        <Stack sx={{ display: 'flex', flexDirection: 'row' }}>
          <List sx={{flexGrow:1, mr:2, width:'50vh' }}>
            { clusters?.map(c => <ListItemButton key={c.id} onClick={() => onClusterSelected(c.id)}><ListItem>{c.name}</ListItem></ListItemButton>)}
          </List>
          { <>
            <Stack sx={{width:'50vh'}} spacing={1}>
              <TextField value={name} onChange={(e) => setName(e.target.value)} disabled={selectedCluster?.source} variant='standard' label='Name'></TextField>
              <TextField value={url} onChange={(e) => setUrl(e.target.value)} disabled={selectedCluster?.source}variant='standard' label='URL'></TextField>
              <TextField value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={selectedCluster?.source} variant='standard' label='API Key'></TextField>
            </Stack>
          </>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Stack direction='row' spacing={1}>
          <Button onClick={onClickNew}>NEW</Button>
          <Button onClick={onClickSave} disabled={selectedCluster?.source}>SAVE</Button>
          <Button onClick={onClickDelete} disabled={selectedCluster===undefined || selectedCluster?.source}>DELETE</Button>
        </Stack>
        <Typography sx={{flexGrow:1}}></Typography>
        <Button onClick={() => props.onClose(clusters)}>CLOSE</Button>
      </DialogActions>
    </Dialog>
    {msgBox}
  </>);
};

export default ManageClusters;