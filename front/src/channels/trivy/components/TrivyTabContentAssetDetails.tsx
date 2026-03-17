import { Avatar, Box, Button, Card, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { assetScore, assetScoreColor, getAvatarContent, TReportType } from '../TrivyCommon'
import { ITrivyInstanceConfig } from '../TrivyConfig'
import { TrivyTabContentAssetAudit } from './TrivyTabContentAssetAudit'
import { TrivyTabContentAssetVulns } from './TrivyTabContentAssetVulns'
import { IAsset } from '../TrivyData'
import { TrivyTabContentAssetSbom } from './TrivyTabContentAssetSbom'
import { TrivyTabContentAssetExposed } from './TrivyTabContentAssetExposed'

interface ITrivyTabContentAssetDetailsProps {
    asset: IAsset
    trivyInstanceConfig: ITrivyInstanceConfig
    detail: TReportType
    onClose: () => void
}

let summary = (asset:IAsset, trivyInstanceConfig: ITrivyInstanceConfig, detail:TReportType) => {
    let report = detail==='vulnerabilityreports'? asset.vulnerabilityreports.report : asset.configauditreports.report

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
                        <TableCell align='center' color={assetScoreColor(asset,trivyInstanceConfig, detail)}>{assetScore(asset, trivyInstanceConfig, detail).toFixed(2)}%</TableCell>
                        <TableCell align='center'>{report.summary.criticalCount}</TableCell>
                        <TableCell align='center'>{report.summary.highCount}</TableCell>
                        <TableCell align='center'>{report.summary.mediumCount}</TableCell>
                        <TableCell align='center'>{report.summary.lowCount}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </TableContainer>            
    )
}
const TrivyTabContentAssetDetails: React.FC<ITrivyTabContentAssetDetailsProps> = (props:ITrivyTabContentAssetDetailsProps) => {
    let asset = props.asset
    let report = (asset as any)[props.detail].report

    let levels = ['CRITICAL','HIGH','MEDIUM','LOW']
    let vulns:any[] = report?.vulnerabilities ? report?.vulnerabilities.sort((a:any,b:any) => levels.indexOf(a.severity)-levels.indexOf(b.severity)) : []
    let checks:any[] = report?.checks ? report?.checks.sort((a:any,b:any) => levels.indexOf(a.severity)-levels.indexOf(b.severity)) : []
    let secrets:any[] = report?.secrets || []
    let components:any[] = report?.components?.components || []

    return (
        <Dialog open={true} PaperProps={{ sx: {backgroundColor: 'background.paper'} }}>
            <DialogTitle>
                <Stack direction={'row'} spacing={2} alignItems={'center'}>
                    <Avatar>{getAvatarContent(report?.os?.family||'X')}</Avatar>
                    <Stack direction={'column'}>
                        <Typography variant='body2'>{asset.namespace}</Typography>
                        <Typography variant='body2'>{asset.name}/{asset.container}</Typography>
                    </Stack>
                </Stack>
            </DialogTitle>
            <DialogContent sx={{overflowY:'hidden'}}>
                <Stack direction='column' spacing={1} mt={1}>
                    {summary(props.asset, props.trivyInstanceConfig, props.detail)}
                    
                    <Card sx={{p:1}}>
                        { props.detail === 'vulnerabilityreports' && <>
                                <Typography variant='body2'><b>Image:</b> {`${report.registry.server}/${report.artifact.repository}:${report.artifact.tag}`}</Typography>
                                <Typography variant='body2'><b>OS:</b> {`${report.os.family}/${report.os.name}`}</Typography>
                        </>}
                        <Typography variant='body2'><b>Scan:</b> {`${report.scanner.name} ${report.scanner.version} (${report.scanner.vendor}) on ${report.updateTimestamp}`}</Typography>
                    </Card>
                    <Box sx={{display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', width:'100%', flexGrow:1, height:'50vh'}}>
                        {
                            (props.detail==='vulnerabilityreports' && vulns.map((vuln,index) => <TrivyTabContentAssetVulns key={index} vuln={vuln}/>)) ||
                            (props.detail==='configauditreports' && checks.map((check,index) => <TrivyTabContentAssetAudit key={index} check={check}/>)) ||
                            (props.detail==='sbomreports' && components.map((component,index) => <TrivyTabContentAssetSbom key={index} component={component}/>)) ||
                            (props.detail==='exposedsecretreports' && secrets.map((secret,index) => <TrivyTabContentAssetExposed key={index} secret={secret}/>))
                        }
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose()}>ok</Button>
            </DialogActions>
        </Dialog>
    )
}

export { TrivyTabContentAssetDetails }