import React, { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from '@mui/material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { Forum } from '@kwirthmagnify/kwirth-common-front/icons'
import { ILlm } from '@kwirthmagnify/kwirth-common-ai'
import { LlmSelector } from '@kwirthmagnify/kwirth-common-ai/front'
import { ChapeteConfig, ChapeteInstanceConfig } from './ChapeteConfig'
import { IChapeteInstanceConfig } from '../common/ChapeteTypes'

export const ChapeteIcon = <Forum />

/**
 * The LLM and the temperature are chosen here and stay fixed for the session (PRD, RF1 and RF9): changing
 * them means stopping the channel and starting it again, which also starts a new conversation.
 */
export const ChapeteSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const instanceConfig: IChapeteInstanceConfig = props.setupConfig?.channelInstanceConfig || new ChapeteInstanceConfig()
    const config: ChapeteConfig = props.setupConfig?.channelConfig || new ChapeteConfig()

    const [llms, setLlms] = useState<ILlm[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [llmId, setLlmId] = useState(instanceConfig.llmId)
    const [temperature, setTemperature] = useState(instanceConfig.temperature)
    const defaultRef = useRef<HTMLInputElement | null>(null)

    // The LLMs are the core's: the same list its AI settings edit.
    useEffect(() => {
        const load = async () => {
            try {
                const response = await fetch(`${props.channelObject.clusterUrl}/core/aiconfig/llms`, {
                    headers: { 'Authorization': `Bearer ${props.channelObject.accessString}`, 'X-Kwirth-App': 'true' }
                })
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                const list: ILlm[] = await response.json()
                setLlms(list)
                // a remembered LLM that is gone is not offered as if it still existed; a single one is picked
                if (!list.some(l => l.id === llmId)) {
                    const only = list.length === 1 ? list[0] : undefined
                    setLlmId(only?.id ?? '')
                    if (only) setTemperature(only.temperature)
                }
            }
            catch (err) {
                setLoadError(`Could not read the LLMs configured in Kwirth: ${err instanceof Error ? err.message : String(err)}`)
            }
            setLoading(false)
        }
        load()
    }, [])

    const selectLlm = (id: string) => {
        setLlmId(id)
        // each LLM carries its own temperature in the core: it is the starting point, and can be changed here
        const llm = llms.find(l => l.id === id)
        if (llm) setTemperature(llm.temperature)
    }

    const invalidTemperature = (): boolean => !Number.isFinite(temperature) || temperature < 0 || temperature > 2

    const noLlms = !loading && llms.length === 0

    const statusText = (): string => {
        if (loading) return 'Reading the LLMs configured in Kwirth...'
        if (loadError) return loadError
        if (noLlms) return 'No LLMs configured. Configure them in Kwirth\'s AI settings, then open this setup again.'
        return 'The model and the temperature are fixed while the channel runs. To change them, stop the channel and start it again: the conversation starts over.'
    }

    const ok = () => {
        const chosen: IChapeteInstanceConfig = { llmId, temperature }
        props.onChannelSetupClosed(props.channel, {
            channelId: props.channel.channelId,
            channelConfig: config,
            channelInstanceConfig: chosen
        }, true, defaultRef.current?.checked || false)
    }

    const cancel = () => {
        props.onChannelSetupClosed(props.channel, {
            channelId: props.channel.channelId,
            channelConfig: undefined,
            channelInstanceConfig: undefined
        }, false, false)
    }

    return (
        <Dialog open={true} maxWidth={false} sx={{ '& .MuiDialog-paper': { width: '34vw', maxWidth: '34vw', height: '38vh', maxHeight: '38vh' } }}>
            <DialogTitle>Configure Chapete channel</DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Stack direction='column' spacing={2} sx={{ m: 1, flex: 1, minHeight: 0 }}>
                    <Typography variant='body2' color={loadError || noLlms ? 'warning.main' : 'text.secondary'}>
                        {statusText()}
                    </Typography>
                    <LlmSelector llms={llms} value={llmId} onChange={selectLlm} label='LLM' />
                    <TextField value={temperature} onChange={(e) => setTemperature(+e.target.value)} type='number' variant='standard'
                        label='Temperature' error={invalidTemperature()} disabled={llmId === ''}
                        slotProps={{ htmlInput: { step: 0.1, min: 0, max: 2 } }}
                        helperText={invalidTemperature() ? 'From 0 to 2' : 'Lower is more precise, higher is more creative'} fullWidth />
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }} />} label='Set as default' sx={{ width: '100%', ml: '8px' }} />
                <Button variant='outlined' onClick={ok} disabled={llmId === '' || invalidTemperature()}>OK</Button>
                <Button variant='outlined' onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}
