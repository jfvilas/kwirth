import React, { useEffect, useRef, useState } from 'react'
import { Box,  Card, CardContent, CardHeader, Divider, IconButton, Stack, Typography } from '@mui/material'
import { IBoard } from '../model/IBoard'
import { ITabSummary } from '../model/ITabObject'
import { InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { Delete, OpenInBrowser, Star } from '@mui/icons-material'
import { ChannelConstructor } from '../channels/IChannel'
import IconNamespace from'../icons/svg/ns.svg'
import IconPod from'../icons/svg/pod.svg'
import IconGroup from'../icons/svg/group.svg'
import IconContainer from'../icons/svg/docker-mark-blue.svg'
import IconBlank from'../icons/svg/k8s-blank.svg'
import { Cluster } from '../model/Cluster'
import { GaugeComponent } from 'react-gauge-component'
import { addGetAuthorization } from '../tools/AuthorizationManagement'

const KIconBlank = () => { return <img src={IconBlank} alt='ns' height={'24px'}/> }
const KIconNamespace = () => { return <img src={IconNamespace} alt='ns' height={'24px'}/> }
const KIconGroup = () => { return <img src={IconGroup} alt='grp' height={'24px'}/> }
const KIconPod = () => { return <img src={IconPod} alt='pod' height={'24px'}/> }
const KIconContainer = () => { return <img src={IconContainer} alt='c' height={'24px'}/> }

// svg optimizer: https://jakearchibald.github.io/svgomg/ (optmizes size and removes namespaces)

interface IProps {
    cluster:Cluster|undefined,
    clusters:Cluster[]
    frontChannels: Map<string, ChannelConstructor>
    lastTabs:ITabSummary[]
    favTabs:ITabSummary[]
    lastBoards:any
    favBoards:any
    onSelectTab: (tab:ITabSummary) => void
    onSelectBoard: (board:IBoard) => void
    onUpdateTabs: (last:ITabSummary[], fav:ITabSummary[]) => void
}

enum ListTypeEnum {
    FAV='fav',
    LAST='last'
}

const Homepage: React.FC<IProps> = (props:IProps) => {
    const [refresh, setRefresh] = useState(0)
    const [cpu, setCpu] = useState(0)
    const [memory, setMemory] = useState(0)
    const [txmbps, setTxmbps] = useState(0)
    const [rxmbps, setRxmbps] = useState(0)
    const homepageBoxRef = useRef<HTMLDivElement | null>(null)
    const [homepageBoxTop, setHomepageBoxTop] = useState(0)

    let homeCluster = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.name : 'n/a'
    let clusterUrl = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.url : 'n/a'
    let homeChannels = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.kwirthData?.channels.map(c => c.id).join(', ') : ''
    let kwirthVersion = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.kwirthData?.version : 'n/a'
    let kwrithNs = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.kwirthData?.namespace : 'n/a'
    let kwrithDeployment = props.cluster? props.clusters.find(c => c.name===props.cluster!.name)!.kwirthData?.deployment : 'n/a'
    let frontChannels = ((props.frontChannels.keys() as any).toArray()).join(', ')

    useEffect(() => {
        if (homepageBoxRef.current) setHomepageBoxTop(homepageBoxRef.current.getBoundingClientRect().top)
    })
    
    useEffect( () => {
        let i = setInterval( () => {
            let cluster = props.cluster
            if (!cluster) cluster = props.clusters.find(x => x.source)!
            try {
                fetch(`${cluster.url}/metrics/usage`, addGetAuthorization(cluster.accessString)).then ( (result) => {
                    result.json().then ( (data) => {
                        console.log(data)
                        setCpu(data.cpu)
                        setMemory(data.memory)
                        setTxmbps(data.txmbps)
                        setRxmbps(data.rxmbps)
                    })
                })
            }
            catch (err) {
                console.log(err)
            }
        }, 3000)
        return () => clearInterval(i)

    })

    const toOrFromFavTabs = (tab:ITabSummary) => {
        if (!props.favTabs.some(t => t.name === tab.name && t.channel === tab.channel))
            props.favTabs.push(tab)
        else {
            let i = props.favTabs.findIndex(t => t.name !== tab.name || t.channel !== tab.channel)
            props.favTabs.splice(i,1)
        }
        setRefresh(Math.random())
        props.onUpdateTabs([...props.lastTabs], [...props.favTabs])
    }

    const deleteFromList = (list:ITabSummary[], tab:ITabSummary) => {
        let i = list.findIndex(t => t.name !== tab.name  && t.channel === tab.channel)
        list.splice(i,1)
        props.onUpdateTabs([...props.lastTabs], [...props.favTabs])
        setRefresh(Math.random())
    }

    const openTab = (tab:ITabSummary) => {
        props.onSelectTab(tab)
    }

    const drawTabCard = (tabList:ITabSummary[], listType:ListTypeEnum) => {
        return <>
            <Card sx={{flex:1}}>
                <CardHeader title={`${listType=== ListTypeEnum.LAST? 'Last':'Fav'} tabs`} sx={{borderBottom:1, borderColor:'divider', backgroundColor:'#e0e0e0'}}/>
                <CardContent sx={{overflowY:'auto', overflowX:'hidden', maxHeight:'150px', backgroundColor:'#f0f0f0'}}>                                    
                    {
                        tabList.map(tab => {
                            let icon = <Box sx={{minWidth:'24px'}}/>

                            const channelClass = props.frontChannels.get(tab.channel)
                            if (channelClass) icon = new channelClass()!.getChannelIcon()

                            let view = <></>
                            switch (tab.channelObject.view) {
                                case InstanceConfigViewEnum.NAMESPACE:
                                    view = <KIconNamespace/>
                                    break
                                case InstanceConfigViewEnum.GROUP:
                                    view = <KIconGroup/>
                                    break
                                case InstanceConfigViewEnum.POD:
                                    view = <KIconPod/>
                                    break
                                case InstanceConfigViewEnum.CONTAINER:
                                    view = <KIconContainer/>
                                    break
                                default:
                                    view = <KIconBlank/>
                                    break
                            }

                            return <Stack key={listType+tab.name} direction={'row'} alignItems={'center'} flex={1}>
                                {icon}
                                <Typography>&nbsp;&nbsp;</Typography>
                                {view}
                                <Typography>&nbsp;&nbsp;</Typography>
                                <Typography>{tab.name}</Typography>
                                <Typography flexGrow={1}/>
                                <IconButton onClick={() => openTab(tab)}>
                                    <OpenInBrowser/>
                                </IconButton>
                                { listType !== ListTypeEnum.FAV && 
                                    <IconButton onClick={() => toOrFromFavTabs(tab)}>
                                        { props.favTabs.some(t => t.name === tab.name)? <Star sx={{ color: 'gold' }} /> : <Star sx={{ color: 'gray' }} /> }
                                    </IconButton>

                                }
                                <IconButton onClick={() => deleteFromList(tabList, tab)}>
                                    <Delete/>
                                </IconButton>
                            </Stack>
                        })
                    }
                </CardContent>
            </Card>
        </>
    }

    const drawBoardCard = (tabList:ITabSummary[], listType:ListTypeEnum) => {
        return <>
            <Card sx={{flex:1}}>
                <CardHeader title={`${listType=== ListTypeEnum.LAST? 'Last':'Fav'} boards`} sx={{borderBottom:1, borderColor:'divider', backgroundColor:'#e0e0e0'}}/>
                <CardContent sx={{overflowY:'auto', overflowX:'hidden', maxHeight:'150px', backgroundColor:'#f0f0f0'}}>
                    No boards.
                </CardContent>
            </Card>
        </>
    }

    const drawRadial = (value:number, text:string) => {
        return (
            <Box width={'100%'} flex={'1'} flexDirection={'column'} alignContent={'center'}>
                <GaugeComponent 
                    type='radial'
                    labels={{
                        valueLabel:{ style: {fontSize: "30px", fill: "#000000", textShadow: "black"} }
                    }}
                    arc={{
                        subArcs: [
                            { limit: 50, color: '#5BE12C', showTick: true },
                            { limit: 80, color: '#F5CD19', showTick: true },
                            { limit: 100, color: '#EA4228', showTick: true },
                        ]
                    }}
                    value={value}
                />
                <Stack direction={'column'} alignItems={'center'}>
                    <Typography>{text}</Typography>
                </Stack>
            </Box>
        )
    }

    const drawSemicircle = (value:number, text:string, minValue:number, maxValue:number) => {
        return (
            <Box width={'100%'}>
                <GaugeComponent 
                    type='semicircle'
                    arc={{
                        colorArray: ['#5BE12C', '#F5CD19', '#EA4228'],
                    }}                
                    labels={{
                        valueLabel:{
                            style: {fontSize: "20px", fill: "#000000", textShadow: "black" },
                            formatTextValue: (v) => v
                        },
                        tickLabels: {
                            type: 'inner',
                            defaultTickValueConfig: { formatTextValue: (v) => '' }
                        }
                    }}
                    pointer={{type: "arrow", elastic: true}}
                    value={value}
                />
                <Stack direction={'column'} alignItems={'center'}>
                    <Typography fontSize={12}>{text} Mbps</Typography>
                </Stack>
            </Box>
        )
    }

    return (<>
    
        <Card sx={{flex:1, width:'95%', alignSelf:'center', marginTop:'8px'}}>
            <CardContent sx={{backgroundColor:'#f0f0f0'}}>
                <Stack direction={'row'} spacing={2} sx={{mt:'4px'}}>
                    <Stack width={'30%'}>
                        <Typography><b>Home cluster: </b>{homeCluster} [{clusterUrl}]</Typography>
                        <Typography><b>Selected cluster: </b>{props.cluster?.clusterInfo?.name}</Typography>
                        <Typography><b>Cluster channels: </b>{homeChannels}</Typography>
                        <Typography><b>Front channels: </b>{frontChannels}</Typography>
                    </Stack>
                    <Divider orientation='vertical' flexItem/>
                    <Stack width={'20%'}>
                        <Typography><b>Kwirth version: </b>{kwirthVersion}</Typography>
                        <Typography><b>Deployment: </b>{kwrithNs} / {kwrithDeployment}</Typography>
                        <Typography><b>Clusters: </b>{props.clusters.map (c => c.name).join(', ')}</Typography>
                    </Stack>
                    <Divider orientation='vertical' flexItem/>
                    <Stack width={'14%'}>
                        <Typography><b>Type: </b>{props.cluster?.clusterInfo?.type}</Typography>
                        <Typography><b>Flavour: </b>{props.cluster?.clusterInfo?.flavour}</Typography>
                        <Typography><b>vCPU: </b>{props.cluster?.clusterInfo?.vcpu}</Typography>
                        <Typography><b>Memory: </b>{(props.cluster?.clusterInfo?.memory||0)/1024/1024/1024}GB</Typography>
                    </Stack>
                    <Divider orientation='vertical' flexItem/>
                    <Stack width={'9%'} direction={'column'} alignItems={'center'}>
                        {drawRadial(cpu,'CPU')}
                    </Stack>
                    <Stack width={'9%'} direction={'column'} alignItems={'center'}>
                        {drawRadial(memory,'Memory')}
                    </Stack>
                    <Stack width={'9%'} direction={'column'} alignItems={'center'}>
                        {drawSemicircle(txmbps,'Tx', 0, 10)}
                        {drawSemicircle(rxmbps,'Rx', 0, 10)}
                    </Stack>
                </Stack>
            </CardContent>
        </Card>

        <Box sx={{ marginTop:'16px', display: 'flex', alignItems: 'center', justifyContent: 'center', width:'100%'}}>
            <Stack direction={'column'} spacing={2} width={'95%'}>

                <Stack direction={'row'} spacing={2} sx={{width:'100%'}}>
                    <Stack direction={'column'} width='100%' spacing={2} height='100%'>
                        {drawTabCard(props.lastTabs, ListTypeEnum.LAST)}
                        {drawTabCard(props.favTabs, ListTypeEnum.FAV)}
                    </Stack>
                    <Stack direction={'column'} width='100%' spacing={2} height='100%'>
                        {drawBoardCard(props.lastBoards, ListTypeEnum.LAST)}
                        {drawBoardCard(props.favBoards, ListTypeEnum.FAV)}
                    </Stack>
                </Stack>

            </Stack>
        </Box>
    </>)
}

export { Homepage }
