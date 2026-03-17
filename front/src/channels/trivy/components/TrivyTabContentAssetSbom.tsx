import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'

interface ITabContentTrivyAssetSbomProps {
    component: any
}

const TrivyTabContentAssetSbom: React.FC<ITabContentTrivyAssetSbomProps> = (props:ITabContentTrivyAssetSbomProps) => {
    let component = props.component
    
    return (
        <Accordion sx={{m:0.1}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction='row' alignItems={'center'}>
                    <Typography fontSize={12}>{component.name}</Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                {
                    JSON.stringify(props.component)
                }
            </AccordionDetails>
        </Accordion>
    )
}

export { TrivyTabContentAssetSbom }