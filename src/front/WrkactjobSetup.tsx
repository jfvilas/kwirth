import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormLabel, IconButton, Radio, RadioGroup, Stack, Tooltip } from '@mui/material'
import { HelpOutline, Terminal } from '@mui/icons-material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { EDisplay } from '@jfvilas/kwirth-dce-blockterm'
import { WrkactjobConfig, WrkactjobInstanceConfig } from './WrkactjobConfig'
import { EWrkModel, IWrkactjobInstanceConfig } from '../common/WrkactjobTypes'

const WrkactjobIcon = <Terminal />

// WRKACTJOB's documentation is its README on GitHub; this is the section about the terminal.
const HELP_URL = 'https://github.com/jfvilas/kwirth/tree/master/plugins/wrkactjob#the-terminal'

const MODELS: { model: EWrkModel; label: string }[] = [
    { model: EWrkModel.MODEL_24X80, label: '3179-2 (24x80)' },
    { model: EWrkModel.MODEL_27X132, label: '3477-FC (27x132)' }
]

const DISPLAYS: { display: EDisplay; label: string }[] = [
    { display: EDisplay.COLOR, label: 'Colour' },
    { display: EDisplay.GREEN, label: 'Green monochrome (5251)' }
]

/*
    Asked when the channel starts (PRD D10): the 5250 WRKACTJOB runs on. It is a new session each time, so
    changing the model is stopping and starting again. The same dialog as SDSF's.
*/
const WrkactjobSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const previous: Partial<IWrkactjobInstanceConfig> = props.setupConfig?.channelInstanceConfig ?? {}
    const config: WrkactjobConfig = props.setupConfig?.channelConfig || new WrkactjobConfig()
    const [model, setModel] = useState<EWrkModel>(MODELS.find(m => m.model === previous.model)?.model ?? EWrkModel.MODEL_24X80)
    const [display, setDisplay] = useState<EDisplay>(DISPLAYS.find(d => d.display === previous.display)?.display ?? EDisplay.COLOR)
    const defaultRef = useRef<HTMLInputElement | null>(null)

    const ok = () => {
        const instanceConfig = new WrkactjobInstanceConfig()
        instanceConfig.model = model
        instanceConfig.display = display
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: config, channelInstanceConfig: instanceConfig }, true, defaultRef.current?.checked || false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, { channelId: props.channel.channelId, channelConfig: undefined, channelInstanceConfig: undefined }, false, false)
    }

    return (
        <Dialog open={true} maxWidth={false} PaperProps={{ sx: { width: 460, height: 340 } }}>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>WRKACTJOB terminal</span>
                <Tooltip title='Help'>
                    <IconButton size='small' onClick={() => window.open(HELP_URL, '_blank')}><HelpOutline fontSize='small' /></IconButton>
                </Tooltip>
            </DialogTitle>
            <DialogContent sx={{ overflow: 'hidden' }}>
                <Stack direction='row' spacing={4} sx={{ mt: 1 }}>
                    <Stack>
                        <FormLabel id='wrkactjob-model'>Model</FormLabel>
                        <RadioGroup aria-labelledby='wrkactjob-model' value={model} onChange={e => setModel(e.target.value as EWrkModel)}>
                            {MODELS.map(m => <FormControlLabel key={m.model} value={m.model} control={<Radio size='small' />} label={m.label} />)}
                        </RadioGroup>
                    </Stack>
                    <Stack>
                        <FormLabel id='wrkactjob-display'>Display</FormLabel>
                        <RadioGroup aria-labelledby='wrkactjob-display' value={display} onChange={e => setDisplay(e.target.value as EDisplay)}>
                            {DISPLAYS.map(d => <FormControlLabel key={d.display} value={d.display} control={<Radio size='small' />} label={d.label} />)}
                        </RadioGroup>
                    </Stack>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }} />} label='Set as default' sx={{ width: '100%', ml: '8px' }} />
                <Button variant='outlined' onClick={ok}>OK</Button>
                <Button variant='outlined' onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}

export { WrkactjobSetup, WrkactjobIcon }
