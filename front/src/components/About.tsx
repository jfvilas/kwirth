import React from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography} from '@mui/material'
import { VERSION } from '../version'

interface IAboutProps {
    onClose: () => void
}

const About: React.FC<IAboutProps> = (props:IAboutProps) => {
    return (<>
        <Dialog open={true} disableRestoreFocus={true} fullWidth maxWidth={'xs'}>
            <DialogTitle>About Kwirth...</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ display: 'flex', flexDirection: 'column'}} mt={2}>
                    <Typography><b>Version: </b>{VERSION}</Typography>
                    <Typography><b>Homepage: </b><a href='https://jfvilas.github.io/kwirth' target='_blank' rel='noreferrer'>https://jfvilas.github.io/kwirth</a></Typography>
                    <Typography><b>Project: </b><a href='https://github.com/jfvilas/kwirth' target='blank' rel='noreferer'>https://github.com/jfvilas/kwirth</a></Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Stack direction='row' flex={1} sx={{ml:2, mr:2}}>
                    <Typography sx={{ flexGrow:1}}></Typography>
                    <Button onClick={props.onClose}>OK</Button>
                </Stack>
            </DialogActions>
        </Dialog>
    </>)
}

export { About }
