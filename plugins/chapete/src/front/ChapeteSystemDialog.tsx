import React, { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { DEFAULT_SYSTEM_PROMPT } from '../common/ChapeteTypes'

interface IChapeteSystemDialogProps {
    system: string
    onSave: (system: string) => void
    onClose: () => void
}

/**
 * The channel's system prompt. It is ONE for every user and every instance (PRD, RF8), so whatever is
 * saved here changes the next answer of everybody's chat.
 */
export const ChapeteSystemDialog: React.FC<IChapeteSystemDialogProps> = (props: IChapeteSystemDialogProps) => {
    const [system, setSystem] = useState(props.system)

    const save = () => {
        props.onSave(system)
        props.onClose()
    }

    return (
        <Dialog open={true} maxWidth={false} sx={{ '& .MuiDialog-paper': { width: '44vw', maxWidth: '44vw', height: '52vh', maxHeight: '52vh' } }}>
            <DialogTitle>Chapete system prompt</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Stack direction='column' spacing={2} sx={{ m: 1, flex: 1, minHeight: 0 }}>
                    <Typography variant='body2' color='text.secondary'>
                        What the model is told before every conversation. It is shared by everyone using this channel,
                        and it applies from the next question on. Leave it empty to use the default one.
                    </Typography>
                    <TextField value={system} onChange={(e) => setSystem(e.target.value)} variant='outlined' label='System prompt'
                        placeholder={DEFAULT_SYSTEM_PROMPT} multiline fullWidth
                        sx={{ flex: 1, minHeight: 0, '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start', overflow: 'auto' } }} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button variant='outlined' onClick={save}>SAVE</Button>
                <Button variant='outlined' onClick={props.onClose}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}
