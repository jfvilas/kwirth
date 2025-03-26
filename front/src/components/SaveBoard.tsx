import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { ChangeEvent, useState } from 'react';

interface IProps {
    onClose:(a?:string) => {},
    name:string
    desc:string
}

const SaveBoard: React.FC<any> = (props:IProps) => {
    const [newname, setNewname] = useState(props.name);
    const [desc, setDesc] = useState(props.desc);

    const onChangeNewname = (event:ChangeEvent<HTMLInputElement>) => {
        setNewname(event.target.value);
    }
  
    const onChangeDesc = (event:ChangeEvent<HTMLInputElement>) => {
        setDesc(event.target.value);
    }
  
    return (
        <Dialog open={true} disableRestoreFocus={true}>
            <DialogTitle>
                Save board as...
            </DialogTitle>
            <DialogContent >
                <DialogContentText>
                    <Stack direction='column' spacing={2} sx={{width:'40vh'}}>
                        <TextField value={newname} onChange={onChangeNewname} variant='standard' label='New name' autoFocus ></TextField>
                        <TextField value={desc} onChange={onChangeDesc} variant='standard' label='Description' ></TextField>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(newname)} disabled={newname===props.name}>OK</Button>
                <Button onClick={() => props.onClose(undefined)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export default SaveBoard;