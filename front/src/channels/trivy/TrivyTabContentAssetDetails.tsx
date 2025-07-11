import { Avatar, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { assetAvatarColor, assetScore, assetScoreColor } from './TrivyCommon'
import { TabContentTrivyAssetVulns } from './TrivyTabContentAssetVuln'
import { ITrivyInstanceConfig } from './TrivyConfig'
import { IKnown } from '@jfvilas/kwirth-common'

interface IProps {
    asset: IKnown
    trivyInstanceConfig: ITrivyInstanceConfig
    onClose: () => void
}

const TabContentTrivyAssetDetails: React.FC<IProps> = (props:IProps) => {
    let report = props.asset.report
    let asset = props.asset
    let trivyInstanceConfig = props.trivyInstanceConfig

    let summary = () => {
        return (
            <TableContainer component={Paper} sx={{mt:1}}>
                <Table sx={{ minWidth: '100%' }} size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell align='center'><b>KwirthScore</b></TableCell>
                            <TableCell align='center'><b>Critical</b></TableCell>
                            <TableCell align='center'><b>High</b></TableCell>
                            <TableCell align='center'><b>Medium</b></TableCell>
                            <TableCell align='center'><b>Low</b></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                            <TableCell align='center' color={assetScoreColor(asset,trivyInstanceConfig)}>{assetScore(asset,trivyInstanceConfig)}</TableCell>
                            <TableCell align='center'>{asset.report.summary.criticalCount}</TableCell>
                            <TableCell align='center'>{asset.report.summary.highCount}</TableCell>
                            <TableCell align='center'>{asset.report.summary.mediumCount}</TableCell>
                            <TableCell align='center'>{asset.report.summary.lowCount}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>            
        )
    }
    let levels = ['CRITICAL','HIGH','MEDIUM','LOW']
    let vulns:any[] = (asset.report.vulnerabilities as any[]).sort((a,b) => levels.indexOf(a.severity)-levels.indexOf(b.severity))

    return (
        <Dialog open={true} PaperProps={{ sx: {backgroundColor: '#f5f5f5'} }}>
            <DialogTitle>
                <Stack direction={'row'} spacing={2} alignItems={'center'}>
                    <Avatar sx={{ bgcolor: assetAvatarColor(report.os.family) }} aria-label="recipe">{report.os.family.substring(0,1).toUpperCase()}</Avatar>
                    <Stack direction={'column'}>
                        <Typography fontSize={14}>{asset.namespace}</Typography>
                        <Typography fontSize={14}>{asset.name}/{asset.container}</Typography>
                    </Stack>
                </Stack>
            </DialogTitle>
            <DialogContent sx={{overflowY:'hidden'}}>
                <Stack direction='column' spacing={1}>
                    {summary()}
                    <Card sx={{p:1}}>
                        <Typography><b>Image:</b> {`${asset.report.registry.server}/${asset.report.artifact.repository}:${asset.report.artifact.tag}`}</Typography>
                        <Typography><b>OS:</b> {`${asset.report.os.family}/${asset.report.os.name}`}</Typography>
                        <Typography><b>Scan:</b> {`${asset.report.scanner.name} ${asset.report.scanner.version} (${asset.report.scanner.vendor}) on ${asset.report.updateTimestamp}`}</Typography>
                    </Card>
                    <Box sx={{display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height:'50vh'}}>
                        {vulns.map((vuln,index) => <TabContentTrivyAssetVulns key={index} vuln={vuln}/>)}
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose()}>ok</Button>
            </DialogActions>
        </Dialog>
    )
}

export { TabContentTrivyAssetDetails }