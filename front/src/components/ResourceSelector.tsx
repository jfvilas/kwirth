import React, { useState } from 'react';
import { Box, Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack } from "@mui/material"
import { Cluster } from '../model/Cluster';

// app icons 
import IconDaemonSetPng from'../icons/ds.png';
import IconReplicaSetPng from'../icons/rs.png';
import IconStatefulSetPng from'../icons/ss.png';
const KIconReplicaSet = () => <Box component="img" sx={{ height: 16, width: 16 }} src={IconReplicaSetPng}/>;
const KIconDaemonSet = () => <Box component="img" sx={{ height: 16, width: 16 }} src={IconDaemonSetPng}/>;
const KIconStatefulSet = () => <Box component="img" sx={{ height: 16, width: 16 }} src={IconStatefulSetPng}/>;

interface IProps {
    onAdd:(resource:any) => {};
    clusters:Cluster[];
    sx:any;
}
  
const ResourceSelector: React.FC<any> = (props:IProps) => {
    const [scope, setScope] = useState('cluster');
    const [selectedCluster, setSelectedCluster] = useState<Cluster>();
    const [selectedClusterName, setSelectedClusterName] = useState('');
    const [namespace, setNamespace] = useState('');
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [namespaceSelectDisabled, setNamespaceSelectDisabled] = useState(true);
    const [resource, setResource] = useState('');
    const [resources, setResources] = useState<string[]>([]);
  
    const [resourceSelectDisabled, setResourceSelectDisabled] = useState(true);
  
    const getNamespaces = async () => {
        var response = await fetch(`${selectedCluster!.url}/config/namespace?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
        var data = await response.json();
        setNamespaces(data);
    }
    
    const getResources = async (namespace:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${scope}?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
        var data = await response.json();
        setResources(data);
    }
      
    const onChangeCluster = (event: SelectChangeEvent) => {
        var value=event.target.value;
        setSelectedClusterName(value);
        setSelectedCluster(props.clusters?.filter(c => c.name===value)[0]!);
        setScope('cluster');
        setNamespace('');
        setNamespaceSelectDisabled(true);
        setResource('');
        setResourceSelectDisabled(true);
    };
    
    
    const onChangeScope = (event: SelectChangeEvent) => {
        var value=event.target.value;
        setScope(value);
        if (value!=='cluster') getNamespaces();
        switch (value) {
          case 'cluster':
            setNamespaceSelectDisabled(true);
            setResourceSelectDisabled(true);
            setNamespace('');
            break;
          case 'namespace':
            setNamespaceSelectDisabled(false);
            setResource('');
            setResourceSelectDisabled(true);
            break;
          case 'deployment':
            setNamespaceSelectDisabled(false);
            setResourceSelectDisabled(false);
            break;
          }
    };

    const onChangeNamespace = (event: SelectChangeEvent) => {
        setNamespace(event.target.value);
        if (scope==='deployment') getResources(event.target.value);
    };

    const onChangeResource= (event: SelectChangeEvent) => {
        setResource(event.target.value)    
    }

    const onAdd = () => {
        var selection:any={};
        selection.clusterName=selectedClusterName;
        selection.scope=scope;
        selection.namespace=namespace;
        selection.resource=resource;
        props.onAdd(selection);
    }

    const selector = (<>
      <Stack direction='row' spacing={1} sx={{...props.sx}} alignItems='baseline'>
        <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'24%' }}>
          <InputLabel id='cluster'>Cluster</InputLabel>
          <Select labelId='cluster' value={selectedClusterName} onChange={onChangeCluster}>
            { props.clusters?.map( (value) => {
                return <MenuItem key={value.name} value={value.name}>{value.name}</MenuItem>
            })}
          </Select>
        </FormControl>
        <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'24%' }} disabled={selectedClusterName===''}>
          <InputLabel id='scope'>Scope</InputLabel>
          <Select labelId='scope' value={scope} onChange={onChangeScope} >
            { ['cluster','namespace','deployment'].map( (value:string) => {
                return <MenuItem key={value} value={value}>{value}</MenuItem>
            })}
          </Select>
        </FormControl>
        <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'24%' }} disabled={namespaceSelectDisabled}>
          <InputLabel id='namespace'>Namespace</InputLabel>
          <Select labelId='namespace' value={namespace} onChange={onChangeNamespace}>
            { namespaces.map( (value:string) => {
                return <MenuItem key={value} value={value}>{value}</MenuItem>
            })}
          </Select>
        </FormControl>
        <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'24%' }} disabled={resourceSelectDisabled}>
          <InputLabel id='obj'>Object</InputLabel>
          <Select labelId='obj' value={resource} onChange={onChangeResource}>
            { resources.map( (value:any) =>
              <MenuItem key={value.name} value={value.name}>
                {value.type==='replica'? <KIconReplicaSet/>:value.type==='daemon'?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.name}
              </MenuItem>
            )}
          </Select>
        </FormControl>
        <Button variant='contained' onClick={onAdd} sx={{ width:'4%'}}>ADD</Button>
      </Stack>
    </>);

    return selector;
};

export default ResourceSelector;