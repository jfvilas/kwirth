// import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
// import { Error } from '@mui/icons-material';
// import { Alarm, AlarmSeverity } from '../model/Alarm';

// interface IProps {
//     onClose:() => {},
//     alarm:Alarm
// }

// const BlockingAlarm: React.FC<any> = (props:IProps) => {
    
//     return (
//         <Dialog open={true}>
//             <DialogTitle>
//                 Blocking alarm received
//             </DialogTitle>
//             <DialogContent>
//                 <DialogContentText>
//                     <Stack direction='row' alignItems={'center'}>
//                         { props.alarm.severity===AlarmSeverity.ERROR && <Error fontSize='large' color='error'/>}
//                         { props.alarm.severity===AlarmSeverity.WARNING && <Error fontSize='large' color='warning'/>}
//                         { props.alarm.severity===AlarmSeverity.SUCCESS && <Error fontSize='large' color='info'/>}
//                         { props.alarm.severity===AlarmSeverity.INFO && <Error fontSize='large' color='info'/>}
//                         { props.alarm.severity===AlarmSeverity.DEFAULT && <Error fontSize='large' color='primary'/>}
//                         <Typography sx={{ml:1}}>{props.alarm.message}</Typography>
//                     </Stack>
//                 </DialogContentText>
//             </DialogContent>
//             <DialogActions>
//                 <Button onClick={() => props.onClose()}>OK</Button>
//             </DialogActions>
//         </Dialog>
//     )
// }
export {}
// export default BlockingAlarm;