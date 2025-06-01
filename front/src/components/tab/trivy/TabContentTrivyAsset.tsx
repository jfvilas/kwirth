import { Avatar, Box, Card, CardContent, CardHeader, CardMedia, IconButton, Stack, Typography } from '@mui/material'
import { red } from '@mui/material/colors'
import { TrivyObject } from '../../../model/TrivyObject'
import { Visibility as VisibilityIcon } from '@mui/icons-material'
import { assetScore, assetScoreColor } from './TrivyCommon'

interface IVProps {
    vuln: any
}

const TabContentTrivyVuln: React.FC<IVProps> = (props:IVProps) => {
    return <>
        <Typography>Vuln: {`${props.vuln.title}`}</Typography>
    </>
}

interface IProps {
    asset: any
    trivyObject:TrivyObject
    view:string
    onDetails: (asset:any) => void
}

const TabContentTrivyAsset: React.FC<IProps> = (props:IProps) => {
    let report = props.asset.report

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
            { label: `Critical (${c})`, height: Math.min(c*factor,height), color: getColor(c, props.trivyObject.maxCritical) },
            { label: `High (${h})`, height: Math.min(h*factor,height), color: getColor(h, props.trivyObject.maxHigh) },
            { label: `Medium (${m})`, height: Math.min(m*factor,height), color: getColor(m, props.trivyObject.maxMedium) },
            { label: `Low (${l})`, height: Math.min(l*factor,height), color: getColor(l, props.trivyObject.maxLow) },
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

    const getAvatarColor = (os:string) => {
        if (!os) return red[500]
        const index = os.charCodeAt(0) - 65
        const hue = Math.round((index / 26) * 360)
        const saturation = 70
        const lightness = 50
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;        
    }

    if (props.view === 'card') return (
        <Card sx={{width:'100%', height:'380px'}}>
            <CardHeader
                avatar={<Avatar sx={{ bgcolor: getAvatarColor(report.os.family) }} aria-label="recipe">{report.os.family.substring(0,1).toUpperCase()}</Avatar>}
                action={<IconButton onClick={() => props.onDetails(props.asset)}><VisibilityIcon /></IconButton>}
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
                        <Typography color={assetScoreColor(props.asset, props.trivyObject)} fontWeight={700}>{assetScore(props.asset, props.trivyObject).toFixed(0)}%</Typography>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
    if (props.view === 'list') return (
        <Card sx={{width:'100%'}}>
            <Stack direction={'row'}>
                <CardHeader sx={{width:'50%'}}
                    avatar={<Avatar sx={{ bgcolor: getAvatarColor(report.os.family) }} aria-label="recipe">{report.os.family.substring(0,1).toUpperCase()}</Avatar>}
                    title={`${props.asset.name}/${props.asset.container}`}
                    subheader={`${report.updateTimestamp}`}
                />
                <Stack direction={'row'} alignItems={'center'} sx={{width:'30%'}}>
                    <Typography color={assetScoreColor(props.asset, props.trivyObject)}>{assetScore(props.asset, props.trivyObject).toFixed(2)}%</Typography>
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

export { TabContentTrivyAsset, TabContentTrivyVuln }