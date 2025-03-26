import React, { useContext, useState } from 'react'
import { Button, Checkbox, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, SxProps, Typography } from '@mui/material'
import { Cluster } from '../model/Cluster'
import { SessionContext, SessionContextType } from '../model/SessionContext'
import { MsgBoxOkError } from '../tools/MsgBox'

// app icons 
import IconDaemonSet from'../icons/svg/ds.svg'
import IconReplicaSet from'../icons/svg/rs.svg'
import IconStatefulSet from'../icons/svg/ss.svg'
import { addGetAuthorization } from '../tools/AuthorizationManagement'
const KIconDaemonSet = () => <img src={IconDaemonSet} alt='ds' height={'16px'}/>
const KIconReplicaSet = () => <img src={IconReplicaSet} alt='rs' height={'16px'}/>
const KIconStatefulSet = () => <img src={IconStatefulSet} alt='ss' height={'16px'}/>

interface IResourceSelected {
    channel:string
    clusterName:string
    view:string
    namespaces:string[]
    groups:string[]
    pods:string[]
    containers:string[]
    suggestedName:string
}

interface IProps {
    onAdd:(resource:IResourceSelected) => {}
    onChangeCluster:(clusterName:string) => {}
    clusters:Cluster[]
    channels:string[]
    sx:SxProps
}

interface GroupData {
    // these names match with the ones returned in the "/config/groups" fetch.
    type:string,  // rs, ds, ss
    name:string
}

const ResourceSelector: React.FC<any> = (props:IProps) => {
    const supportedChannels = ['log','metrics','alert'].filter(c => (props.channels || []).includes(c));
    const {user} = useContext(SessionContext) as SessionContextType
    const [selectedCluster, setSelectedCluster] = useState<Cluster>(new Cluster())
    const [view, setView] = useState('')
    const [allNamespaces, setAllNamespaces] = useState<string[]>([])
    const [namespaces, setNamespaces] = useState<string[]>([])
    const [allGroups, setAllGroups] = useState<string[]>([])
    const [groups, setGroups] = useState<string[]>([])
    const [allPods, setAllPods] = useState<string[]>([])
    const [pods, setPods] = useState<string[]>([])
    const [allContainers, setAllContainers] = useState<string[]>([])
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

    const loadAllGroups = async (cluster:Cluster,namespace:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/groups?cluster=${cluster.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json() as GroupData[]
        setAllGroups((prev) => [...prev, ...data.map(d => d.type+'+'+d.name)])
        setGroups([])
    }

    const loadAllPods = async (namespace:string, group:string) => {
        var [gtype,gname] = group.split('+')
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${gname}/pods?type=${gtype}&cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        setAllPods((prev) => [...prev, ...data])
    }

    const loadAllContainers = async (namespace:string,pod:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/containers?cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        setAllContainers((prev) => [...prev, ...(data as string[]).map(c => pod+'+'+c)])
    }

    const onChangeCluster = (event: SelectChangeEvent) => {
        var value=event.target.value
        setSelectedCluster(props.clusters?.find(c => c.name===value)!)
        setView('')
        setAllNamespaces([])
        setNamespaces([])
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
        if (props.onChangeCluster !== undefined) props.onChangeCluster(value)
    }

    const onChangeView = (event: SelectChangeEvent) => {
        var value=event.target.value
        setView(value)
        setNamespaces([])
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
        getNamespaces(props.clusters?.find(c => c.name===selectedCluster.name)!)
    }

    const onChangeNamespaces = (event: SelectChangeEvent<typeof namespaces>) => {
        var nss  = event.target.value as string[]
        setNamespaces(nss)
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
        if (view!=='namespace') nss.map (ns => loadAllGroups(selectedCluster, ns))
    }

    const onChangeGroup = (event: SelectChangeEvent<typeof groups>) => {
        var gs  = event.target.value as string[]
        setGroups(gs)
        setAllPods([])
        setPods([])
        setAllContainers([])
        setContainers([])
        if (view!=='group') namespaces.map(ns => gs.map(g => loadAllPods(ns,g)))
    }
    const onChangePod= (event: SelectChangeEvent<typeof pods>) => {
        var pods  = event.target.value as string[]
        setPods(pods)
        setAllContainers([])
        setContainers([])
        if (view === 'container') namespaces.map(ns => pods.map (pod => loadAllContainers(ns,pod)))
    }

    const onChangeContainer = (event: SelectChangeEvent<typeof containers>) => {
        var cs  = event.target.value as string[]
        setContainers(cs)
    }

    const onChangeChannel = (event: SelectChangeEvent) => {
        setChannel(event.target.value)
    }

    const onAdd = () => {
        var selection:IResourceSelected={
            channel,
            clusterName: selectedCluster?.name,
            view,
            namespaces,
            groups,
            pods,
            containers,
            suggestedName: ''
        }

        if (view==='namespace')
            selection.suggestedName=namespaces.join('+')
        else if (view==='group')
            selection.suggestedName=namespaces.join('+')+'-'+groups.join('+')
        else if (view==='pod')
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')
        else if (view==='container')
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')+'-'+containers.join(',')
        props.onAdd(selection)
    }

    const addable = () => {
        if (selectedCluster===undefined) return false
        if (channel==='') return false
        if (view==='') return false
        if (namespaces.length === 0) return false
        if (view==='namespace') return true
        if (groups.length === 0) return false
        if (view==='group') return true
        if (pods.length === 0) return false
        if (view==='pod') return true
        if (containers.length === 0) return false
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
                <Select labelId='namespace' onChange={onChangeNamespaces} multiple value={namespaces} renderValue={(selected) => selected.join(', ')}>
                { allNamespaces && allNamespaces.map( (namespace:string) => {
                    return (
                        <MenuItem key={namespace} value={namespace}>
                            <Checkbox checked={namespaces.includes(namespace)} />
                            <Typography>{namespace}</Typography>
                        </MenuItem>
                    )
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={namespaces.length===0 || view==='namespace'}>
                <InputLabel id='group'>Group</InputLabel>
                <Select labelId='group' onChange={onChangeGroup} value={groups} multiple renderValue={(selected) => selected.join(', ')}>
                { allGroups && allGroups.map( (value) => 
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={groups.includes (value)} />
                        {value.startsWith('replica')? <KIconReplicaSet/>:value.startsWith('daemon')?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.split('+')[1]}
                    </MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={groups.length === 0 || view==='namespace' || view==='group'}>
                <InputLabel id='pod'>Pod</InputLabel>
                <Select labelId='pod' value={pods} onChange={onChangePod} multiple renderValue={(selected) => selected.join(', ')}>
                { allPods && allPods.map( (value:string) =>
                    // <MenuItem key={podName} value={podName}>{podName}</MenuItem>
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={pods.includes (value)} />
                        {value}
                    </MenuItem>

                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={pods.length === 0 || view==='namespace' || view==='group' || view==='pod'}>
                <InputLabel id='container'>Container</InputLabel>
                <Select labelId='container' value={containers} onChange={onChangeContainer} multiple renderValue={(selected) => selected.join(', ')}>
                { allContainers && allContainers.map( (value:string) => 
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={containers.includes(value)} />{value}
                    </MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }}>
                <InputLabel id='channel'>Channel</InputLabel>
                <Select labelId='channel' value={channel} onChange={onChangeChannel}>
                    {
                        supportedChannels.map(c => <MenuItem key={c} value={c}>{c}</MenuItem> )
                    }
                </Select>
            </FormControl>

            <Button onClick={onAdd} sx={{ width:'4%'}} disabled={!addable()}>ADD</Button>
        </Stack>
        { msgBox }
    </>)
}

export { ResourceSelector }
export type { IResourceSelected }
