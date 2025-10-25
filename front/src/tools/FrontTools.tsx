import { InfoOutlined } from "@mui/icons-material"
import { Box, Tooltip, Typography } from "@mui/material"

interface ITextToolTipProps {
    name:string,
    help:JSX.Element
}

const TextToolTip: React.FC<ITextToolTipProps> = (props:ITextToolTipProps) => {
    return (
        <Box display="flex" alignItems="center" mt={2}>
            <Typography variant="body1">{props.name}&nbsp;</Typography>
            <Tooltip title={props.help}>
                <InfoOutlined fontSize="inherit" />
            </Tooltip>
        </Box>
    )
}

export {TextToolTip}