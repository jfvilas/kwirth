import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormLabel, IconButton, Radio, RadioGroup, Stack, Tooltip } from '@mui/material'
import { HelpOutline, Terminal } from '@mui/icons-material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { SdsfConfig, SdsfInstanceConfig } from './SdsfConfig'
import { ESdsfDisplay, ESdsfModel, ISdsfInstanceConfig } from '../common/SdsfTypes'

const SdsfIcon = <Terminal />

// SDSF's documentation is its README on GitHub; this is the section about the terminal.
const HELP_URL = 'https://github.com/jfvilas/kwirth/tree/master/plugins/sdsf#the-terminal'

const MODELS: { model: ESdsfModel; label: string }[] = [
    { model: ESdsfModel.MODEL2, label: '3278-2 (24x80)' },
    { model: ESdsfModel.MODEL3, label: '3278-3 (32x80)' },
    { model: ESdsfModel.MODEL5, label: '3278-5 (27x132)' }
]

const DISPLAYS: { display: ESdsfDisplay; label: string }[] = [
    { display: ESdsfDisplay.COLOR, label: 'Colour (3279)' },
    { display: ESdsfDisplay.GREEN, label: 'Green phosphor (3278)' }
]

/*
    Asked when the channel starts: the terminal SDSF runs on. It is a new session each time (a new logon), so
    changing the model is stopping and starting again.
*/
const SdsfSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const previous: Partial<ISdsfInstanceConfig> = props.setupConfig?.channelInstanceConfig ?? {}
    const config: SdsfConfig = props.setupConfig?.channelConfig || new SdsfConfig()
    const [model, setModel] = useState<ESdsfModel>(MODELS.find(m => m.model === previous.model)?.model ?? ESdsfModel.MODEL3)
    const [display, setDisplay] = useState<ESdsfDisplay>(DISPLAYS.find(d => d.display === previous.display)?.display ?? ESdsfDisplay.COLOR)
    const defaultRef = useRef<HTMLInputElement | null>(null)

    const ok = () => {
        const instanceConfig = new SdsfInstanceConfig()
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
                <span style={{ flex: 1 }}>SDSF terminal</span>
                <Tooltip title='Help'>
                    <IconButton size='small' onClick={() => window.open(HELP_URL, '_blank')}><HelpOutline fontSize='small' /></IconButton>
                </Tooltip>
            </DialogTitle>
            <DialogContent sx={{ overflow: 'hidden' }}>
                <Stack direction='row' spacing={4} sx={{ mt: 1 }}>
                    <Stack>
                        <FormLabel id='sdsf-model'>Model</FormLabel>
                        <RadioGroup aria-labelledby='sdsf-model' value={model} onChange={e => setModel(e.target.value as ESdsfModel)}>
                            {MODELS.map(m => <FormControlLabel key={m.model} value={m.model} control={<Radio size='small' />} label={m.label} />)}
                        </RadioGroup>
                    </Stack>
                    <Stack>
                        <FormLabel id='sdsf-display'>Display</FormLabel>
                        <RadioGroup aria-labelledby='sdsf-display' value={display} onChange={e => setDisplay(e.target.value as ESdsfDisplay)}>
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

export { SdsfSetup, SdsfIcon }
