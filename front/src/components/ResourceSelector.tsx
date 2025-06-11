import React, { useState } from 'react'
import { Button, Checkbox, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Stack, SxProps, Typography } from '@mui/material'
import { Cluster } from '../model/Cluster'
import { MsgBoxOkError } from '../tools/MsgBox'

// app icons 
import IconDaemonSet from'../icons/svg/ds.svg'
import IconReplicaSet from'../icons/svg/rs.svg'
import IconStatefulSet from'../icons/svg/ss.svg'
import IconDeployment from'../icons/svg/dp.svg'

import IconKubernetesUnknown from'../icons/svg/k8s-unknown.svg'
import IconKubernetesBlank from'../icons/svg/k8s-blank.svg'
import IconKubernetes from'../icons/svg/k8s.svg'
import IconDocker from'../icons/svg/docker-mark-blue.svg'
import { addGetAuthorization } from '../tools/AuthorizationManagement'
import { ClusterTypeEnum, InstanceConfigViewEnum, InstanceMessageChannelEnum } from '@jfvilas/kwirth-common'

const KIconDaemonSet = () => <img src={IconDaemonSet} alt='ds' height={'16px'}/>
const KIconReplicaSet = () => <img src={IconReplicaSet} alt='rs' height={'16px'}/>
const KIconStatefulSet = () => <img src={IconStatefulSet} alt='ss' height={'16px'}/>
const KIconDeployment = () => <img src={IconDeployment} alt='ss' height={'16px'}/>

const KIconKubernetesUnknown = () => <img src={IconKubernetesUnknown} alt='kubernetes' height={'16px'}/>
const KIconKubernetesBlank = () => <img src={IconKubernetesBlank} alt='kubernetes' height={'16px'}/>
const KIconKubernetes = () => <img src={IconKubernetes} alt='kubernetes' height={'16px'}/>
const KIconDocker = () => <img src={IconDocker} alt='docker' height={'16px'}/>

interface IResourceSelected {
    channel: InstanceMessageChannelEnum
    clusterName: string
    view: string
    namespaces: string[]
    groups: string[]
    pods: string[]
    containers: string[]
    suggestedName: string
}

interface IProps {
    onAdd: (resource:IResourceSelected) => void
    onChangeCluster: (clusterName:string) => void
    clusters: Cluster[]
    channels: string[]
    sx: SxProps
}

interface IGroup {
    // these names match with the ones returned in the "/config/groups" fetch.
    type:string,  // rs, ds, ss
    name:string
}

const ResourceSelector: React.FC<IProps> = (props:IProps) => {
    const [cluster, setCluster] = useState<Cluster>(props.clusters.find(c => c.source) || new Cluster())
    const [view, setView] = useState('')
    const [allNamespaces, setAllNamespaces] = useState<string[]>([])
    const [namespaces, setNamespaces] = useState<string[]>([])
    const [allGroups, setAllGroups] = useState<string[]>([])
    const [groups, setGroups] = useState<string[]>([])
    const [allPods, setAllPods] = useState<string[]>([])
    const [pods, setPods] = useState<string[]>([])
    const [allContainers, setAllContainers] = useState<string[]>([])
    const [containers, setContainers] = useState<string[]>([])
    const [channel, setChannel] = useState(props.channels.length>0? props.channels[0]  as InstanceMessageChannelEnum : InstanceMessageChannelEnum.LOG)
    const [msgBox, setMsgBox] = useState(<></>)

    let isDocker = cluster.kwirthData?.clusterType === ClusterTypeEnum.DOCKER

    const getNamespaces = async (cluster:Cluster) => {
        if (cluster) {
            let response = await fetch(`${cluster.url}/config/namespace`, addGetAuthorization(cluster.accessString))
            if (response.status!==200) {
                setMsgBox(MsgBoxOkError('Resource Selector',`Error accessing cluster: ${JSON.stringify(response.status)}`, setMsgBox))
            }
            else {
                let data = await response.json()
                setAllNamespaces(data)
            }
        }
    }

    const loadAllGroups = async (cluster:Cluster,namespace:string) => {
        let response = await fetch(`${cluster!.url}/config/${namespace}/groups`, addGetAuthorization(cluster!.accessString))
        let data = await response.json() as IGroup[]
        setAllGroups((prev) => [...prev, ...data.map(d => d.type+'+'+d.name)])
        setGroups([])
    }

    // const loadAllPodsOld = async (namespace:string, group:string) => {
    //     if (isDocker) {
    //         let [gtype,gname] = group.split('+')
    //         let response = await fetch(`${cluster!.url}/config/${namespace}/${gname}/pods?type=${gtype}`, addGetAuthorization(cluster!.accessString))
    //         let data = await response.json()
    //         setAllPods((prev) => [...prev, ...data])
    //     }
    //     else {
    //         let [gtype,gname] = group.split('+')
    //         let response = await fetch(`${cluster!.url}/config/${namespace}/${gname}/pods?type=${gtype}`, addGetAuthorization(cluster!.accessString))
    //         let data = await response.json()
    //         setAllPods((prev) => [...prev, ...data])
    //     }
    // }

    const loadAllPods = async (namespaces:string[], groups:string[]) => {
        if (isDocker) {
            let [gtype,gname] = groups[0].split('+')
            let response = await fetch(`${cluster!.url}/config/${namespaces[0]}/${gname}/pods?type=${gtype}`, addGetAuthorization(cluster!.accessString))
            let data = await response.json()
            setAllPods((prev) => [...prev, ...data])
        }
        else {
            let list:string[] = []
            for (let namespace of namespaces) {
                for (let group of groups) {
                    let [gtype,gname] = group.split('+')
                    let response = await fetch(`${cluster!.url}/config/${namespace}/${gname}/pods?type=${gtype}`, addGetAuthorization(cluster!.accessString))
                    let data = await response.json()
                    list.push (...(data as string[]))
                }
            }
            setAllPods((prev) => [...prev, ...new Set(list)])
        }
    }

    const loadAllContainers = async (cluster: Cluster, namespace:string, pod:string) => {
        let response = await fetch(`${cluster.url}/config/${namespace}/${pod}/containers`, addGetAuthorization(cluster.accessString))
        let data = await response.json()
        setAllContainers((prev) => [...prev, ...(data as string[]).map(c => pod+'+'+c)])
    }

    const onChangeCluster = (event: SelectChangeEvent) => {
        let value=event.target.value
        let cluster = props.clusters?.find(c => c.name===value)!
        if (cluster.kwirthData?.clusterType === ClusterTypeEnum.DOCKER) {
            setCluster(cluster)
            setView('')
            setAllNamespaces([])
            setNamespaces([])
            setAllGroups([])
            setGroups([])
            setPods([])
            setAllContainers([])
            setContainers([])
        }
        else {
            setCluster(cluster)
            setView('')
            setAllNamespaces([])
            setNamespaces([])
            setAllGroups([])
            setGroups([])
            setPods([])
            setAllContainers([])
            setContainers([])
        }
        if (props.onChangeCluster !== undefined) props.onChangeCluster(value)
    }

    const onChangeView = (event: SelectChangeEvent) => {
        let view=event.target.value
        setView(view)

        if (isDocker) {
            setNamespaces(['$docker'])
            setGroups(['$docker'])
            setAllPods([])
            setPods([])
            setContainers([])
            loadAllPods(['$docker'], ['$docker'])
        }
        else {
            setNamespaces([])
            setAllGroups([])
            setGroups([])
            setPods([])
            setAllContainers([])
            setContainers([])
            getNamespaces(props.clusters?.find(c => c.name===cluster.name)!)
        }
    }

    const onChangeNamespaces = (event: SelectChangeEvent<typeof namespaces>) => {
        let nss  = event.target.value as string[]
        if (isDocker){
            setNamespaces(['$docker'])
            setAllPods([])
            setPods([])
            if (view!=='namespace') loadAllPods(['$docker'], ['$docker'])
        }
        else {
            setNamespaces(nss)
            setAllGroups([])
            setGroups([])
            setPods([])
            setAllContainers([])
            setContainers([])
            if (view!=='namespace') nss.map (ns => loadAllGroups(cluster, ns))
        }
    }

    const onChangeGroup = (event: SelectChangeEvent<typeof groups>) => {
        let groups  = event.target.value as string[]
        setGroups(groups)
        setAllPods([])
        setPods([])
        setAllContainers([])
        setContainers([])
        if (view!==InstanceConfigViewEnum.GROUP) loadAllPods(namespaces,groups)
    }

    const onChangePod= (event: SelectChangeEvent<typeof pods>) => {
        let pods  = event.target.value as string[]
        setPods(pods)
        setAllContainers([])
        setContainers([])
        if (view === 'container') namespaces.map(ns => pods.map (pod => loadAllContainers(cluster, ns, pod)))
    }

    const onChangeContainer = (event: SelectChangeEvent<typeof containers>) => {
        let cs  = event.target.value as string[]
        setContainers(cs)
    }

    const onChangeChannel = (event: SelectChangeEvent) => {
        setChannel(event.target.value as InstanceMessageChannelEnum)
    }

    const onAdd = () => {
        let selection:IResourceSelected = {
            channel: channel,
            clusterName: cluster?.name,
            view,
            namespaces,
            groups,
            pods,
            containers,
            suggestedName: ''
        }

        if (view===InstanceConfigViewEnum.NAMESPACE)
            selection.suggestedName=namespaces.join('+')
        else if (view===InstanceConfigViewEnum.GROUP)
            selection.suggestedName=namespaces.join('+')+'-'+groups.join('+')
        else if (view===InstanceConfigViewEnum.POD)
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')
        else if (view===InstanceConfigViewEnum.CONTAINER)
            selection.suggestedName=namespaces.join('+')+'-'+pods.join('+')+'-'+containers.join(',')
        props.onAdd(selection)
    }

    const addable = () => {
        if (cluster===undefined) return false
        if (channel === InstanceMessageChannelEnum.NONE) return false
        if (view==='') return false
        if (namespaces.length === 0) return false
        if (view===InstanceConfigViewEnum.NAMESPACE) return true
        if (groups.length === 0) return false
        if (view===InstanceConfigViewEnum.GROUP) return true
        if (pods.length === 0) return false
        if (view===InstanceConfigViewEnum.POD) return true
        if (containers.length === 0) return false
        return true
    }

    const getIcon = (cluster:Cluster)  => {
        if (!cluster.kwirthData || !cluster.kwirthData.clusterType) return <KIconKubernetesUnknown/>
        if (cluster.kwirthData.clusterType[0] === 'd') return <KIconDocker/>
        if (cluster.kwirthData.clusterType[0] === 'k') {
            if (cluster.kwirthData.inCluster) 
                return <KIconKubernetes/>
            else
                return <KIconKubernetesBlank/>
        }
    }

    return (<>
        <Stack direction='row' spacing={1} sx={{...props.sx}} alignItems='baseline'>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }}>
                <InputLabel>Cluster</InputLabel>
                <Select value={cluster?.name} onChange={onChangeCluster}>
                { props.clusters?.map( (cluster) => {
                    return <MenuItem key={cluster.name} value={cluster.name} disabled={!cluster.enabled}>
                        {getIcon(cluster)} &nbsp; {cluster.name}
                    </MenuItem>
                })}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={cluster.name===''}>
                <InputLabel>View</InputLabel>
                <Select value={view} onChange={onChangeView} >
                    <MenuItem key={InstanceConfigViewEnum.NAMESPACE} value={InstanceConfigViewEnum.NAMESPACE} disabled={isDocker}>namespace</MenuItem>
                    <MenuItem key={InstanceConfigViewEnum.GROUP} value={InstanceConfigViewEnum.GROUP} disabled={isDocker}>group</MenuItem>
                    <MenuItem key={InstanceConfigViewEnum.POD} value={InstanceConfigViewEnum.POD}>pod</MenuItem>
                    <MenuItem key={InstanceConfigViewEnum.CONTAINER} value={InstanceConfigViewEnum.CONTAINER}>container</MenuItem>
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={view==='' || isDocker}>
                <InputLabel>Namespace</InputLabel>
                <Select onChange={onChangeNamespaces} multiple value={namespaces} renderValue={(selected) => selected.join(', ')}>
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

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={namespaces.length===0 || view==='namespace' || isDocker}>
                <InputLabel>Group</InputLabel>
                <Select onChange={onChangeGroup} value={groups} multiple renderValue={(selected) => selected.join(', ')}>
                { allGroups && allGroups.map( (value) => 
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={groups.includes (value)} />
                        {value.startsWith('replica')? <KIconReplicaSet/>: value.startsWith('daemon')?<KIconDaemonSet/>: value.startsWith('deployment')?<KIconDeployment/>:<KIconStatefulSet/>}&nbsp;{value.split('+')[1]}
                    </MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={(!isDocker && (groups.length === 0 || view===InstanceConfigViewEnum.NAMESPACE || view===InstanceConfigViewEnum.GROUP)) || (isDocker && (view ==='namespace' || namespaces.length === 0))}>
                <InputLabel >Pod</InputLabel>
                <Select value={pods} onChange={onChangePod} multiple renderValue={(selected) => selected.join(', ')}>
                { allPods && allPods.map( (value:string) =>
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={pods.includes (value)} />{value}
                    </MenuItem>

                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={pods.length === 0 || view===InstanceConfigViewEnum.NAMESPACE || view===InstanceConfigViewEnum.GROUP || view===InstanceConfigViewEnum.POD}>
                <InputLabel >Container</InputLabel>
                <Select value={containers} onChange={onChangeContainer} multiple renderValue={(selected) => selected.join(', ')}>
                { allContainers && allContainers.map( (value:string) => 
                    <MenuItem key={value} value={value} sx={{alignContent:'center'}}>
                        <Checkbox checked={containers.includes(value)} />
                        <Stack direction={'column'}>
                            {value.split('+')[1]}
                            <Typography color={'darkgray'} fontSize={12}>{value.split('+')[0]}</Typography>
                        </Stack>
                    </MenuItem>
                )}
                </Select>
            </FormControl>

            <FormControl variant='standard' sx={{ m: 1, minWidth: 100, width:'14%' }} disabled={cluster.name === ''}>
                <InputLabel >Channel</InputLabel>
                <Select value={props.channels.length>0?channel:''} onChange={onChangeChannel}> 
                    {
                        //cluster.channels? cluster.channels.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>) : props.channels?.map(c => <MenuItem key={c} value={c}>{c}</MenuItem> )
                        props.channels.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)
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
