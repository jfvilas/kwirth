import React, { useState, ChangeEvent, useRef } from 'react'
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { IAlertInstanceConfig, IAlertUiConfig } from './AlertConfig'
import { Warning } from '@mui/icons-material'

const AlertIcon = <Warning />

const AlertSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let alertUiConfig:IAlertUiConfig = props.channelObject?.uiConfig
    let alertInstanceConfig:IAlertInstanceConfig = props.channelObject?.instanceConfig
    
    const [info, setInfo] = useState('')
    const [warning, setWarning] = useState('')
    const [error, setError] = useState('')
    const [regexInfo, setRegexInfo] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexInfo : alertInstanceConfig.regexInfo)
    const [regexWarning, setRegexWarning] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexWarning : alertInstanceConfig.regexWarning)
    const [regexError, setRegexError] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexError : alertInstanceConfig.regexError)
    const [maxAlerts, setMaxAlerts] = useState<number>(props.uiSettings? props.uiSettings.maxAlerts : alertUiConfig.maxAlerts)
    const defaultRef = useRef<any>(null)

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

    const ok = () => {
        alertUiConfig.maxAlerts = maxAlerts
        alertInstanceConfig.regexInfo = regexInfo
        alertInstanceConfig.regexWarning = regexWarning
        alertInstanceConfig.regexError = regexError
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked)
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
                            <Stack>{
                                regexInfo && regexInfo.map ((ri,index) => { 
                                    return <Box key={index}><Chip label={ri} variant='outlined' onDelete={() => deleteChipInfo(ri)}/></Box>
                                })
                            }</Stack>
                        </Stack>
                        <Stack direction={'column'} spacing={1}>
                            <Stack direction={'row'}>
                                <TextField value={warning} onChange={onChangeRegexWarning} label='Warning' variant='standard'></TextField>
                                <Button onClick={addWarning} size='small'>Add</Button>
                            </Stack>
                            <Stack>{
                                regexWarning && regexWarning.map ((ri,index) => { return <Box key={index}><Chip label={ri} variant='outlined' onDelete={() => deleteChipWarning(ri)}/></Box>})
                            }</Stack>
                        </Stack>
                        <Stack direction={'column'} spacing={1}>
                            <Stack direction={'row'}>
                                <TextField value={error} onChange={onChangeRegexError} variant='standard' label='Error'></TextField>
                                <Button onClick={addError} size='small'>Add</Button>
                            </Stack>
                            <Stack>{
                                regexError && regexError.map ((ri,index) => { return <Box key={index}><Chip label={ri} variant='outlined' onDelete={() => deleteChipError(ri)}/></Box>})
                            }</Stack>
                        </Stack>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }}/>} label='Set as default' sx={{width:'100%', ml:'8px'}}/>
                <Button onClick={ok} disabled={regexInfo.length===0 && regexWarning.length===0 && regexError.length===0}>OK</Button>
                <Button onClick={() => props.onChannelSetupClosed(props.channel, false, false)}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    </>)
}

export { AlertSetup, AlertIcon }