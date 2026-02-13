import { Dispatch, SetStateAction, useRef } from 'react'
import { Tooltip, Stack, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography,  Box, TextField } from '@mui/material'
import { InfoOutlined } from '@mui/icons-material'

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

interface IInputBoxProps {
    title: string
    default?: any
    message: string|JSX.Element
    onClose: Dispatch<SetStateAction<JSX.Element>>
    onResult?: (result:any) => void
}

const InputBox: React.FC<IInputBoxProps> = (props:IInputBoxProps) => {
    const inputRef = useRef<HTMLInputElement>(null)

    if (!props.title) return <></>

    return (
        <Dialog open={true} onClose={() => { props.onClose(<></>); if (props.onResult) props.onResult(undefined)}}>
            <DialogTitle>
                {props.title}
            </DialogTitle>
            <DialogContent>
                    <Stack sx={{mt:2}} direction='column' alignItems={'top'}>
                        { typeof(props.message)==='string' ?
                            <Typography component={'div'} sx={{ml:2}}><div dangerouslySetInnerHTML={{__html: props.message}}/></Typography>
                            :
                            props.message
                         }
                         <TextField inputRef={inputRef} defaultValue={props.default}></TextField>
                    </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { props.onClose(<></>); if (props.onResult) props.onResult(inputRef.current?.value)}}>ok</Button>
                <Button onClick={() => { props.onClose(<></>)}}>cancel</Button>
            </DialogActions>
        </Dialog>
    )
}

export { InputBox, TextToolTip }