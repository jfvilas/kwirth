import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material'
import { ISetupProps } from '../IChannel'
import { ITrivyConfig, ITrivyInstanceConfig, TrivyConfig, TrivyInstanceConfig } from './TrivyConfig'
import { VerifiedUser } from '@mui/icons-material'
import { MsgBoxOk, MsgBoxOkError } from '../../tools/MsgBox'
import { addGetAuthorization } from '../../tools/AuthorizationManagement'
import { TrivyOperator } from './TrivyOperator'
import { ITrivyData } from './TrivyData'

const TrivyIcon = <VerifiedUser />

const TrivySetup: React.FC<ISetupProps> = (props:ISetupProps) => {
    let trivyInstanceConfig:ITrivyInstanceConfig = props.setupConfig?.channelInstanceConfig || new TrivyInstanceConfig()
    let trivyConfig:ITrivyConfig = props.setupConfig?.channelConfig || new TrivyConfig()
    let trivyData:ITrivyData = props.channelObject.data as ITrivyData
    
    const [maxCritical, setMaxCritical] = useState(trivyInstanceConfig.maxCritical)
    const [maxHigh, setMaxHigh] = useState(trivyInstanceConfig.maxHigh)
    const [maxMedium, setMaxMedium] = useState(trivyInstanceConfig.maxMedium)
    const [maxLow, setMaxLow] = useState(trivyInstanceConfig.maxLow)
    const [msgBox, setMsgBox] =useState(<></>)
    const [showOperatorManage, setShowOperatorManage]=useState<boolean>(false)
    const defaultRef = useRef<HTMLInputElement|null>(null)

    const ok = () =>{
        trivyInstanceConfig.maxCritical = maxCritical
        trivyInstanceConfig.maxHigh = maxHigh
        trivyInstanceConfig.maxMedium = maxMedium
        trivyInstanceConfig.maxLow = maxLow
        props.onChannelSetupClosed(props.channel,
        {
            channelId: props.channel.channelId,
            channelConfig: trivyConfig,
            channelInstanceConfig: trivyInstanceConfig
        }, true, defaultRef.current?.checked || false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, 
        {
            channelId: props.channel.channelId,
            channelConfig: undefined,
            channelInstanceConfig:undefined
        }, false, false)
    }

    const onOperatorManageClosed = async (action?:string) => {
        setShowOperatorManage(false)
        if (action) {
            let result = await fetch (`${props.channelObject.clusterUrl}/${trivyData.ri}/channel/trivy/operator?action=${action}`, addGetAuthorization(props.channelObject.accessString!))
            
            if (result.status === 200) {
                setMsgBox(MsgBoxOk('Trivy',`Action ${action} succesfully sent, check results on your cluster.`, setMsgBox))
            }
            else {
                setMsgBox(MsgBoxOkError('Trivy',`Trivy action has shown some errors: ${result.text()}.`, setMsgBox))
            }
        }
    }

    return (<>
        <Dialog open={true} maxWidth={false} sx={{'& .MuiDialog-paper': { width: '28vw', minWidth:'500px', maxWidth: '50vw', height:'55vh'}}}>
            <DialogTitle>Configure Trivy channel</DialogTitle>
            <DialogContent>
                <Stack direction={'column'} justifyContent={'space-between'} height={'100%'}>
                    <Stack spacing={2} direction={'column'} sx={{ mt:'16px' }}>
                        <Typography>Set maximum number of accepted issues on each category:</Typography>
                        <Stack direction={'column'}>
                            <Stack direction={'row'} alignItems={'center'}>
                                <Typography width={'90px'}></Typography>
                                <Typography sx={{width:'8.3%'}}>0</Typography>
                                <Typography sx={{width:'8.3%'}}>1</Typography>
                                <Typography sx={{width:'8.3%'}}>2</Typography>
                                <Typography sx={{width:'8.3%'}}>3</Typography>
                                <Typography sx={{width:'8.3%'}}>4</Typography>
                                <Typography sx={{width:'8.3%'}}>5</Typography>
                            </Stack>
                            <RadioGroup defaultValue={'none'} value={maxCritical} onChange={(event) => setMaxCritical(+event.target.value)}>
                                <Stack direction={'row'} alignItems={'center'}>
                                    <Typography fontWeight={800} width={'80px'}>Critical</Typography>
                                    <Radio value='0' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Radio value='1' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Radio value='2' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Radio value='3' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Radio value='4' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Radio value='5' disabled={maxCritical<0} sx={{width:'8%'}}/>
                                    <Checkbox checked={maxCritical<0} onChange={() => maxCritical<0? setMaxCritical(0): setMaxCritical(-1)}/>Ignore
                                </Stack>
                            </RadioGroup>

                            <RadioGroup defaultValue={'none'} value={maxHigh} onChange={(event) => setMaxHigh(+event.target.value)}>
                                <Stack direction={'row'} alignItems={'center'}>
                                    <Typography fontWeight={800} width={'80px'}>High</Typography>
                                    <Radio value='0' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Radio value='1' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Radio value='2' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Radio value='3' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Radio value='4' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Radio value='5' disabled={maxHigh<0} sx={{width:'8%'}}/>
                                    <Checkbox checked={maxHigh<0} onChange={() => maxHigh<0? setMaxHigh(0): setMaxHigh(-1)}/>Ignore
                                </Stack>
                            </RadioGroup>

                            <RadioGroup defaultValue={'none'} value={maxMedium} onChange={(event) => setMaxMedium(+event.target.value)}>
                                <Stack direction={'row'} alignItems={'center'}>
                                    <Typography fontWeight={800} width={'80px'}>Medium</Typography>
                                    <Radio value='0' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Radio value='1' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Radio value='2' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Radio value='3' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Radio value='4' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Radio value='5' disabled={maxMedium<0} sx={{width:'8%'}}/>
                                    <Checkbox checked={maxMedium<0} onChange={() => maxMedium<0? setMaxMedium(0): setMaxMedium(-1)}/>Ignore
                                </Stack>
                            </RadioGroup>

                            <RadioGroup defaultValue={'none'} value={maxLow} onChange={(event) => setMaxLow(+event.target.value)}>
                                <Stack direction={'row'} alignItems={'center'}>
                                    <Typography fontWeight={800} width={'80px'}>Low</Typography>
                                    <Radio value='0' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Radio value='1' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Radio value='2' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Radio value='3' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Radio value='4' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Radio value='5' disabled={maxLow<0} sx={{width:'8%'}}/>
                                    <Checkbox checked={maxLow<0} onChange={() => maxLow<0? setMaxLow(0): setMaxLow(-1)}/>Ignore
                                </Stack>
                            </RadioGroup>
                        </Stack>
                    </Stack>
                    <Stack direction={'column'}>
                        <Typography>You can manage your cluster Trivy installation from Kwirth.</Typography>
                        <Typography fontSize={'10px'}>You need to start the channel at least once in order to be able to configure Trivy operator.</Typography>
                        <Button onClick={() => setShowOperatorManage(true)} disabled={!trivyData.ri}>Manage Trivy</Button>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }}/>} label='Set as default' sx={{width:'100%', ml:'8px'}}/>
                <Button onClick={ok}>OK</Button>
                <Button onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
        { showOperatorManage && <TrivyOperator onClose={onOperatorManageClosed} clusterUrl={props.channelObject.clusterUrl!} accessString={props.channelObject.accessString!} channelObject={props.channelObject}/> }
        { msgBox }
    </>)
}

export { TrivySetup, TrivyIcon }