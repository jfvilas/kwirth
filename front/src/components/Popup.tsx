import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material';
import { PopupConfig } from '../model/PopupConfig';

interface IProps {
    config:PopupConfig
}

const Popup: React.FC<any> = (props:IProps) => {
    return (
        <Dialog open={true}>
            <DialogTitle>
                {props.config.title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='column' alignItems={'center'}>
                        <Typography>{props.config.message}</Typography>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                {props.config.ok && <Button onClick={() => props.config.onClose('ok')}>ok</Button>}
                {props.config.yes && <Button onClick={() => props.config.onClose('yes')}>yes</Button>}
                {props.config.yestoall && <Button onClick={() => props.config.onClose('yestoall')}>yestoall</Button>}
                {props.config.no && <Button onClick={() => props.config.onClose('no')}>no</Button>}
                {props.config.notoall && <Button onClick={() => props.config.onClose('notoall')}>no to all</Button>}
                {props.config.cancel && <Button onClick={() => props.config.onClose('cancel')}>cancel</Button>}
            </DialogActions>
        </Dialog>
    )
}
export default Popup;