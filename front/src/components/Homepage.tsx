import React, { useState } from 'react'
import { Box,  Card, CardContent, CardHeader, Icon, IconButton, Stack, Typography } from '@mui/material'
import { IBoard } from '../model/IBoard'
import { ITabSummary } from '../model/ITabObject'
import { InstanceConfigViewEnum } from '@jfvilas/kwirth-common'
import { Delete, OpenInBrowser, Star } from '@mui/icons-material'
import { ChannelConstructor } from '../channels/IChannel'
import IconNamespace from'../icons/svg/ns.svg'
import IconPod from'../icons/svg/pod.svg'
import IconContainer from'../icons/svg/docker-mark-blue.svg'
import IconBlank from'../icons/svg/k8s-blank.svg'
const KIconBlank = () => { return <img src={IconBlank} alt='ns' height={'24px'}/> }
const KIconNamespace = () => { return <img src={IconNamespace} alt='ns' height={'24px'}/> }
const KIconPod = () => { return <img src={IconPod} alt='ns' height={'24px'}/> }
const KIconContainer = () => { return <img src={IconContainer} alt='ns' height={'24px'}/> }

// svg optimizer: https://jakearchibald.github.io/svgomg/ (optmizes size and removes namespaces)

interface IProps {
    frontChannels: Map<string, ChannelConstructor>
    lastTabs:ITabSummary[]
    favTabs:ITabSummary[]
    lastBoards:any
    favBoards:any
    onSelectTab: (tab:ITabSummary) => void
    onSelectBoard: (board:IBoard) => void
    onUpdateTabs: (last:ITabSummary[], fav:ITabSummary[]) => void
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

    const drawTabs = (list:ITabSummary[], type:string) => {
        return list.map(tab => {
            let icon = <Box sx={{minWidth:'24px'}}/>

            const channelClass = props.frontChannels.get(tab.channel)
            if (channelClass) icon = new channelClass()!.getChannelIcon()

            let view = <></>
            switch (tab.channelObject.view) {
                case InstanceConfigViewEnum.NAMESPACE:
                    view = <KIconNamespace/>
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

            return <>
                <Stack direction={'row'} alignItems={'center'} flex={1}>
                    {icon}
                    <Typography>&nbsp;&nbsp;</Typography>
                    {view}
                    <Typography>&nbsp;&nbsp;</Typography>
                    <Typography>{tab.name}</Typography>
                    <Typography flexGrow={1}/>
                    <IconButton onClick={() => openTab(tab)}>
                        <OpenInBrowser/>
                    </IconButton>
                    { type !== 'fav' && 
                        <IconButton onClick={() => toOrFromFavTabs(tab)}>
                            { props.favTabs.some(t => t.name === tab.name)? <Star sx={{ color: 'gold' }} /> : <Star sx={{ color: 'gray' }} /> }
                        </IconButton>

                    }
                    <IconButton onClick={() => deleteFromList(list, tab)}>
                        <Delete/>
                    </IconButton>
                </Stack>
            </>
        })
    }
    return (<>
        <Box width='100%' sx={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Stack direction={'row'} spacing={2} sx={{width:'90%'}}>
                <Stack direction={'column'} width='100%' spacing={2} height='100%'>
                    <Card sx={{flex:1}}>
                        <CardHeader title='Last tabs'/>
                        <CardContent>
                            {drawTabs(props.lastTabs, 'last')}
                        </CardContent>
                    </Card>
                    <Card sx={{flex:1}}>
                        <CardHeader title='Fav tabs'/>
                        <CardContent>
                            {drawTabs(props.favTabs, 'fav')}
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
                        You have no Fav boards.
                    </CardContent>
                </Card>

                </Stack>
            </Stack>
        </Box>        
    </>)
}

export { Homepage }
