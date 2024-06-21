import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
import { Error } from '@mui/icons-material';
import { Alarm, AlarmSeverity } from '../model/Alarm';

interface IProps {
    onClose:() => {},
    alarm:Alarm
}

const BlockingAlarm: React.FC<any> = (props:IProps) => {
    
    return (
        <Dialog open={true}>
            <DialogTitle>
                Blocking alarm received
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='row' alignItems={'center'}>
                        { props.alarm.severity===AlarmSeverity.error && <Error fontSize='large' color='error'/>}
                        { props.alarm.severity===AlarmSeverity.warning && <Error fontSize='large' color='warning'/>}
                        { props.alarm.severity===AlarmSeverity.success && <Error fontSize='large' color='info'/>}
                        { props.alarm.severity===AlarmSeverity.info && <Error fontSize='large' color='info'/>}
                        { props.alarm.severity===AlarmSeverity.default && <Error fontSize='large' color='primary'/>}
                        <Typography sx={{ml:1}}>{props.alarm.message}</Typography>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose()}>OK</Button>
            </DialogActions>
        </Dialog>
    )
}

export default BlockingAlarm;