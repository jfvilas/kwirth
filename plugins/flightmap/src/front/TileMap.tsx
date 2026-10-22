import React, { useEffect, useRef, useState } from 'react'
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material'
import { fitZoom, IMapBounds, MAX_ZOOM, MIN_ZOOM, project, TILE, unproject } from './TileMath'

export type { IMapBounds } from './TileMath'

/*
    A minimal slippy map: OpenStreetMap raster tiles under an SVG layer of markers. It is drawn by hand
    instead of bundling a map library because an uploaded plugin's front.js has to fit in a ConfigMap.
*/

export interface IMapMarker {
    id: string
    lat: number
    lon: number
    color: string
    /** 'plane' is drawn rotated by 'rotation' (degrees clockwise from north) */
    shape: 'dot' | 'plane'
    rotation?: number
    size?: number
    title: string
}

interface IProps {
    markers: IMapMarker[]
    /** what is fitted on first paint */
    bounds: IMapBounds
    selectedId?: string
    onSelect?: (id: string | undefined) => void
    /** changing it recenters the map on that point */
    focus?: { lat: number, lon: number, key: number }
    /** a rectangle drawn on top, like the box a subscription covers */
    outline?: IMapBounds
}

const PLANE_PATH = 'M0,-9 L2,-3 L8,1 L8,3 L2,1 L1.5,6 L4,8 L4,9 L0,8 L-4,9 L-4,8 L-1.5,6 L-2,1 L-8,3 L-8,1 L-2,-3 Z'

export const TileMap: React.FC<IProps> = (props: IProps) => {
    const boxRef = useRef<HTMLDivElement | null>(null)
    const [size, setSize] = useState({ w: 0, h: 0 })
    const [view, setView] = useState<{ lat: number, lon: number, zoom: number } | undefined>(undefined)
    const drag = useRef<{ x: number, y: number, cx: number, cy: number, moved: boolean, markerId?: string } | undefined>(undefined)

    useEffect(() => {
        if (!boxRef.current) return
        const observer = new ResizeObserver(entries => {
            const r = entries[0].contentRect
            setSize({ w: Math.floor(r.width), h: Math.floor(r.height) })
        })
        observer.observe(boxRef.current)
        return () => observer.disconnect()
    }, [])

    // first paint with a real size: fit the bounds
    useEffect(() => {
        if (view || size.w === 0 || size.h === 0) return
        const b = props.bounds
        setView({ lat: (b.lamin + b.lamax) / 2, lon: (b.lomin + b.lomax) / 2, zoom: fitZoom(b, size.w, size.h) })
    }, [size.w, size.h])

    useEffect(() => {
        if (!props.focus) return
        setView(v => ({ lat: props.focus!.lat, lon: props.focus!.lon, zoom: Math.max(v?.zoom ?? 0, 9) }))
    }, [props.focus?.key])

    const fit = () => {
        const b = props.bounds
        setView({ lat: (b.lamin + b.lamax) / 2, lon: (b.lomin + b.lomax) / 2, zoom: fitZoom(b, size.w, size.h) })
    }

    const zoomBy = (delta: number, anchorX = size.w / 2, anchorY = size.h / 2) => {
        if (!view) return
        const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom + delta))
        if (zoom === view.zoom) return
        // the point under the anchor stays where it is
        const c = project(view.lat, view.lon, view.zoom)
        const anchor = unproject(c.x - size.w / 2 + anchorX, c.y - size.h / 2 + anchorY, view.zoom)
        const a = project(anchor.lat, anchor.lon, zoom)
        const center = unproject(a.x - anchorX + size.w / 2, a.y - anchorY + size.h / 2, zoom)
        setView({ ...center, zoom })
    }

    const onWheel = (e: React.WheelEvent) => {
        const rect = boxRef.current!.getBoundingClientRect()
        zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top)
    }

    const onPointerDown = (e: React.PointerEvent) => {
        if (!view) return
        const c = project(view.lat, view.lon, view.zoom)
        // the marker is read here: once the pointer is captured, pointerup reports the map as its target
        const markerId = (e.target as Element).closest('[data-marker-id]')?.getAttribute('data-marker-id') ?? undefined
        drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false, markerId }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: React.PointerEvent) => {
        const d = drag.current
        if (!d || !view) return
        const dx = e.clientX - d.x, dy = e.clientY - d.y
        if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true
        if (!d.moved) return
        setView({ ...unproject(d.cx - dx, d.cy - dy, view.zoom), zoom: view.zoom })
    }

    const onPointerUp = () => {
        const d = drag.current
        drag.current = undefined
        // a click that did not drag: on a marker selects it, on the map clears the selection
        if (d && !d.moved) props.onSelect?.(d.markerId)
    }

    const tiles: JSX.Element[] = []
    const overlay: JSX.Element[] = []
    if (view && size.w > 0) {
        const c = project(view.lat, view.lon, view.zoom)
        const left = c.x - size.w / 2, top = c.y - size.h / 2
        const n = Math.pow(2, view.zoom)
        for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++) {
            for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++) {
                if (ty < 0 || ty >= n) continue
                const wx = ((tx % n) + n) % n
                tiles.push(
                    <img key={`${view.zoom}/${tx}/${ty}`} src={`https://tile.openstreetmap.org/${view.zoom}/${wx}/${ty}.png`} alt='' draggable={false}
                        style={{ position: 'absolute', left: tx * TILE - left, top: ty * TILE - top, width: TILE, height: TILE, userSelect: 'none' }} />
                )
            }
        }

        if (props.outline) {
            const a = project(props.outline.lamax, props.outline.lomin, view.zoom)
            const b = project(props.outline.lamin, props.outline.lomax, view.zoom)
            overlay.push(<rect key='outline' x={a.x - left} y={a.y - top} width={b.x - a.x} height={b.y - a.y}
                fill='none' stroke='#1976d2' strokeDasharray='6 4' strokeWidth={1.5} />)
        }

        // the selected marker goes last so it is drawn on top
        const ordered = [...props.markers].sort((m1, m2) => Number(m1.id === props.selectedId) - Number(m2.id === props.selectedId))
        for (const m of ordered) {
            const p = project(m.lat, m.lon, view.zoom)
            const x = p.x - left, y = p.y - top
            if (x < -20 || y < -20 || x > size.w + 20 || y > size.h + 20) continue
            const selected = m.id === props.selectedId
            const s = (m.size ?? 1) * (selected ? 1.5 : 1)
            overlay.push(
                <g key={m.id} data-marker-id={m.id} transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }}>
                    <title>{m.title}</title>
                    {m.shape === 'plane'
                        ? <path d={PLANE_PATH} transform={`rotate(${m.rotation ?? 0}) scale(${s})`} fill={m.color} stroke={selected ? '#000' : '#fff'} strokeWidth={0.8} />
                        : <circle r={5 * s} fill={m.color} stroke={selected ? '#000' : '#fff'} strokeWidth={selected ? 2 : 1.2} />
                    }
                </g>
            )
        }
    }

    return (
        <Box ref={boxRef} sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', bgcolor: '#aad3df', touchAction: 'none', cursor: drag.current?.moved ? 'grabbing' : 'grab' }}
            onWheel={onWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            {tiles}
            <svg width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0 }}>{overlay}</svg>
            <Stack sx={{ position: 'absolute', top: 8, left: 8, bgcolor: 'background.paper', borderRadius: 1, boxShadow: 2 }}
                onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
                <Tooltip title='Zoom in' placement='right'><IconButton size='small' onClick={() => zoomBy(1)}>+</IconButton></Tooltip>
                <Tooltip title='Zoom out' placement='right'><IconButton size='small' onClick={() => zoomBy(-1)}>−</IconButton></Tooltip>
                <Tooltip title='Fit the whole area' placement='right'><IconButton size='small' onClick={fit} sx={{ fontSize: 14 }}>⤢</IconButton></Tooltip>
            </Stack>
            <Typography variant='caption' sx={{ position: 'absolute', right: 0, bottom: 0, px: 0.5, bgcolor: 'rgba(255,255,255,0.75)', color: '#333' }}>
                © <a href='https://www.openstreetmap.org/copyright' target='_blank' rel='noreferrer'>OpenStreetMap</a> contributors
            </Typography>
        </Box>
    )
}
