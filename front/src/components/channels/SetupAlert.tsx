import React, { useState, ChangeEvent } from 'react'
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, Stack, TextField } from '@mui/material'
import { Settings } from '../../model/Settings'
import { AlertObject } from '../../model/AlertObject'
import { IChannelObject } from '../../model/ITabObject'

interface IProps {
    onClose:(regexInfo:string[], regexWarning:string[], regexError:string[], maxAlerts:number) => {}
    channelObject : IChannelObject
    settings: Settings
}

const SetupAlert: React.FC<any> = (props:IProps) => {
    var dataAlert = props.channelObject.data as AlertObject
    const [info, setInfo] = useState('')
    const [warning, setWarning] = useState('')
    const [error, setError] = useState('')
    const [regexInfo, setRegexInfo] = useState(dataAlert.regexInfo)
    const [regexWarning, setRegexWarning] = useState(dataAlert.regexWarning)
    const [regexError, setRegexError] = useState(dataAlert.regexError)
    const [maxAlerts, setMaxAlerts] = useState(props.settings.alertMaxAlerts)

    const onChangeRegexInfo = (event:ChangeEvent<HTMLInputElement>) => {
        setInfo(event.target.value)
    }

    const addInfo = () => {
        if (info!=='') {
            setRegexInfo([...regexInfo,info])
            setInfo('')
        }
    }

    const deleteChipInfo = (e:string) => {
        setRegexInfo(regexInfo.filter(ri => ri!==e))
    }

    const onChangeRegexWarning = (event:ChangeEvent<HTMLInputElement>) => {
        setWarning(event.target.value)
    }

    const addWarning = () => {
        if (warning!=='') {
            setRegexWarning([...regexWarning,warning])
            setWarning('')
        }
    }

    const deleteChipWarning = (e:string) => {
        setRegexWarning(regexWarning.filter(ri => ri!==e))
    }

    const onChangeRegexError = (event:ChangeEvent<HTMLInputElement>) => {
        setError(event.target.value)
    }

    const addError = () => {
        if (error!=='') {
            setRegexError([...regexError,error])
            setError('')
        }
    }

    const deleteChipError = (e:string) => {
        setRegexError(regexError.filter(ri => ri!==e))
    }

    const onChangeMaxAlerts = (event:ChangeEvent<HTMLInputElement>) => {
        setMaxAlerts(+event.target.value)
    }

    return (<>
        <Dialog open={true}>
            <DialogTitle>Create alert</DialogTitle>
            <DialogContent>
                <Stack direction={'column'} spacing={1}>
                    <TextField value={maxAlerts} onChange={onChangeMaxAlerts} variant='standard'label='Max alerts' SelectProps={{native: true}} type='number'></TextField>
                    
                    <Stack direction={'row'} spacing={3}>
                        <Stack direction={'column'} spacing={1}>
                            <Stack direction={'row'}>
                                <TextField value={info} onChange={onChangeRegexInfo} label='Info' variant='standard'></TextField>
                                <Button onClick={addInfo} size='small'>Add</Button>
                            </Stack>
                            <Grid>
                                {
                                    regexInfo.map ((ri,index) => { return <Grid key={index} item><Chip label={ri} variant='outlined' onDelete={() => deleteChipInfo(ri)}/></Grid>})
                                }
                            </Grid>
                        </Stack>
                        <Stack direction={'column'} spacing={1}>
                            <Stack direction={'row'}>
                                <TextField value={warning} onChange={onChangeRegexWarning} label='Warning' variant='standard'></TextField>
                                <Button onClick={addWarning} size='small'>Add</Button>
                            </Stack>
                            <Grid>
                                {
                                    regexWarning.map ((ri,index) => { return <Grid key={index} item><Chip label={ri} variant='outlined' onDelete={() => deleteChipWarning(ri)}/></Grid>})
                                }
                            </Grid>
                        </Stack>
                        <Stack direction={'column'} spacing={1}>
                            <Stack direction={'row'}>
                                <TextField value={error} onChange={onChangeRegexError} variant='standard' label='Error'></TextField>
                                <Button onClick={addError} size='small'>Add</Button>
                            </Stack>
                            <Grid>
                                {
                                    regexError.map ((ri,index) => { return <Grid key={index} item><Chip label={ri} variant='outlined' onDelete={() => deleteChipError(ri)}/></Grid>})
                                }
                            </Grid>
                        </Stack>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => props.onClose(regexInfo,regexWarning,regexError,maxAlerts)} disabled={regexInfo.length===0 && regexWarning.length===0 && regexError.length===0}>OK</Button>
                <Button onClick={() => props.onClose([],[],[],0)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { SetupAlert }