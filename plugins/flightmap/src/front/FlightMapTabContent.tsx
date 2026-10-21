import React, { useEffect, useRef, useState } from 'react'
import { Box, Chip, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import { IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { IAircraft, IFlightMapInstanceConfig } from '../common/FlightMapTypes'
import { feet, IFlightMapData, isWatched, knots } from './FlightMapData'
import { IMapMarker, TileMap } from './TileMap'

const WATCHED_COLOR = '#d32f2f'

const colorOf = (a: IAircraft, watched: boolean): string => {
    if (watched) return WATCHED_COLOR
    if (a.onGround) return '#757575'
    // higher is darker blue: a quick read of who is climbing out and who is cruising
    const alt = a.baroAltitudeM ?? a.geoAltitudeM ?? 0
    if (alt < 3000) return '#4fc3f7'
    if (alt < 8000) return '#1e88e5'
    return '#0d47a1'
}

const label = (a: IAircraft): string => a.callsign?.trim() || a.icao24

const timeOf = (iso?: string): string => {
    if (!iso) return '-'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const Row: React.FC<{ name: string, value?: string | number }> = ({ name, value }) =>
    value === undefined || value === '' ? null :
        <Stack direction='row' justifyContent='space-between' spacing={1}>
            <Typography variant='body2' color='text.secondary'>{name}</Typography>
            <Typography variant='body2' sx={{ textAlign: 'right' }}>{value}</Typography>
        </Stack>

export const FlightMapTabContent: React.FC<IContentProps> = (props: IContentProps) => {
    const data = props.channelObject.data as IFlightMapData
    const instanceConfig = props.channelObject.instanceConfig as IFlightMapInstanceConfig
    const [, forceRender] = useState(0)
    const [focus, setFocus] = useState<{ lat: number, lon: number, key: number } | undefined>(undefined)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerHeight, setContainerHeight] = useState(0)

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!containerRef.current) return
            setContainerHeight(window.innerHeight - containerRef.current.getBoundingClientRect().top)
        })
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [containerRef.current])

    const select = (id: string | undefined, center = false) => {
        data.selectedId = id
        const a = data.aircraft.find(x => x.icao24 === id)
        if (center && a) setFocus({ lat: a.lat, lon: a.lon, key: Date.now() })
        forceRender(n => n + 1)
    }

    if (!data.started) {
        return (
            <Stack ref={containerRef} alignItems='center' justifyContent='center' spacing={1} sx={{ width: '100%', height: `${containerHeight}px`, px: 4, textAlign: 'center' }}>
                <Typography variant='h6' color='text.secondary'>Flight Map not started</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 480 }}>Start the channel (tab settings ⚙ → Start), choose an area and the flights you want to follow.</Typography>
            </Stack>
        )
    }

    const watch = instanceConfig?.watch ?? []
    const markers: IMapMarker[] = data.aircraft.map(a => {
        const watched = isWatched(a, watch)
        return {
            id: a.icao24, lat: a.lat, lon: a.lon, shape: 'plane', rotation: a.trackDeg ?? 0, size: watched ? 1.4 : 1,
            color: colorOf(a, watched), title: `${label(a)} · ${feet(a.baroAltitudeM)} · ${knots(a.velocityMs)}`
        }
    })
    const watchedAircraft = data.aircraft.filter(a => isWatched(a, watch))
    const missing = watch.filter(w => !watchedAircraft.some(a => a.callsign?.trim().toUpperCase() === w))
    const others = [...data.aircraft].filter(a => !isWatched(a, watch)).sort((a, b) => label(a).localeCompare(label(b)))
    const selected = data.aircraft.find(a => a.icao24 === data.selectedId)
    const d = selected?.details

    const item = (a: IAircraft) =>
        <ListItemButton key={a.icao24} selected={a.icao24 === data.selectedId} onClick={() => select(a.icao24, true)}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorOf(a, isWatched(a, watch)), mr: 1, flexShrink: 0 }} />
            <ListItemText primary={label(a)}
                secondary={a.details ? `${a.details.origin?.iata ?? a.details.origin?.icao ?? '?'} → ${a.details.destination?.iata ?? a.details.destination?.icao ?? '?'}` : `${a.onGround ? 'On ground' : feet(a.baroAltitudeM)} · ${a.originCountry ?? ''}`}
                slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }} />
        </ListItemButton>

    return (
        <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: `${containerHeight}px`, p: 1, boxSizing: 'border-box' }}>
            <Stack direction='row' alignItems='center' spacing={1} sx={{ px: 1, pb: 1, flexWrap: 'wrap' }}>
                <Chip size='small' label={`${data.aircraft.length} aircraft`} />
                <Chip size='small' sx={{ bgcolor: WATCHED_COLOR, color: '#fff' }} label={`${watchedAircraft.length}/${watch.length} followed`} />
                <Chip size='small' variant='outlined' label={`Every ${instanceConfig?.intervalSec ?? '-'} s`} />
                <Typography variant='caption' color='text.secondary'>
                    {data.timestamp ? `Positions at ${new Date(data.timestamp).toLocaleTimeString()}` : 'Waiting for the first positions from the flight-status provider...'}
                </Typography>
            </Stack>
            {data.error && <Typography variant='body2' color='warning.main' sx={{ px: 1 }}>Provider: {data.error}</Typography>}
            {data.signals.map((s, i) => <Typography key={i} variant='body2' color='error' sx={{ px: 1 }}>{s}</Typography>)}

            <Stack direction='row' spacing={1} sx={{ flex: 1, minHeight: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0, borderRadius: 1, overflow: 'hidden' }}>
                    <TileMap markers={markers} bounds={instanceConfig.bbox} outline={instanceConfig.bbox} selectedId={data.selectedId} onSelect={id => select(id)} focus={focus} />
                </Box>
                <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {selected &&
                        <Box sx={{ p: 1, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>{label(selected)}{d?.flightIata ? ` · ${d.flightIata}` : ''}</Typography>
                            {d && <Typography variant='body2' sx={{ mb: 0.5 }}>{d.origin?.name ?? d.origin?.iata ?? '?'} → {d.destination?.name ?? d.destination?.iata ?? '?'}</Typography>}
                            <Row name='Altitude' value={selected.onGround ? 'On ground' : feet(selected.baroAltitudeM)} />
                            <Row name='Speed' value={knots(selected.velocityMs)} />
                            <Row name='Heading' value={selected.trackDeg !== undefined ? `${Math.round(selected.trackDeg)}°` : undefined} />
                            <Row name='Country' value={selected.originCountry} />
                            <Row name='Squawk' value={selected.squawk} />
                            <Row name='ICAO24' value={selected.icao24} />
                            {d && <>
                                <Row name='Airline' value={d.airline} />
                                <Row name='Status' value={d.status} />
                                <Row name='Departure' value={`${timeOf(d.actualDeparture ?? d.scheduledDeparture)}${d.departureDelayMin ? ` (+${d.departureDelayMin} min)` : ''}`} />
                                <Row name='Arrival' value={`${timeOf(d.estimatedArrival ?? d.scheduledArrival)}${d.arrivalDelayMin ? ` (+${d.arrivalDelayMin} min)` : ''}`} />
                                <Row name='Aircraft' value={[d.aircraftType, d.registration].filter(Boolean).join(' · ')} />
                                <Typography variant='caption' color='text.secondary'>Details from {d.source}</Typography>
                            </>}
                            {isWatched(selected, watch) && d === null && <Typography variant='caption' color='text.secondary'>No source knows this flight.</Typography>}
                            {isWatched(selected, watch) && d === undefined && <Typography variant='caption' color='text.secondary'>Details pending: no enrichment source configured, or out of quota.</Typography>}
                        </Box>
                    }
                    <List dense sx={{ flex: 1, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, py: 0 }}>
                        {watch.length > 0 && <Typography variant='overline' sx={{ px: 1.5 }}>Followed</Typography>}
                        {watchedAircraft.map(item)}
                        {missing.map(w => <ListItemText key={w} sx={{ px: 1.5 }} primary={w} secondary='Not in the area right now' />)}
                        {watch.length > 0 && <Typography variant='overline' sx={{ px: 1.5 }}>Others</Typography>}
                        {others.map(item)}
                    </List>
                </Box>
            </Stack>
        </Box>
    )
}
