import { Avatar, Box, Card, CardContent, CardHeader, CardMedia, IconButton, Menu, MenuItem, MenuList, Stack, Typography } from '@mui/material'
import { TrivyObject } from '../../../model/TrivyObject'
import { MoreVert as MoreVertIcon } from '@mui/icons-material'
import { Visibility as VisibilityIcon } from '@mui/icons-material'
import { Replay as ReplayIcon } from '@mui/icons-material'
import { assetAvatarColor, assetScore, assetScoreColor } from './TrivyCommon'
import { useState } from 'react'
import { InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, TrivyCommandEnum, TrivyMessage } from '@jfvilas/kwirth-common'
import { IChannelObject } from '../../../model/ITabObject'

interface IProps {
    webSocket: WebSocket
    asset: any
    channelObject: IChannelObject
    view: string
    onDetails: (asset:any) => void
    onDelete: (asset:any) => void
}

const TabContentTrivyAsset: React.FC<IProps> = (props:IProps) => {
    let report = props.asset.report
    let trivyObject = props.channelObject.data as TrivyObject
    const [anchorMenu, setAnchorMenu] = useState<HTMLElement|null>(null)

    const simpleBarChart = (c:number, h:number, m:number, l:number) => {
        let height = 140
        let factor = 20
        const getColor = (v:number, max:number) => {
            if (max<0) return '#dddddd'
            if (v>=max) return '#d32f2f'
            if (v>max*0.75) return '#fbc02d'
            return '#388e3c'
        }
        const bars = [
            { label: `Critical (${c})`, height: Math.min(c*factor,height), color: getColor(c, trivyObject.maxCritical) },
            { label: `High (${h})`, height: Math.min(h*factor,height), color: getColor(h, trivyObject.maxHigh) },
            { label: `Medium (${m})`, height: Math.min(m*factor,height), color: getColor(m, trivyObject.maxMedium) },
            { label: `Low (${l})`, height: Math.min(l*factor,height), color: getColor(l, trivyObject.maxLow) },
        ]

        return (
            <Box display="flex" alignItems="flex-end" justifyContent="space-around" height={height+10} width="100%" padding={2} bgcolor="#f5f5f5">
                {bars.map((bar, index) => (
                    <Box key={index} textAlign="center">
                        <Box width={40} height={bar.height} bgcolor={bar.color} marginX={1} />
                        <Typography variant="caption">{bar.label}</Typography>
                    </Box>
                ))}
            </Box>
    )}

    let rescan = (asset:any) => {
        let trivyMessage: TrivyMessage = {
            msgtype: 'trivymessage',
            id: '1',
            accessKey: trivyObject.accessKeyString,
            instance: props.channelObject.instance,
            namespace: asset.namespace,
            group: '',
            pod: asset.name,
            container: asset.container,
            command: TrivyCommandEnum.RESCAN,
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.REQUEST,
            type: InstanceMessageTypeEnum.DATA,
            channel: InstanceMessageChannelEnum.TRIVY
        }
        props.webSocket.send(JSON.stringify(trivyMessage))
        props.onDelete(asset)
    }

    let assetMenu = (
        <Menu anchorEl={anchorMenu} open={Boolean(anchorMenu)} onClose={() => setAnchorMenu(null)}>
            <MenuList dense sx={{width:'150px'}}>
                <MenuItem key='ad' onClick={() => { setAnchorMenu(null); props.onDetails(props.asset)}}><VisibilityIcon/>&nbsp;&nbsp;Details</MenuItem>
                <MenuItem key='ar' onClick={() => { setAnchorMenu(null); rescan(props.asset)}}><ReplayIcon/>&nbsp;&nbsp;Re-scan</MenuItem>
            </MenuList>
        </Menu>
    )
    
    if (props.view === 'card') return ( <>
        <Card sx={{width:'100%', height:'380px'}}>
            <CardHeader
                avatar={<Avatar sx={{ bgcolor: assetAvatarColor(report.os.family) }} aria-label="recipe">{report.os.family.substring(0,1).toUpperCase()}</Avatar>}
                action={<IconButton onClick={(event) => setAnchorMenu(event?.currentTarget)}><MoreVertIcon /></IconButton>}
                title={`${props.asset.name}/${props.asset.container}`}
                subheader={`${report.updateTimestamp}`}
            />
            <CardMedia>
                {simpleBarChart(report.summary.criticalCount,report.summary.highCount,report.summary.mediumCount,report.summary.lowCount)}
            </CardMedia>
            <CardContent>
                <Stack direction='row'>
                    <Stack direction='column' sx={{flex:1}}>
                        <Typography fontSize={14} fontWeight={800}>Image</Typography>
                        <Typography fontSize={12}>{`${report.registry.server}/${report.artifact.repository}:${report.artifact.tag}`}</Typography>
                        <Typography fontSize={14} fontWeight={800}>OS</Typography>
                        <Typography fontSize={12}>{`${report.os.family}/${report.os.name}`}</Typography>
                    </Stack>
                    <Stack direction='row' alignItems='center'>
                        <Typography color={assetScoreColor(props.asset, trivyObject)} fontWeight={700}>{assetScore(props.asset, trivyObject).toFixed(0)}%</Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
        { anchorMenu && assetMenu }
        </>

    )
    if (props.view === 'list') return (
        <Card sx={{width:'100%'}}>
            <Stack direction={'row'}>
                <CardHeader sx={{width:'50%'}}
                    avatar={<Avatar sx={{ bgcolor: assetAvatarColor(report.os.family) }} aria-label="recipe">{report.os.family.substring(0,1).toUpperCase()}</Avatar>}
                    title={`${props.asset.name}/${props.asset.container}`}
                    subheader={`${report.updateTimestamp}`}
                />
                <Stack direction={'row'} alignItems={'center'} sx={{width:'30%'}}>
                    <Typography color={assetScoreColor(props.asset, trivyObject)}>{assetScore(props.asset, trivyObject).toFixed(2)}%</Typography>
                </Stack>
                <Stack direction={'row'} sx={{display:'flex'}} display={'flex'} flexDirection={'row'} width={'100%'} flexGrow={1} alignItems={'center'}>
                    <Stack direction={'column'}>
                        <Typography fontSize={12}><b>Image</b> {`${report.registry.server}/${report.artifact.repository}:${report.artifact.tag}`}</Typography>
                        <Typography fontSize={12}><b>OS</b> {`${report.os.family}/${report.os.name}`}</Typography>
                    </Stack>
                    <Typography sx={{flex:1}}></Typography>
                    <IconButton onClick={() => props.onDetails(props.asset)}><VisibilityIcon/></IconButton>
                </Stack>
            </Stack>
        </Card>

    )
    return <></>
}

export { TabContentTrivyAsset }