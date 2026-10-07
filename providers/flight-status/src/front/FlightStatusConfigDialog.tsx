import React, { useEffect, useState } from 'react'
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    FormControlLabel, LinearProgress, Stack, Switch, TextField, Typography
} from '@mui/material'
import { IFlightStatusConfig, ISourceStatus, PROVIDER_ID } from '../common/FlightStatus'
import { validateConfig } from '../common/Validation'
import SecretField from './SecretField'

/** What the core hands to the extension UI: with this it talks to its own back. */
interface IFlightStatusConfigDialogProps {
    onClose: () => void
    backendUrl: string
    accessString: string
}

interface IQuotaRowProps {
    s: ISourceStatus
}

// Talks to the provider's configRouter, which the core mounts behind accessKey validation.
const base = (backendUrl: string) => `${backendUrl}/core/providerconfig/${PROVIDER_ID}`

const headers = (accessString: string) => ({
    Authorization: accessString ? `Bearer ${accessString}` : '',
    'Content-Type': 'application/json',
    'X-Kwirth-App': 'true'
})

// An empty number field is sent as NaN on purpose, so that validation reports it instead of saving 0.
const num = (v: string) => (v.trim() === '' ? NaN : Number(v))

const QuotaRow: React.FC<IQuotaRowProps> = ({ s }) => {
    const pct = Math.min(100, (s.used / s.limit) * 100)
    const paused = s.breaker !== null && s.breaker.openUntil > Date.now()
    const decimals = s.limit < 50 ? 3 : 0
    return <Box>
        <Stack direction='row' justifyContent='space-between'>
            <Typography variant='body2'><b>{s.sourceId}</b> · {s.period}</Typography>
            <Typography variant='body2'>
                {s.used.toFixed(decimals)} / {s.limit} (paced up to {s.allowedNow.toFixed(decimals)})
            </Typography>
        </Stack>
        <LinearProgress variant='determinate' value={pct} color={s.exhausted ? 'error' : pct > 80 ? 'warning' : 'primary'} />
        {s.exhausted && <Typography variant='caption' color='error'>Exhausted until the next period</Typography>}
        {paused && <Typography variant='caption' color='warning.main'>Paused: {s.breaker?.lastError}</Typography>}
    </Box>
}

const FlightStatusConfigDialog: React.FC<IFlightStatusConfigDialogProps> = ({ onClose, backendUrl, accessString }) => {
    const [config, setConfig] = useState<IFlightStatusConfig | undefined>()
    const [status, setStatus] = useState<ISourceStatus[]>([])
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<string[]>([])

    const loadStatus = () => fetch(`${base(backendUrl)}/status`, { headers: headers(accessString) })
        .then(r => r.ok ? r.json() : [])
        .then(setStatus)
        .catch(() => setStatus([]))

    useEffect(() => {
        fetch(`${base(backendUrl)}/config`, { headers: headers(accessString) })
            .then(async r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`)
                setConfig(await r.json())
            })
            .catch(err => setErrors([`Could not load configuration: ${err}`]))
        loadStatus()
        const t = setInterval(loadStatus, 10_000)
        return () => clearInterval(t)
    }, [])

    const set = (fn: (c: IFlightStatusConfig) => void) => {
        if (!config) return
        const next = structuredClone(config)
        fn(next)
        setConfig(next)
    }

    const save = async () => {
        if (!config) return
        const local = validateConfig(config)
        if (local.length > 0) return setErrors(local)

        setSaving(true)
        setErrors([])
        try {
            const r = await fetch(`${base(backendUrl)}/config`, { method: 'PUT', headers: headers(accessString), body: JSON.stringify(config) })
            const body = await r.json().catch(() => ({}))
            if (!r.ok) return setErrors(body.errors ?? [`HTTP ${r.status}`])
            // Saved and applied: nothing left to decide here. On failure the dialog stays open with the error.
            onClose()
        }
        catch (err) {
            setErrors([String(err)])
        }
        finally {
            setSaving(false)
        }
    }

    return <Dialog open maxWidth={false} sx={{ '& .MuiDialog-paper': { width: '640px', height: '640px' } }}>
        <DialogTitle>Flight Status Provider</DialogTitle>
        <DialogContent>
            {!config && (errors.length > 0 ? <Alert severity='error'>{errors[0]}</Alert> : <CircularProgress />)}
            {config && <Stack spacing={2} sx={{ mt: 1 }}>
                <Typography variant='subtitle2'>OpenSky Network (live positions)</Typography>
                <Stack direction='row' spacing={1}>
                    <TextField size='small' label='Client ID' fullWidth value={config.opensky.clientId}
                        helperText='Empty = anonymous (fewer credits)'
                        slotProps={{ htmlInput: { autoComplete: 'off' } }}
                        onChange={e => set(c => { c.opensky.clientId = e.target.value })} />
                    <SecretField label='Client secret' value={config.opensky.clientSecret}
                        onChange={v => set(c => { c.opensky.clientSecret = v })} />
                </Stack>
                <TextField size='small' label='Daily credits' type='number' value={config.opensky.dailyCredits}
                    helperText='0 = automatic (400 anonymous / 4000 with credentials)'
                    onChange={e => set(c => { c.opensky.dailyCredits = num(e.target.value) })} />

                <Divider />
                <FormControlLabel label={<Typography variant='subtitle2'>AviationStack (enrichment)</Typography>}
                    control={<Switch checked={config.aviationstack.enabled} onChange={e => set(c => { c.aviationstack.enabled = e.target.checked })} />} />
                <Stack direction='row' spacing={1}>
                    <SecretField label='Access key' value={config.aviationstack.accessKey}
                        onChange={v => set(c => { c.aviationstack.accessKey = v })} />
                    <TextField size='small' label='Requests / month' type='number' sx={{ width: 180, flexShrink: 0 }} value={config.aviationstack.monthlyRequests}
                        onChange={e => set(c => { c.aviationstack.monthlyRequests = num(e.target.value) })} />
                </Stack>

                <Divider />
                <FormControlLabel label={<Typography variant='subtitle2'>FlightAware AeroAPI (enrichment)</Typography>}
                    control={<Switch checked={config.aeroapi.enabled} onChange={e => set(c => { c.aeroapi.enabled = e.target.checked })} />} />
                <SecretField label='API key' value={config.aeroapi.apiKey}
                    onChange={v => set(c => { c.aeroapi.apiKey = v })} />
                <Stack direction='row' spacing={1}>
                    <TextField size='small' label='Monthly budget (USD)' type='number' fullWidth value={config.aeroapi.monthlyBudgetUsd}
                        onChange={e => set(c => { c.aeroapi.monthlyBudgetUsd = num(e.target.value) })} />
                    <TextField size='small' label='Cost per call (USD)' type='number' fullWidth value={config.aeroapi.costPerCallUsd}
                        onChange={e => set(c => { c.aeroapi.costPerCallUsd = num(e.target.value) })} />
                </Stack>

                <Divider />
                <Stack direction='row' spacing={1}>
                    <TextField size='small' label='Positions cache (s)' type='number' fullWidth value={config.positionTtlSec}
                        onChange={e => set(c => { c.positionTtlSec = num(e.target.value) })} />
                    <TextField size='small' label='Details cache (h)' type='number' fullWidth value={config.detailsTtlHours}
                        onChange={e => set(c => { c.detailsTtlHours = num(e.target.value) })} />
                </Stack>

                <Divider />
                <Typography variant='subtitle2'>Quota (in memory, since this Kwirth started)</Typography>
                {status.length === 0 && <Typography variant='body2' color='text.secondary'>No data yet</Typography>}
                {status.map(s => <QuotaRow key={s.sourceId} s={s} />)}

            </Stack>}
        </DialogContent>
        {/* Outside the scrolling content, right above the buttons: a rejected Save is always seen where it was pressed */}
        {config && errors.length > 0 && <Box sx={{ px: 3, pt: 1 }}>
            <Alert severity='error'>{errors.map((e, i) => <div key={i}>{e}</div>)}</Alert>
        </Box>}
        <DialogActions>
            <Button variant='contained' disabled={!config || saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button onClick={onClose}>Cancel</Button>
        </DialogActions>
    </Dialog>
}

export default FlightStatusConfigDialog
