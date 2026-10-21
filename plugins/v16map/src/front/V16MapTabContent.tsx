import React, { useEffect, useRef, useState } from 'react'
import { Box, Chip, List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material'
import { IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { IV16MapInstanceConfig, IV16Point } from '../common/V16MapTypes'
import { humanize, IV16MapData, placeOf } from './V16MapData'
import { IMapBounds, IMapMarker, TileMap } from './TileMap'

/** Peninsula, Balearic and Canary Islands, Ceuta and Melilla */
const SPAIN: IMapBounds = { lamin: 27.5, lomin: -18.3, lamax: 43.9, lomax: 4.4 }

const V16_COLOR = '#d32f2f'

const colorOf = (p: IV16Point): string => {
    if (p.v16) return V16_COLOR
    const cause = (p.cause ?? '').toLowerCase()
    if (cause.includes('accident')) return '#7b1fa2'
    if (cause.includes('maintenance') || cause.includes('roadworks') || cause.includes('construction')) return '#f57c00'
    if (cause.includes('weather') || cause.includes('environment') || cause.includes('poorroad')) return '#0288d1'
    return '#455a64'
}

const timeOf = (iso?: string): string => {
    if (!iso) return ''
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export const V16MapTabContent: React.FC<IContentProps> = (props: IContentProps) => {
    const data = props.channelObject.data as IV16MapData
    const instanceConfig = props.channelObject.instanceConfig as IV16MapInstanceConfig
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
        const p = id ? data.points[id] : undefined
        if (center && p?.lat !== undefined && p.lon !== undefined) setFocus({ lat: p.lat, lon: p.lon, key: Date.now() })
        forceRender(n => n + 1)
    }

    if (!data.started) {
        return (
            <Stack ref={containerRef} alignItems='center' justifyContent='center' spacing={1} sx={{ width: '100%', height: `${containerHeight}px`, px: 4, textAlign: 'center' }}>
                <Typography variant='h6' color='text.secondary'>V16 Map not started</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 480 }}>Start the channel (tab settings ⚙ → Start) to see the DGT traffic incidents.</Typography>
            </Stack>
        )
    }

    const all = Object.values(data.points)
    // newest first, V16 beacons ahead of the rest when they started at the same time
    const sorted = [...all].sort((a, b) => (b.start ?? '').localeCompare(a.start ?? '') || Number(b.v16) - Number(a.v16))
    const v16Count = all.filter(p => p.v16).length
    const markers: IMapMarker[] = all
        .filter(p => p.lat !== undefined && p.lon !== undefined)
        .map(p => ({ id: p.id, lat: p.lat!, lon: p.lon!, color: colorOf(p), shape: 'dot', size: p.v16 ? 1.2 : 0.9, title: `${humanize(p.cause)}\n${placeOf(p)}` }))
    const selected = data.selectedId ? data.points[data.selectedId] : undefined

    return (
        <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: `${containerHeight}px`, p: 1, boxSizing: 'border-box' }}>
            <Stack direction='row' alignItems='center' spacing={1} sx={{ px: 1, pb: 1, flexWrap: 'wrap' }}>
                <Chip size='small' variant='outlined' label={instanceConfig?.v16Only ? 'V16 beacons only' : 'All incidents'} />
                <Chip size='small' label={`${all.length} situations`} />
                <Chip size='small' sx={{ bgcolor: V16_COLOR, color: '#fff' }} label={`${v16Count} V16`} />
                {data.lastUpdate > 0 &&
                    <Typography variant='caption' color='text.secondary'>
                        Updated {new Date(data.lastUpdate).toLocaleTimeString()} · last change +{data.lastChanges.added} ~{data.lastChanges.updated} −{data.lastChanges.removed}
                    </Typography>
                }
                {data.lastUpdate === 0 && data.signals.length === 0 &&
                    <Typography variant='caption' color='text.secondary'>Waiting for the first snapshot from the v16 provider...</Typography>
                }
            </Stack>
            {data.signals.map((s, i) => <Typography key={i} variant='body2' color='error' sx={{ px: 1 }}>{s}</Typography>)}

            <Stack direction='row' spacing={1} sx={{ flex: 1, minHeight: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0, borderRadius: 1, overflow: 'hidden' }}>
                    <TileMap markers={markers} bounds={SPAIN} selectedId={data.selectedId} onSelect={id => select(id)} focus={focus} />
                </Box>
                <Box sx={{ width: 340, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {selected &&
                        <Box sx={{ p: 1, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                            <Stack direction='row' spacing={1} alignItems='center'>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorOf(selected) }} />
                                <Typography variant='subtitle2'>{humanize(selected.cause)}{selected.v16 ? ' · V16 beacon' : ''}</Typography>
                            </Stack>
                            {selected.detail && <Typography variant='body2'>{humanize(selected.detail)}</Typography>}
                            <Typography variant='body2'>{placeOf(selected)}</Typography>
                            {selected.community && <Typography variant='body2' color='text.secondary'>{selected.community}</Typography>}
                            {selected.direction && <Typography variant='body2' color='text.secondary'>Direction: {humanize(selected.direction)}</Typography>}
                            <Typography variant='caption' color='text.secondary'>Since {timeOf(selected.start)} · id {selected.id}</Typography>
                        </Box>
                    }
                    <List dense sx={{ flex: 1, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, py: 0 }}>
                        {sorted.map(p =>
                            <ListItemButton key={p.id} selected={p.id === data.selectedId} onClick={() => select(p.id, true)}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorOf(p), mr: 1, flexShrink: 0, opacity: p.lat === undefined ? 0.3 : 1 }} />
                                <ListItemText primary={`${p.v16 ? 'V16 · ' : ''}${humanize(p.cause)}`} secondary={placeOf(p) || 'No location'}
                                    slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }} />
                            </ListItemButton>
                        )}
                    </List>
                </Box>
            </Stack>
        </Box>
    )
}
