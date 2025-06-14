import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'

interface IVProps {
    vuln: any
}

const TabContentTrivyAssetVulns: React.FC<IVProps> = (props:IVProps) => {
    let vuln = props.vuln
    let date = new Date(vuln.publishedDate)
    let published = date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate()
    let title = (vuln.title||vuln.vulnerabilityID) as string
    let i=title.indexOf(':')
    if (i>=0) title = title.substring(0,i)
    
    return (
        <Accordion sx={{m:0.1}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction='row' alignItems={'center'}>
                    <Typography sx={{width:'120px'}}>{vuln.severity}</Typography>
                    <Typography fontSize={12}>{title}</Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Typography><b>Id: </b><a href={vuln.primaryLink} target='_blank' rel='noreferrer'>{vuln.vulnerabilityID}</a>{date.getFullYear()? <>&nbsp;&nbsp;(published {published})</>:<></>}</Typography>
                <Typography><b>Resource: </b>{vuln.resource}</Typography>
                {vuln.title && <Typography><b>Description: </b>{vuln.title}</Typography>}
                <Typography><b>Installed: </b>{vuln.installedVersion}</Typography>
                <Typography><b>Fixed: </b>{vuln.fixedVersion || 'n/a'}</Typography>
            </AccordionDetails>
        </Accordion>
    )
}

export { TabContentTrivyAssetVulns }