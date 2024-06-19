import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
import { Error } from '@mui/icons-material';

const BlockingAlert: React.FC<any> = ({onClose, alert}) => {
    //+++ refactor 'alert' to class and create enums accordingly
    
    return (
        <Dialog open={true}>
            <DialogTitle>
                Blocking alert received
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='row' alignItems={'center'}>
                        { alert.severity==='error' && <Error fontSize='large' color='error'/>}
                        { alert.severity==='warning' && <Error fontSize='large' color='warning'/>}
                        { alert.severity==='success' && <Error fontSize='large' color='info'/>}
                        { alert.severity==='info' && <Error fontSize='large' color='info'/>}
                        { alert.severity==='default' && <Error fontSize='large' color='primary'/>}
                        <Typography sx={{ml:1}}>{alert.message}</Typography>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose()}>OK</Button>
            </DialogActions>
        </Dialog>
    )
}

export default BlockingAlert;