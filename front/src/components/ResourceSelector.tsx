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
  const [pod, setPod] = useState('');
  const [pods, setPods] = useState<string[]>([]);
  const [container, setContainer] = useState('');
  const [containers, setContainers] = useState<string[]>([]);

  const [podSelectDisabled, setPodSelectDisabled] = useState(true);
  const [containerSelectDisabled, setContainerSelectDisabled] = useState(true);

  const getNamespaces = async () => {
      var response = await fetch(`${selectedCluster!.url}/config/namespace?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
      var data = await response.json();
      setNamespaces(data);
  }
  
  const getPods = async (namespace:string) => {
      var response = await fetch(`${selectedCluster!.url}/config/${namespace}/deployment?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
      var data = await response.json();
      setPods(data);
  }
    
  const getContainers = async (namespace:string,pod:string) => {
    var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/container?cluster=${selectedClusterName}`,{headers:{'Authorization':selectedCluster!.apiKey}});
    var data = await response.json();
    setContainers(data);
  }
    
  const onChangeCluster = (event: SelectChangeEvent) => {
        var value=event.target.value;
        setSelectedClusterName(value);
        setSelectedCluster(props.clusters?.filter(c => c.name===value)[0]!);
        setScope('cluster');
        setNamespace('');
        setNamespaceSelectDisabled(true);
        setPod('');
        setPodSelectDisabled(true);
  };
    
  const onChangeScope = (event: SelectChangeEvent) => {
    var value=event.target.value;
    setScope(value);
    if (value!=='cluster') getNamespaces();
    switch (value) {
      case 'cluster':
        setNamespaceSelectDisabled(true);
        setPodSelectDisabled(true);
        setNamespace('');
        break;
      case 'namespace':
        setNamespaceSelectDisabled(false);
        setPod('');
        setPodSelectDisabled(true);
        break;
      case 'deployment':
        setNamespaceSelectDisabled(false);
        setPodSelectDisabled(false);
        break;
    }
  };

  const onChangeNamespace = (event: SelectChangeEvent) => {
    setNamespace(event.target.value);
    setPod('');
    if (scope==='deployment') getPods(event.target.value);
  };

  const onChangePod= (event: SelectChangeEvent) => {
    setPod(event.target.value)    
    setContainer('');
    getContainers(namespace, event.target.value);
  }

  const onChangeContainer = (event: SelectChangeEvent) => {
    setContainer(event.target.value)    
  }

  const onAdd = () => {
        var selection:any={};
        selection.clusterName=selectedClusterName;
        selection.scope=scope;
        selection.namespace=namespace;
        selection.resource=pod;
        props.onAdd(selection);
  }

  const selector = (<>
    <Stack direction='row' spacing={1} sx={{...props.sx}} alignItems='baseline'>
      <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'19%' }}>
        <InputLabel id='cluster'>Cluster</InputLabel>
        <Select labelId='cluster' value={selectedClusterName} onChange={onChangeCluster}>
          { props.clusters?.map( (value) => {
              return <MenuItem key={value.name} value={value.name}>{value.name}</MenuItem>
          })}
        </Select>
      </FormControl>
      <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'19%' }} disabled={selectedClusterName===''}>
        <InputLabel id='scope'>Scope</InputLabel>
        <Select labelId='scope' value={scope} onChange={onChangeScope} >
          { ['cluster','namespace','deployment'].map( (value:string) => {
              return <MenuItem key={value} value={value}>{value}</MenuItem>
          })}
        </Select>
      </FormControl>
      <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'19%' }} disabled={namespaceSelectDisabled}>
        <InputLabel id='namespace'>Namespace</InputLabel>
        <Select labelId='namespace' value={namespace} onChange={onChangeNamespace}>
          { namespaces.map( (value:string) => {
              return <MenuItem key={value} value={value}>{value}</MenuItem>
          })}
        </Select>
      </FormControl>
      <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'19%' }} disabled={podSelectDisabled}>
        <InputLabel id='pod'>Pod</InputLabel>
        <Select labelId='pos' value={pod} onChange={onChangePod}>
          { pods.map( (value:any) =>
            <MenuItem key={value.name} value={value.name}>
              {value.type==='replica'? <KIconReplicaSet/>:value.type==='daemon'?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.name}
            </MenuItem>
          )}
        </Select>
      </FormControl>
      <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'19%' }} disabled={containerSelectDisabled}>
        <InputLabel id='container'>Container</InputLabel>
        <Select labelId='container' value={container} onChange={onChangeContainer}>
          { containers.map( (value:string) => {
              return <MenuItem key={value} value={value}>{value}</MenuItem>
          })}
        </Select>
      </FormControl>
      <Button onClick={onAdd} sx={{ width:'5%'}}>ADD</Button>
    </Stack>
  </>);

  return selector;
};

export default ResourceSelector;