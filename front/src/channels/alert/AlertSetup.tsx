import React, { useState, ChangeEvent, useRef } from 'react'
import { Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { IAlertInstanceConfig, IAlertConfig } from './AlertConfig'
import { Warning } from '@mui/icons-material'
import { TextToolTip } from '../../tools/FrontTools'

const AlertIcon = <Warning />

const AlertSetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let alertConfig:IAlertConfig = props.channelObject?.config
    let alertInstanceConfig:IAlertInstanceConfig = props.channelObject?.instanceConfig
    
    const [info, setInfo] = useState('')
    const [warning, setWarning] = useState('')
    const [error, setError] = useState('')
    const [regexInfo, setRegexInfo] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexInfo : alertInstanceConfig.regexInfo)
    const [regexWarning, setRegexWarning] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexWarning : alertInstanceConfig.regexWarning)
    const [regexError, setRegexError] = useState<string[]>(props.instanceSettings? props.instanceSettings.regexError : alertInstanceConfig.regexError)
    const [maxAlerts, setMaxAlerts] = useState<number>(props.uiSettings? props.uiSettings.maxAlerts : alertConfig.maxAlerts)
    const defaultRef = useRef<HTMLInputElement|null>(null)

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
        alertConfig.maxAlerts = maxAlerts
        alertInstanceConfig.regexInfo = regexInfo
        alertInstanceConfig.regexWarning = regexWarning
        alertInstanceConfig.regexError = regexError
        props.onChannelSetupClosed(props.channel, true, defaultRef.current?.checked || false)
    }

    let help = <>
        Please enter here regular expressions (regex) that must<br/>
        match a message in order to be considered an alert of <br/>
        this category. Some examples are:<br/><br/>
        - ^HELLO - Messages that begin with word 'HELLO'<br/>
        - last$ - Messages that end with word 'last'<br/>
        - [ERROR] - Messages that contain the text '[ERROR]'<br/>
        - 5[0-9][0-9] - Messages contain a number between 500 - 599
        </>
        
    return (<>
        <Dialog open={true}>
            <DialogTitle>Create alert</DialogTitle>
            <DialogContent>
                <Stack direction={'column'} >
                    <TextField value={maxAlerts} onChange={onChangeMaxAlerts} variant='standard' label='Max alerts' SelectProps={{native: true}} type='number' sx={{mb:'8px'}}/>
                    
                    <Stack direction={'row'} spacing={1}>
                        <Stack direction={'column'}>
                            <TextToolTip name='Info' help={help} />
                            <Stack direction={'row'} alignItems={'baseline'}>
                                <TextField value={info} onChange={onChangeRegexInfo} variant='standard'></TextField>
                                <Button onClick={addInfo} size='small'>Add</Button>
                            </Stack>
                            <Stack mt={1}>{
                                regexInfo && regexInfo.map ((ri,index) => { 
                                    return <Box key={index}><Chip label={ri} variant='outlined' onDelete={() => deleteChipInfo(ri)} size='small'/></Box>
                                })
                            }</Stack>
                        </Stack>
                        <Stack direction={'column'}>
                            <TextToolTip name='Warning' help={help}/>
                            <Stack direction={'row'} alignItems={'baseline'}>
                                <TextField value={warning} onChange={onChangeRegexWarning} variant='standard'></TextField>
                                <Button onClick={addWarning} size='small'>Add</Button>
                            </Stack>
                            <Stack>{
                                regexWarning && regexWarning.map ((ri,index) => {
                                    return <Box key={index}><Chip label={ri} variant='outlined' size='small' onDelete={() => deleteChipWarning(ri)}/></Box>
                                })
                            }</Stack>
                        </Stack>
                        <Stack direction={'column'}>
                            <TextToolTip name='Error' help={help}/>
                            <Stack direction={'row'} alignItems={'baseline'}>
                                <TextField value={error} onChange={onChangeRegexError} variant='standard'></TextField>
                                <Button onClick={addError} size='small'>Add</Button>
                            </Stack>
                            <Stack>{
                                regexError && regexError.map ((ri,index) => { 
                                    return <Box key={index}><Chip label={ri} variant='outlined' size='small'onDelete={() => deleteChipError(ri)}/></Box>
                                })
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