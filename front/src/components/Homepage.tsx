import React, { useState } from 'react'
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
const KIconBlank = () => { return <img src={IconBlank} alt='ns' height={'24px'}/> }
const KIconNamespace = () => { return <img src={IconNamespace} alt='ns' height={'24px'}/> }
const KIconGroup = () => { return <img src={IconGroup} alt='grp' height={'24px'}/> }
const KIconPod = () => { return <img src={IconPod} alt='pod' height={'24px'}/> }
const KIconContainer = () => { return <img src={IconContainer} alt='c' height={'24px'}/> }

// svg optimizer: https://jakearchibald.github.io/svgomg/ (optmizes size and removes namespaces)

interface IProps {
    clusterName:string|undefined,
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

    const drawTabs = (tabList:ITabSummary[], listType:ListTypeEnum) => {
        return tabList.map(tab => {
            let icon = <Box sx={{minWidth:'24px'}}/>

            const channelClass = props.frontChannels.get(tab.channel)
            if (channelClass) icon = new channelClass()!.getChannelIcon()

            let view = <></>
            console.log('tab.channelObject.view')
            console.log(tab.channelObject.view)
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

            return (
                <Stack key={listType+tab.name} direction={'row'} alignItems={'center'} flex={1}>
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
            )
        })
    }

    let homeCluster = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.name : 'n/a'
    let clusterUrl = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.url : 'n/a'
    let homeChannels = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.kwirthData?.channels.map(c => c.id).join(', ') : ''
    let kwirthVersion = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.kwirthData?.version : 'n/a'
    let kwrithNs = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.kwirthData?.namespace : 'n/a'
    let kwrithDeployment = props.clusterName? props.clusters.find(c => c.name===props.clusterName)!.kwirthData?.deployment : 'n/a'
    let frontChannels = ((props.frontChannels.keys() as any).toArray()).join(', ')

    return (<>
        <Card sx={{flex:1, width:'90%', alignSelf:'center'}}>
            <CardContent>
                <Stack direction={'row'} spacing={2} sx={{mt:'4px'}}>
                    <Stack width={'50%'}>
                        <Typography><b>Home cluster: </b>{homeCluster} [{clusterUrl}]</Typography>
                        <Typography><b>Home channels: </b>{homeChannels}</Typography>
                        <Typography><b>Front channels: </b>{frontChannels}</Typography>
                    </Stack>
                    <Divider orientation='vertical' flexItem/>
                    <Stack>
                        <Typography><b>Kwirth version: </b>{kwirthVersion}</Typography>
                        <Typography><b>Deployment: </b>{kwrithNs} / {kwrithDeployment}</Typography>
                        <Typography><b>Clusters: </b>{props.clusters.map (c => c.name).join(', ')}</Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>

        <Box sx={{ marginTop:'20px', display: 'flex', alignItems: 'center', justifyContent: 'center', width:'100%'}}>
            <Stack direction={'column'} spacing={2}>

                <Stack direction={'row'} spacing={1} sx={{width:'100%'}}>
                    <Stack direction={'column'} width='100%' spacing={1} height='100%'>
                        <Card sx={{flex:1}}>
                            <CardHeader title='Last tabs'/>
                            <CardContent>
                                {drawTabs(props.lastTabs, ListTypeEnum.LAST)}
                            </CardContent>
                        </Card>
                        <Card sx={{flex:1}}>
                            <CardHeader title='Fav tabs'/>
                            <CardContent>
                                {drawTabs(props.favTabs, ListTypeEnum.FAV)}
                            </CardContent>
                        </Card>
                    </Stack>
                    <Stack direction={'column'} width='100%' spacing={2} height='100%'>
                        <Card sx={{flex:1}}>
                            <CardHeader title='Last boards'/>
                            <CardContent>
                                No last boards detected.
                            </CardContent>
                        </Card>
                        <Card  sx={{flex:1}}>
                            <CardHeader title='Fav boards'/>
                            <CardContent>
                                You have no favorite boards.
                            </CardContent>
                        </Card>
                    </Stack>
                </Stack>

            </Stack>
        </Box>
    </>)
}

export { Homepage }
