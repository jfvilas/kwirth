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

interface ResourceSet {
    // these names match with the ones returned in the "/config/sets" fetch.
    type:string  // rs, ds, ss
    name:string,
}

const ResourceSelector: React.FC<any> = (props:IProps) => {
    const [scope, setScope] = useState('cluster');
    const [selectedCluster, setSelectedCluster] = useState<Cluster>();
    const [selectedClusterName, setSelectedClusterName] = useState('');
    const [namespace, setNamespace] = useState('');
    const [namespaces, setNamespaces] = useState<string[]>([]);
    const [namespaceSelectDisabled, setNamespaceSelectDisabled] = useState(true);
    const [set, setSet] = useState<ResourceSet>();
    const [sets, setSets] = useState<(ResourceSet)[]>([]);
    const [setSelectDisabled, setSetSelectDisabled] = useState(true);
    const [pod, setPod] = useState('');
    const [pods, setPods] = useState<string[]>([]);
    const [podSelectDisabled, setPodSelectDisabled] = useState(true);
    const [container, setContainer] = useState('');
    const [containers, setContainers] = useState<string[]>([]);
    const [containerSelectDisabled, setContainerSelectDisabled] = useState(true);

    const getNamespaces = async () => {
        console.log(selectedCluster);
        var response = await fetch(`${selectedCluster!.url}/config/namespace?cluster=${selectedClusterName}`,{headers:{'Authorization':'Bearer '+selectedCluster!.accessKey}});
        var data = await response.json();
        setNamespaces(data);
    }
    
    const getSets = async (namespace:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/sets?cluster=${selectedClusterName}`,{headers:{'Authorization':'Bearer '+selectedCluster!.accessKey}});
        var data = await response.json();
        setSets(data);
    }
    
    const getPods = async (namespace:string, set:ResourceSet) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${set.name}/pods?type=${set.type}&cluster=${selectedClusterName}`,{headers:{'Authorization':'Bearer '+selectedCluster!.accessKey}});
        var data = await response.json();
        setPods(data);
        setPodSelectDisabled(false);
    }

    const getContainers = async (namespace:string,pod:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/containers?cluster=${selectedClusterName}`,{headers:{'Authorization':'Bearer '+selectedCluster!.accessKey}});
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
        setSet(undefined);
        setSetSelectDisabled(true);
        setPod('');
        setPodSelectDisabled(true);
        setContainer('');
        setContainerSelectDisabled(true);
    };
        
    const onChangeScope = (event: SelectChangeEvent) => {
        var value=event.target.value;
        setScope(value);
        if (value==='cluster') {
            setNamespace('');
            setNamespaceSelectDisabled(true);
        }
        else {
            setNamespace('');
            getNamespaces();
            setNamespaceSelectDisabled(false);
        }
        setPod('');
        setPodSelectDisabled(true);
        setSet(undefined);
        setSetSelectDisabled(true);
        setContainer('');
        setContainerSelectDisabled(true);
    };

    const onChangeNamespace = (event: SelectChangeEvent) => {
        setNamespace(event.target.value);
        setPod('');
        if (scope!=='cluster' && scope!=='namespace') {
            setSet(undefined);
            getSets(event.target.value);
            setSetSelectDisabled(false);
        }
    };

    const onChangeSet = (event: SelectChangeEvent) => {
        var selectedSet=sets.find(s => s.name===event.target.value);
        setSet(selectedSet);
        if (scope==='pod' || scope==='container') {
            getPods(namespace,selectedSet!);
            setPodSelectDisabled(false);
        }
    }

    const onChangePod= (event: SelectChangeEvent) => {
        setPod(event.target.value)    
        if (scope==='container') {
            setContainer('');
            setContainerSelectDisabled(false);
            getContainers(namespace, event.target.value);
        }
    }

    const onChangeContainer = (event: SelectChangeEvent) => {
        setContainer(event.target.value)    
    }

    const onAdd = () => {
        var selection:any={};
        selection.clusterName=selectedClusterName;
        selection.scope=scope;
        selection.namespace=namespace;
        selection.set=set? (set.type+'+'+set?.name) : undefined;
        selection.pod=pod;
        selection.container=container;

        var logName='cluster';
        if (scope==='namespace')
            logName=namespace;
        else if (scope==='set')
            logName=namespace+'-'+set?.name;
        else if (scope==='pod')
            logName=namespace+'-'+pod;
        else if (scope==='container')
            logName=namespace+'-'+pod+'-'+container;
        selection.logName=logName;

        props.onAdd(selection);
    }

    const selector = (<>
        <Stack direction='row' spacing={1} sx={{...props.sx}} alignItems='baseline'>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }}>
                <InputLabel id='cluster'>Cluster</InputLabel>
                <Select labelId='cluster' value={selectedClusterName} onChange={onChangeCluster}>
                { props.clusters?.map( (value) => {
                    return <MenuItem key={value.name} value={value.name}>{value.name}</MenuItem>
                })}
                </Select>
            </FormControl>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }} disabled={selectedClusterName===''}>
                <InputLabel id='scope'>Scope</InputLabel>
                <Select labelId='scope' value={scope} onChange={onChangeScope} >
                { ['cluster','namespace','set','pod','container'].map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }} disabled={namespaceSelectDisabled}>
                <InputLabel id='namespace'>Namespace</InputLabel>
                <Select labelId='namespace' value={namespace} onChange={onChangeNamespace}>
                { namespaces.map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }} disabled={setSelectDisabled}>
                <InputLabel id='set'>Set</InputLabel>
                <Select labelId='set' value={set?.name?set.name:''} onChange={onChangeSet}>
                { sets.map( (value:ResourceSet) => 
                    <MenuItem key={value.name} value={value.name}>
                    {value.type==='replica'? <KIconReplicaSet/>:value.type==='daemon'?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.name}
                    </MenuItem>
                )}
                </Select>
            </FormControl>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }} disabled={podSelectDisabled}>
                <InputLabel id='pod'>Pod</InputLabel>
                <Select labelId='pos' value={pod} onChange={onChangePod}>
                { pods.map( (value:string) =>
                    <MenuItem key={value} value={value}>{value}</MenuItem>
                )}
                </Select>
            </FormControl>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 150, width:'16%' }} disabled={containerSelectDisabled}>
                <InputLabel id='container'>Container</InputLabel>
                <Select labelId='container' value={container} onChange={onChangeContainer}>
                { containers.map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl>
            <Button onClick={onAdd} sx={{ width:'4%'}}>ADD</Button>
        </Stack>
    </>);

    return selector;
};

export default ResourceSelector;