import React, { useContext, useState } from 'react'
import { Button, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, SxProps, Typography } from '@mui/material'
import { Cluster } from '../model/Cluster'
import { SessionContext, SessionContextType } from '../model/SessionContext'
import { MsgBoxOkError } from '../tools/MsgBox'

// app icons 
import IconDaemonSet from'../icons/svg/ds.svg'
import IconReplicaSet from'../icons/svg/rs.svg'
import IconStatefulSet from'../icons/svg/ss.svg'
import { addGetAuthorization } from '../tools/AuthorizationManagement'
import { ServiceConfigChannelEnum } from '@jfvilas/kwirth-common'
const KIconDaemonSet = () => <img src={IconDaemonSet} alt='ds' height={'16px'}/>
const KIconReplicaSet = () => <img src={IconReplicaSet} alt='rs' height={'16px'}/>
const KIconStatefulSet = () => <img src={IconStatefulSet} alt='ss' height={'16px'}/>

interface IResourceSelected {
    channel:string
    clusterName:string
    view:string
    namespace:string
    group:string
    pod:string
    container:string
    suggestedName:string
}

interface IProps {
    onAdd:(resource:IResourceSelected) => {}
    clusters:Cluster[]
    sx:SxProps
}

interface GroupData {
    // these names match with the ones returned in the "/config/groups" fetch.
    type:string,  // rs, ds, ss
    name:string
}

const ResourceSelector: React.FC<any> = (props:IProps) => {
    const {user} = useContext(SessionContext) as SessionContextType
    const [selectedCluster, setSelectedCluster] = useState<Cluster>(new Cluster())
    const [view, setView] = useState('')
    const [namespace, setNamespace] = useState('')
    const [allNamespaces, setAllNamespaces] = useState<string[]>([])
    const [group, setGroup] = useState<string>('')
    const [allGroups, setAllGroups] = useState<GroupData[]>([])
    const [pod, setPod] = useState('')
    const [pods, setPods] = useState<string[]>([])
    const [container, setContainer] = useState('')
    const [containers, setContainers] = useState<string[]>([])
    const [channel, setChannel] = useState('')
    const [msgBox, setMsgBox] =useState(<></>)

    const getNamespaces = async (cluster:Cluster) => {
        if (cluster) {
            var response = await fetch(`${cluster.url}/config/namespace?cluster=${cluster.name}`, addGetAuthorization(cluster!.accessString))
            if (response.status!==200) {
                setMsgBox(MsgBoxOkError('Resource Selector',`Error accessing cluster: ${JSON.stringify(response.status)}`, setMsgBox))
            }
            else {
                var data = await response.json()
                if (user?.namespace!=='') data=(data as string[]).filter(ns => user?.namespace.includes(ns))
                setAllNamespaces(data)
            }
        }
    }
    
    const getGroups = async (cluster:Cluster,namespace:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/groups?cluster=${cluster.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json() as GroupData[]
        setAllGroups(data)
        setGroup('')
    }

    const getPods = async (namespace:string, group:GroupData) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${group.name}/pods?type=${group.type}&cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        setPods(data)
    }

    const getContainers = async (namespace:string,pod:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/containers?cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        setContainers(data)
    }
        
    const onChangeCluster = (event: SelectChangeEvent) => {
        var value=event.target.value
        setSelectedCluster(props.clusters?.find(c => c.name===value)!)
        setView('')
        setNamespace('')
        setAllNamespaces([])
        setGroup('')
        setAllGroups([])
        setPod('')
        setContainer('')
    };

    const onChangeView = (event: SelectChangeEvent) => {
        var value=event.target.value
        setView(value)
        setNamespace('')
        setGroup('')
        setAllGroups([])
        setPod('')
        setContainer('')
        getNamespaces(props.clusters?.find(c => c.name===selectedCluster.name)!)
    };

    const onChangeNamespace = (event:SelectChangeEvent) => {
        var ns=event.target.value;
        setNamespace(ns)
        setGroup('')
        setAllGroups([])
        setPod('')
        setContainer('')
        if (view!=='namespace') getGroups(selectedCluster, ns)
    }

    const onChangeGroup = (event:SelectChangeEvent) => {
        var groupName=event.target.value
        setGroup(groupName)
        setPod('')
        setContainer('')
        var groupData=allGroups.find(g => g.name===groupName)!
        if (view!=='group') getPods(namespace,groupData)
    }

    const onChangePod= (event: SelectChangeEvent) => {
        setPod(event.target.value)    
        if (view==='container') {
            setContainer('')
            getContainers(namespace, event.target.value)
        }
    }

    const onChangeContainer = (event: SelectChangeEvent) => {
        setContainer(event.target.value)
    }

    const onChangeChannel = (event: SelectChangeEvent) => {
        setChannel(event.target.value)
    }

    const onAdd = () => {
        var g:GroupData=allGroups.find(g => g.name===group)!
        var selection:IResourceSelected={
            channel,
            clusterName: selectedCluster?.name,
            view,
            namespace,
            group: g? (g.type+'+'+g.name) : '',
            pod,
            container,
            suggestedName: ''
        }

        if (view==='namespace')
            selection.suggestedName=namespace
        else if (view==='group')
            selection.suggestedName=namespace+'-'+g.name
        else if (view==='pod')
            selection.suggestedName=namespace+'-'+pod
        else if (view==='container')
            selection.suggestedName=namespace+'-'+pod+'-'+container
        props.onAdd(selection)
    }

    const addable = () => {
        if (selectedCluster===undefined) return false
        if (channel==='') return false
        if (view==='') return false
        if (namespace==='') return false
        if (view==='namespace') return true
        if (group==='') return false
        if (view==='group') return true
        if (pod==='') return false
        if (view==='pod') return true
        if (container==='') return false
        return true
    }

    return (<>
        <Stack direction='row' spacing={1} sx={{...props.sx}} alignItems='baseline'>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }}>
                <InputLabel id='cluster'>Cluster</InputLabel>
                <Select labelId='cluster' value={selectedCluster?.name} onChange={onChangeCluster}>
                { props.clusters?.map( (value) => {
                    return <MenuItem key={value.name} value={value.name}>{value.name}</MenuItem>
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={selectedCluster.name===''}>
                <InputLabel id='view'>View</InputLabel>
                <Select labelId='view' value={view} onChange={onChangeView} >
                { ['namespace','group','pod','container'].map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={view===''}>
                <InputLabel id='namespace'>Namespace</InputLabel>
                <Select labelId='namespace' onChange={onChangeNamespace} value={namespace}>
                { allNamespaces && allNamespaces.map( (namespace:string) => {
                    return <MenuItem key={namespace} value={namespace}><Typography>{namespace}</Typography></MenuItem>
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={namespace==='' || view==='namespace'}>
                <InputLabel id='group'>Group</InputLabel>
                <Select labelId='group' onChange={onChangeGroup} value={group}>
                { allGroups && allGroups.map( (value:GroupData) => 
                    <MenuItem key={value.name} value={value.name} sx={{alignContent:'center'}}>
                        {value.type==='replica'? <KIconReplicaSet/>:value.type==='daemon'?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.name}
                    </MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={group==='' || view==='namespace' || view==='group'}>
                <InputLabel id='pod'>Pod</InputLabel>
                <Select labelId='pod' value={pod} onChange={onChangePod}>
                { pods.map( (podName:string) =>
                    <MenuItem key={podName} value={podName}>{podName}</MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={pod==='' || view==='namespace' || view==='group' || view==='pod'}>
                <InputLabel id='container'>Container</InputLabel>
                <Select labelId='container' value={container} onChange={onChangeContainer}>
                { containers.map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }}>
                <InputLabel id='channel'>Channel</InputLabel>
                <Select labelId='channel' value={channel} onChange={onChangeChannel}>
                    <MenuItem key={'LOG'} value={ServiceConfigChannelEnum.LOG}>Log</MenuItem>
                    <MenuItem key={'METRICS'} value={ServiceConfigChannelEnum.METRICS}>Metrics</MenuItem>
                    <MenuItem key={'ALARM'} value={ServiceConfigChannelEnum.ALARM}>Alarm</MenuItem>
                </Select>
            </FormControl>

            <Button onClick={onAdd} sx={{ width:'4%'}} disabled={!addable()}>ADD</Button>
        </Stack>
        { msgBox }
    </>)
}

export { ResourceSelector }
export type { IResourceSelected }
