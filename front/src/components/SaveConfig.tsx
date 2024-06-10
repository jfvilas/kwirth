import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography, TextField } from '@mui/material';
import { ChangeEvent, useState } from 'react';

interface IProps {
    onClose:(a:string|null) => {},
    name:string
}
const SaveConfig: React.FC<any> = (props:IProps) => {
    const [newname, setNewname] = useState(props.name);

    const onChangeNewname = (event:ChangeEvent<HTMLInputElement>) => {
        setNewname(event.target.value);
    }
  
    return (
        <Dialog open={true} disableRestoreFocus={true}>
            <DialogTitle>
                Save config as...
            </DialogTitle>
            <DialogContent>
                <DialogContentText>
                    <Stack direction='row' alignItems={'center'}>
                        <TextField value={newname} onChange={onChangeNewname} variant='standard'label='New name' autoFocus></TextField>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(newname)} disabled={newname===props.name}>OK</Button>
                <Button onClick={() => props.onClose(null)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export default SaveConfig;