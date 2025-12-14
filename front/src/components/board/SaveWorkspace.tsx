import { useState } from 'react'
import { Stack, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material'

interface IProps {
    onClose:(name?:string, description?:string) => void
    name:string
    description:string
    values:IValue[]
}

interface IValue {
    name:string,
    description:string
}

const SaveWorkspace: React.FC<IProps> = (props:IProps) => {
    const [newname, setNewname] = useState(props.name)
    const [desc, setDesc] = useState(props.description)

    return (
        <Dialog open={true} disableRestoreFocus={true}>
            <DialogTitle>
                Save board as...
            </DialogTitle>
            <DialogContent >
                <DialogContentText>
                    <Stack direction='column' spacing={2} sx={{width:'40vh'}}>
                        <TextField value={newname} onChange={(e) => setNewname(e.target.value)} variant='standard' label='New name' autoFocus ></TextField>
                        <TextField value={desc} onChange={(e) => setDesc(e.target.value)} variant='standard' label='Description' ></TextField>
                    </Stack>
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(newname, desc)} disabled={Boolean(props.values.find(b => b.name === newname))}>OK</Button>
                <Button onClick={() => props.onClose()}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { SaveWorkspace }