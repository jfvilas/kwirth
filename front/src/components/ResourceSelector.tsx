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
import { ServiceConfigChannelEnum } from '@jfvilas/kwirth-common'
const KIconDaemonSet = () => <img src={IconDaemonSet} alt='ds' height={'16px'}/>
const KIconReplicaSet = () => <img src={IconReplicaSet} alt='rs' height={'16px'}/>
const KIconStatefulSet = () => <img src={IconStatefulSet} alt='ss' height={'16px'}/>

interface IResourceSelected {
    channel:string
    clusterName:string
    view:string
    //namespace:string
    namespaces:string[]
    //group:string
    groups:string[]
    pods:string[]
    containers:string[]
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
    //const [namespace, setNamespace] = useState('')
    const [allNamespaces, setAllNamespaces] = useState<string[]>([])
    const [namespaces, setNamespaces] = useState<string[]>([])
    // const [allGroups, setAllGroups] = useState<GroupData[]>([])
    //const [group, setGroup] = useState<string>('')
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

    // +++ implementar multiselect en group, pods y containers

    // const getGroups = async (cluster:Cluster,namespace:string) => {
    //     var response = await fetch(`${selectedCluster!.url}/config/${namespace}/groups?cluster=${cluster.name}`, addGetAuthorization(selectedCluster!.accessString))
    //     var data = await response.json() as GroupData[]
    //     setAllGroups(data)
    //     setGroup('')
    // }

    const loadAllGroups = async (cluster:Cluster,namespace:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/groups?cluster=${cluster.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json() as GroupData[]
        console.log(namespace)
        //setAllGroups((prev) => [...prev, ...data])
        setAllGroups((prev) => [...prev, ...data.map(d => d.type+'+'+d.name)])
        console.log(data)
        //setGroup('')
        setGroups([])
    }

    // const getPods = async (namespace:string, group:GroupData) => {
    //     var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${group.name}/pods?type=${group.type}&cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
    //     var data = await response.json()
    //     setPods(data)
    // }

    // const loadPods = async (namespace:string, group:GroupData) => {
    //     var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${group.name}/pods?type=${group.type}&cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
    //     var data = await response.json()
    //     //setPods(data)
    //     setPods([...pods, data])
    // }

    const loadAllPods = async (namespace:string, group:string) => {
        var [gtype,gname] = group.split('+')
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${gname}/pods?type=${gtype}&cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        //setPods(data)
        //setPods([...pods, data])
        setAllPods((prev) => [...prev, ...data])
    }

    // const getContainers = async (namespace:string,pod:string) => {
    //     var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/containers?cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
    //     var data = await response.json()
    //     setContainers(data)
    // }

    const loadAllContainers = async (namespace:string,pod:string) => {
        var response = await fetch(`${selectedCluster!.url}/config/${namespace}/${pod}/containers?cluster=${selectedCluster?.name}`, addGetAuthorization(selectedCluster!.accessString))
        var data = await response.json()
        //setContainers([...containers,data])
        setAllContainers((prev) => [...prev, ...(data as string[]).map(c => pod+'+'+c)])
    }

    const onChangeCluster = (event: SelectChangeEvent) => {
        var value=event.target.value
        setSelectedCluster(props.clusters?.find(c => c.name===value)!)
        setView('')
        //setNamespace('')
        setAllNamespaces([])
        setNamespaces([])
        //setGroup('')
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
    }

    const onChangeView = (event: SelectChangeEvent) => {
        var value=event.target.value
        setView(value)
        //setNamespace('')
        setNamespaces([])
        //setGroup('')
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
        getNamespaces(props.clusters?.find(c => c.name===selectedCluster.name)!)
    }

    // const onChangeNamespace = (event:SelectChangeEvent) => {
    //     var ns=event.target.value;
    //     setNamespace(ns)
    //     setGroup('')
    //     setAllGroups([])
    //     setPod('')
    //     setContainer('')
    //     if (view!=='namespace') getGroups(selectedCluster, ns)
    // }

    const onChangeNamespaces = (event: SelectChangeEvent<typeof namespaces>) => {
        var nss  = event.target.value as string[]
        setNamespaces(nss)
        //setGroup('')
        setAllGroups([])
        setGroups([])
        setPods([])
        setAllContainers([])
        setContainers([])
        if (view!=='namespace') {
            //getGroups(selectedCluster, ns)
            nss.map (ns => loadAllGroups(selectedCluster, ns))
        }
    }

    // const onChangeGroup = (event:SelectChangeEvent) => {
    //     var groupName=event.target.value
    //     setGroup(groupName)
    //     setPod('')
    //     setContainer('')
    //     var groupData=allGroups.find(g => g.name===groupName)!
    //     //if (view!=='group') getPods(namespace,groupData)
    //     if (view!=='group') {
    //         //getPods(namespace,groupData)
    //         namespaces.map ( ns => loadPods(ns, groupData))
    //         //loadPods()
    //     }
    // }

    const onChangeGroup = (event: SelectChangeEvent<typeof groups>) => {
        console.log(event.target.value)
        var gs  = event.target.value as string[]
        setGroups(gs)
        setAllPods([])
        setPods([])
        setAllContainers([])
        setContainers([])
        //var groupData=allGroups.find(g => g.name===groupName)!
        //if (view!=='group') getPods(namespace,groupData)
        if (view!=='group') {
            //getPods(namespace,groupData)
            //namespaces.map ( ns => loadPods(ns, groupData))
            namespaces.map(ns => {
                gs.map(g => loadAllPods(ns,g))
            })
        }
    }
    const onChangePod= (event: SelectChangeEvent<typeof pods>) => {
        console.log(event.target.value)
        var ps  = event.target.value as string[]
        setPods(ps)
        setAllContainers([])
        setContainers([])
        if (view==='container') {
            //setContainer('')
            //getContainers(namespace, event.target.value)
            //namespaces.map(ns => loadContainers(ns, event.target.value))
            namespaces.map(ns => {
                ps.map (p => {
                    loadAllContainers(ns,p)
                })
            })
        }
    }

    // const onChangeContainer = (event: SelectChangeEvent) => {
    //     setContainer(event.target.value)
    // }

    const onChangeContainer = (event: SelectChangeEvent<typeof containers>) => {
        //setContainer(event.target.value)
        console.log(event.target.value)
        var cs  = event.target.value as string[]
        setContainers(cs)
    }

    const onChangeChannel = (event: SelectChangeEvent) => {
        setChannel(event.target.value)
    }

    const onAdd = () => {
        //var g:GroupData=allGroups.find(g => g.name===group)!
        var selection:IResourceSelected={
            channel,
            clusterName: selectedCluster?.name,
            view,
            //namespace,
            namespaces,
            //group: g? (g.type+'+'+g.name) : '',
            groups,
            pods,
            containers,
            suggestedName: ''
        }

        if (view==='namespace')
            //selection.suggestedName=namespace
            selection.suggestedName=namespaces.join('+')
        else if (view==='group')
            //selection.suggestedName=namespace+'-'+g.name
            //selection.suggestedName=namespaces.join('+')+'-'+g.name
            selection.suggestedName=namespaces.join('+')+'-'+groups.join('+')
        else if (view==='pod')
            //selection.suggestedName=namespace+'-'+pod
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')
        else if (view==='container')
            //selection.suggestedName=namespace+'-'+pod+'-'+container
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')+'-'+containers.join(',')
        props.onAdd(selection)
    }

    const addable = () => {
        if (selectedCluster===undefined) return false
        if (channel==='') return false
        if (view==='') return false
        //if (namespace==='') return false
        if (namespaces.length === 0) return false
        if (view==='namespace') return true
        //if (group==='') return false
        if (groups.length === 0) return false
        if (view==='group') return true
        //if (pod==='') return false
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

            {/* <FormControl sx={{ m: 1, width: 300 }}>
                <InputLabel id="demo-multiple-checkbox-label">Tag</InputLabel>
                    <Select labelId="demo-multiple-checkbox-label" id="demo-multiple-checkbox" multiple
                    value={personName}
                    onChange={handleChange}
                    input={<OutlinedInput label="Tag" />}
                    renderValue={(selected) => selected.join(', ')}
                    MenuProps={MenuProps}
                    >
                    {names.map((name) => (
                        <MenuItem key={name} value={name}>
                        <Checkbox checked={personName.includes(name)} />
                        <ListItemText primary={name} />
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl> */}

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

            {/* <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={namespace==='' || view==='namespace'}>
            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={namespaces.length===0 || view==='namespace'}>
                <InputLabel id='group'>Group</InputLabel>
                <Select labelId='group' onChange={onChangeGroup} value={group}>
                { allGroups && allGroups.map( (value:GroupData) => 
                    <MenuItem key={value.name} value={value.name} sx={{alignContent:'center'}}>
                        {value.type==='replica'? <KIconReplicaSet/>:value.type==='daemon'?<KIconDaemonSet/>:<KIconStatefulSet/>}&nbsp;{value.name}
                    </MenuItem>
                )}
                </Select>
            </FormControl> */}

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


            {/* <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={group==='' || view==='namespace' || view==='group'}> */}
            {/* <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={groups.length === 0 || view==='namespace' || view==='group'}>
                <InputLabel id='pod'>Pod</InputLabel>
                <Select labelId='pod' value={pod} onChange={onChangePod}>
                { allPods.map( (podName:string) =>
                    <MenuItem key={podName} value={podName}>{podName}</MenuItem>
                )}
                </Select>
            </FormControl> */}

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

            {/* <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={pods.length === 0 || view==='namespace' || view==='group' || view==='pod'}>
                <InputLabel id='container'>Container</InputLabel>
                <Select labelId='container' value={container} onChange={onChangeContainer}>
                { containers.map( (value:string) => {
                    return <MenuItem key={value} value={value}>{value}</MenuItem>
                })}
                </Select>
            </FormControl> */}

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={pods.length === 0 || view==='namespace' || view==='group' || view==='pod'}>
                <InputLabel id='container'>Container</InputLabel>
                <Select labelId='container' value={containers} onChange={onChangeContainer} multiple renderValue={(selected) => selected.join(', ')}>
                { allContainers && allContainers.map( (value:string) => 
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={containers.includes (value)} />
                        {value}
                    </MenuItem>
                )}
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
