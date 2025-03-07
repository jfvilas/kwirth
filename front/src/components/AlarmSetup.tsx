import React, { useState, ChangeEvent } from 'react'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

interface IProps {
    onClose:(regexInfo:string[], regexWarning:string[], regexError:string[]) => {}
    regexInfo: string[]
    regexWarning: string[]
    regexError: string[]
}

const AlarmSetup: React.FC<any> = (props:IProps) => {
    const [info, setInfo] = useState('')
    const [warning, setWarning] = useState('')
    const [error, setError] = useState('')
    const [regexInfo, setRegexInfo] = useState(props.regexInfo)
    const [regexWarning, setRegexWarning] = useState(props.regexWarning)
    const [regexError, setRegexError] = useState(props.regexError)

    const onChangeRegexInfo = (event:ChangeEvent<HTMLInputElement>) => {
        setInfo(event.target.value)
    }
    const addInfo = () => {
        setRegexInfo([...regexInfo,info])
        setInfo('')
    }
    const deleteChipInfo = (e:string) => {
        setRegexInfo(regexInfo.filter(ri => ri!==e))
    }

    const onChangeRegexWarning = (event:ChangeEvent<HTMLInputElement>) => {
        setWarning(event.target.value)
    }
    const addWarning = () => {
        setRegexWarning([...regexWarning,warning])
        setWarning('')
    }
    const deleteChipWarning = (e:string) => {
        setRegexWarning(regexWarning.filter(ri => ri!==e))
    }

    const onChangeRegexError = (event:ChangeEvent<HTMLInputElement>) => {
        setError(event.target.value)
    }
    const addError = () => {
        setRegexError([...regexError,error])
        setError('')
    }
    const deleteChipError = (e:string) => {
        setRegexError(regexError.filter(ri => ri!==e))
    }

    return (<>
        <Dialog open={true} >
            <DialogTitle>Create alarm</DialogTitle>
            <DialogContent>
                <Stack direction={'row'} spacing={3}>
                    <Stack direction={'column'}>
                        Info
                        <Stack direction={'row'}>
                            <TextField value={info} onChange={onChangeRegexInfo} variant='standard'></TextField>
                            <Button onClick={addInfo}>Add</Button>
                        </Stack>
                        {
                            regexInfo.map (ri => { return <Chip label={ri} variant='outlined' onDelete={() => deleteChipInfo(ri)}/>})
                        }
                    </Stack>
                    <Stack direction={'column'}>
                        Warning
                        <Stack direction={'row'}>
                            <TextField value={warning} onChange={onChangeRegexWarning} variant='standard'></TextField>
                            <Button onClick={addWarning}>Add</Button>
                        </Stack>
                        {
                            regexWarning.map (ri => { return <Chip label={ri} variant='outlined' onDelete={() => deleteChipWarning(ri)}/>})
                        }
                    </Stack>
                    <Stack direction={'column'}>
                        Error
                        <Stack direction={'row'}>
                            <TextField value={error} onChange={onChangeRegexError} variant='standard'></TextField>
                            <Button onClick={addError}>Add</Button>
                        </Stack>
                        {
                            regexError.map (ri => { return <Chip label={ri} variant='outlined' onDelete={() => deleteChipError(ri)}/>})
                        }
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(regexInfo,regexWarning,regexError)}>OK</Button>
                <Button onClick={() => props.onClose([],[],[])}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>);
};

export default AlarmSetup