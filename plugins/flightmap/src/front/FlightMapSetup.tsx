import React, { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { ISetupProps } from '@kwirthmagnify/kwirth-common-front'
import { IBBox, IFlightMapInstanceConfig } from '../common/FlightMapTypes'
import { AREAS, creditsPerCall, FlightMapInstanceConfig } from './FlightMapData'

export const FlightMapIcon = (
    <svg viewBox='0 0 24 24' width='1em' height='1em' fill='currentColor' style={{ fontSize: '1.5rem' }}>
        <path d='M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z' />
    </svg>
)

const CUSTOM = 'custom'

const sameBox = (a: IBBox, b: IBBox) => a.lamin === b.lamin && a.lomin === b.lomin && a.lamax === b.lamax && a.lomax === b.lomax

export const FlightMapSetup: React.FC<ISetupProps> = (props: ISetupProps) => {
    const instanceConfig: IFlightMapInstanceConfig = props.setupConfig?.channelInstanceConfig || new FlightMapInstanceConfig()
    const [bbox, setBbox] = useState<IBBox>({ ...instanceConfig.bbox })
    const [area, setArea] = useState(AREAS.find(a => sameBox(a.bbox, instanceConfig.bbox))?.name ?? CUSTOM)
    const [intervalSec, setIntervalSec] = useState(instanceConfig.intervalSec)
    const [watch, setWatch] = useState(instanceConfig.watch.join(', '))
    const defaultRef = useRef<HTMLInputElement | null>(null)

    const selectArea = (name: string) => {
        setArea(name)
        const found = AREAS.find(a => a.name === name)
        if (found) setBbox({ ...found.bbox })
    }

    const setCorner = (key: keyof IBBox, value: string) => {
        setArea(CUSTOM)
        setBbox({ ...bbox, [key]: Number(value) })
    }

    const invalidBox = !(bbox.lamin < bbox.lamax && bbox.lomin < bbox.lomax) || [bbox.lamin, bbox.lamax].some(v => v < -90 || v > 90) || [bbox.lomin, bbox.lomax].some(v => v < -180 || v > 180)
    const invalidInterval = !Number.isFinite(intervalSec) || intervalSec < 10
    const credits = invalidBox ? 0 : creditsPerCall(bbox)
    const perDay = invalidInterval || invalidBox ? 0 : Math.ceil(86400 / intervalSec) * credits

    const ok = () => {
        const chosen: IFlightMapInstanceConfig = {
            bbox,
            intervalSec,
            watch: watch.split(/[\s,;]+/).map(w => w.trim().toUpperCase()).filter(Boolean)
        }
        props.onChannelSetupClosed(props.channel, {
            channelId: props.channel.channelId,
            channelConfig: {},
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
        <Dialog open={true} maxWidth='sm' fullWidth>
            <DialogTitle>Configure Flight Map channel</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ m: 1 }}>
                    <TextField select label='Area' variant='standard' value={area} onChange={e => selectArea(e.target.value)}>
                        {AREAS.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                        <MenuItem value={CUSTOM}>Custom</MenuItem>
                    </TextField>
                    <Stack direction='row' spacing={1}>
                        {(['lamin', 'lamax', 'lomin', 'lomax'] as (keyof IBBox)[]).map(k =>
                            <TextField key={k} label={{ lamin: 'Lat min', lamax: 'Lat max', lomin: 'Lon min', lomax: 'Lon max' }[k]} type='number' variant='standard'
                                value={bbox[k]} onChange={e => setCorner(k, e.target.value)} error={invalidBox} slotProps={{ htmlInput: { step: 0.1 } }} />
                        )}
                    </Stack>
                    <TextField label='Seconds between updates' type='number' variant='standard' value={intervalSec}
                        onChange={e => setIntervalSec(Number(e.target.value))} error={invalidInterval}
                        helperText={invalidInterval ? 'At least 10 seconds'
                            : `${credits} OpenSky credit(s) per call · about ${perDay} a day (400 anonymous, 4000 with credentials)`} />
                    <TextField label='Flights to follow (ICAO callsigns)' variant='standard' value={watch} onChange={e => setWatch(e.target.value)}
                        placeholder='IBE3171, VLG1001' helperText='Origin, destination and delays are fetched only for these, from AviationStack or FlightAware if configured in the provider' />
                    <Typography variant='caption' color='text.secondary'>
                        Positions come from OpenSky through the flight-status provider. Its credentials and quotas are set on the provider card.
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <FormControlLabel control={<Checkbox slotProps={{ input: { ref: defaultRef } }} />} label='Set as default' sx={{ width: '100%', ml: '8px' }} />
                <Button variant='outlined' onClick={ok} disabled={invalidBox || invalidInterval}>OK</Button>
                <Button variant='outlined' onClick={cancel}>CANCEL</Button>
            </DialogActions>
        </Dialog>
    )
}
