import { Avatar, Box, Card, CardContent, CardHeader, CardMedia, Divider, IconButton, Menu, MenuItem, MenuList, Stack, Typography } from '@mui/material'
import { MoreVert as MoreVertIcon } from '@mui/icons-material'
import { Visibility as VisibilityIcon } from '@mui/icons-material'
import { Replay as ReplayIcon } from '@mui/icons-material'
import { assetAvatarColor, assetScore, assetScoreColor, getAvatarContent } from './TrivyCommon'
import { useState } from 'react'
import { IChannelObject } from '../IChannel'
import { ITrivyInstanceConfig, TrivyInstanceConfig } from './TrivyConfig'
import { EInstanceMessageAction, EInstanceMessageChannel, EInstanceMessageFlow, EInstanceMessageType } from '@jfvilas/kwirth-common'
import { ETrivyCommand, IAsset, ITrivyMessage } from './TrivyData'

interface ITrivyTabContentAssetProps {
    asset: IAsset
    channelObject: IChannelObject
    view: string
    onVulns: (asset:IAsset) => void
    onAudit: (asset:IAsset) => void
    onRescan: (asset:IAsset) => void
}

const simpleBarChart = (reportVulns:any, reportAudit:any, trivyInstanceConfig:TrivyInstanceConfig) => {
    let vulns = (reportVulns?.summary?.criticalCount +  reportVulns?.summary?.highCount + reportVulns?.summary?.mediumCount + reportVulns?.summary?.lowCount) || 0
    let audit = (reportAudit?.summary?.criticalCount +  reportAudit?.summary?.highCount + reportAudit?.summary?.mediumCount + reportAudit?.summary?.lowCount) || 0
    let height = 100
    let factor = 1
    const getColor = (v:number, max:number) => {
        if (max<0) return '#dddddd'
        if (v>=max) return '#d32f2f'
        if (v>max*0.75) return '#fbc02d'
        return '#388e3c'
    }
    const bars = [
        { label: `Vulns (${vulns})`, height: Math.min(vulns*factor,height), color: getColor(vulns, trivyInstanceConfig.maxCritical) },
        { label: `Audit (${audit})`, height: Math.min(audit*factor,height), color: getColor(audit, trivyInstanceConfig.maxHigh) },
    ]

    return (
        <Box display="flex" alignItems="flex-end" justifyContent="space-around" height={height+40} width="100%" padding={2} bgcolor='background.paper'>
            {bars.map((bar, index) => (
                <Box key={index} textAlign="center">
                    <Box width={40} height={bar.height} bgcolor={bar.color} marginX={1} />
                    <Typography variant="caption">{bar.label}</Typography>
                </Box>
            ))}
        </Box>
    )
}

const TrivyTabContentAsset: React.FC<ITrivyTabContentAssetProps> = (props:ITrivyTabContentAssetProps) => {
    let trivyInstanceConfig:ITrivyInstanceConfig = props.channelObject.instanceConfig
    const [anchorMenu, setAnchorMenu] = useState<HTMLElement|null>(null)

    const rescan = (asset:IAsset) => {
        console.log(props.channelObject.webSocket)
        if (props.channelObject.webSocket) {
            let trivyMessage: ITrivyMessage = {
                msgtype: 'trivymessage',
                id: '1',
                accessKey: props.channelObject.accessString!,
                instance: props.channelObject.instanceId,
                namespace: asset.namespace,
                group: '',
                pod: asset.name,
                container: asset.container,
                command: ETrivyCommand.RESCAN,
                action: EInstanceMessageAction.COMMAND,
                flow: EInstanceMessageFlow.REQUEST,
                type: EInstanceMessageType.DATA,
                channel: EInstanceMessageChannel.TRIVY
            }
            props.channelObject.webSocket.send(JSON.stringify(trivyMessage))
            props.onRescan(asset)
        }
    }

    let assetMenu = (
        <Menu anchorEl={anchorMenu} open={Boolean(anchorMenu)} onClose={() => setAnchorMenu(null)}>
            <MenuList dense sx={{width:'150px'}}>
                <MenuItem key='av' onClick={() => { setAnchorMenu(null); props.onVulns(props.asset)}}><VisibilityIcon/>&nbsp;&nbsp;Vulnareabilities</MenuItem>
                <MenuItem key='aa' onClick={() => { setAnchorMenu(null); props.onAudit(props.asset)}}><VisibilityIcon/>&nbsp;&nbsp;Audit</MenuItem>
                <MenuItem key='ar' onClick={() => { setAnchorMenu(null); rescan(props.asset)}}><ReplayIcon/>&nbsp;&nbsp;Re-scan</MenuItem>
            </MenuList>
        </Menu>
    )
    
    if (props.view === 'card') return ( <>
        <Card sx={{width:'100%', height:'280px', borderStyle:'solid', border:'1px'}}>
            <CardHeader
                avatar={<Avatar sx={{background: assetAvatarColor(props.asset.vulnerabilityreports?.report?.os?.family||'X')}}>{getAvatarContent(props.asset.vulnerabilityreports?.report?.os?.family||'X')}</Avatar>}
                title={<>
                    <Typography variant='body2' color='textPrimary'>{`${props.asset.name?.substring(0,30)}...`}</Typography>
                    <Typography variant='body2' color='textPrimary'>{`${props.asset.container?.substring(0,30)||'NA'}...`}</Typography>
                </>}
                action={<IconButton onClick={(event) => setAnchorMenu(event?.currentTarget)}><MoreVertIcon /></IconButton>}
            />
            <CardMedia>
                {simpleBarChart(props.asset.vulnerabilityreports.report, props.asset.configauditreports.report, trivyInstanceConfig)}
            </CardMedia>
            <CardContent>
                <Stack direction='row'>
                    <Divider/>
                    <Stack direction='column' sx={{flex:1}}>
                        <Typography variant='body2'><b>Score:&nbsp;</b>{assetScore(props.asset, trivyInstanceConfig, 'vulnerabilityreports').toFixed(2)}%</Typography>
                        <Typography variant='body2'><b>Date:&nbsp;</b>{props.asset.vulnerabilityreports?.report?.updateTimestamp || props.asset.configauditreports?.report?.updateTimestamp}</Typography>
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
                <Stack direction={'row'} width={'50%'} p={1}  alignItems={'center'}>
                    <Avatar sx={{background: assetAvatarColor(props.asset.vulnerabilityreports?.report?.os?.family||'X')}}>{getAvatarContent(props.asset.vulnerabilityreports?.report?.os?.family||'X')}</Avatar>
                    <Stack direction={'column'} ml={1}>
                        <Typography variant='body2'><b>{`${props.asset.name.substring(0.20)}.../${props.asset.container.substring(0,10)}...`}</b></Typography>
                        <Typography variant='body2'>{`${props.asset.vulnerabilityreports?.report?.updateTimestamp || props.asset.configauditreports?.report?.updateTimestamp}`}</Typography>                        
                    </Stack>
                </Stack>
                <Stack direction={'row'} alignItems={'center'} sx={{width:'10%'}}>
                    <Typography color={assetScoreColor(props.asset, trivyInstanceConfig, 'vulnerabilityreports')}>{assetScore(props.asset, trivyInstanceConfig, 'vulnerabilityreports').toFixed(2)}%</Typography>
                </Stack>
                <Stack direction={'row'} sx={{display:'flex'}} display={'flex'} flexDirection={'row'} width={'100%'} flexGrow={1} alignItems={'center'}>
                    <Typography sx={{flex:1}}></Typography>
                    <IconButton onClick={() => props.onVulns(props.asset)}><VisibilityIcon/></IconButton>
                    <IconButton onClick={() => props.onAudit(props.asset)}><VisibilityIcon/></IconButton>
                </Stack>
            </Stack>
        </Card>
    )
    return <></>
}

export { TrivyTabContentAsset }