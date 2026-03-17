import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { Accordion, AccordionDetails, AccordionSummary, Stack, Typography } from '@mui/material'

interface ITabContentTrivyAssetExposedProps {
    secret: any
}

const TrivyTabContentAssetExposed: React.FC<ITabContentTrivyAssetExposedProps> = (props:ITabContentTrivyAssetExposedProps) => {
    let secret = props.secret
    
    return (
        <Accordion sx={{m:0.1}}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction='row' alignItems={'center'}>
                    <Typography fontSize={12}>{secret.name}</Typography>
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                {
                    JSON.stringify(props.secret)
                }
            </AccordionDetails>
        </Accordion>
    )
}

export { TrivyTabContentAssetExposed }