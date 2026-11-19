import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Chip, Stack } from '@mui/material'
import { ChannelNotStarted, IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { IAbyssPatrolData } from './AbyssPatrolData'
import { AbyssPatrolInput } from './AbyssPatrolInput'
import { draw, WORLD_ASPECT } from './AbyssPatrolRenderer'
import { AbyssPatrolIcon } from './icons'

/*
    What React needs from the game. Time, charges and score are painted by the canvas itself; this only
    drives the top bar and WHAT is rendered (game or not-started screen), which depends on 'started'.
*/
interface IHudState {
    best: number
    started: boolean
    paused: boolean
}

/**
 * Mounted and unmounted on every tab switch, so nothing of the game lives here: only the canvas, the
 * animation loop and the keyboard, which are tied to the DOM. The game is in `channelObject.data`.
 */
export const AbyssPatrolTabContent: React.FC<IContentProps> = (props: IContentProps) => {
    const data = props.channelObject.data as IAbyssPatrolData

    const containerRef = useRef<HTMLDivElement | null>(null)
    const gameAreaRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const inputRef = useRef<AbyssPatrolInput>(new AbyssPatrolInput())
    const frameRef = useRef<number | undefined>(undefined)
    const lastTimeRef = useRef<number>(0)
    const [boxTop, setBoxTop] = useState(0)

    const readHud = useCallback((): IHudState => {
        const game = data.game
        if (game) data.best = Math.max(data.best, game.score)
        return {
            best: data.best,
            started: data.started,
            paused: data.paused,
        }
    }, [data])
    const [hud, setHud] = useState<IHudState>(readHud)

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const area = gameAreaRef.current
        if (!canvas || !area) return
        const dpr = window.devicePixelRatio || 1
        const rect = area.getBoundingClientRect()
        let width = Math.max(160, Math.floor(rect.width))
        let height = Math.floor(width / WORLD_ASPECT)
        if (height > rect.height) {
            height = Math.max(120, Math.floor(rect.height))
            width = Math.floor(height * WORLD_ASPECT)
        }
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
    }, [])

    const renderFrame = useCallback((now: number) => {
        const canvas = canvasRef.current
        const game = data.game
        if (!canvas || !game) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        draw({ ctx, game, width: canvas.width, height: canvas.height, paused: data.paused, now })
    }, [data])

    // Animation loop: created on mount, cancelled on unmount. The game itself is never touched here.
    useEffect(() => {
        const loop = (time: number) => {
            frameRef.current = requestAnimationFrame(loop)
            const game = data.game
            if (!game) return
            const elapsed = lastTimeRef.current ? time - lastTimeRef.current : 0
            lastTimeRef.current = time
            const command = inputRef.current.take()
            if (data.started && !data.paused) game.tick(elapsed, command)
            renderFrame(time)
        }
        lastTimeRef.current = 0
        frameRef.current = requestAnimationFrame(loop)
        return () => {
            if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
            frameRef.current = undefined
            inputRef.current.reset()
        }
    }, [data, renderFrame])

    useEffect(() => {
        const id = setInterval(() => setHud(readHud()), 250)
        return () => clearInterval(id)
    }, [readHud])

    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const input = inputRef.current
        input.attach(container)
        return () => input.detach()
    }, [])

    // The Kwirth container has no defined height, so the tab takes the rest of the window from where it starts.
    useEffect(() => {
        const measure = () => { if (containerRef.current) setBoxTop(containerRef.current.getBoundingClientRect().top) }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [])

    // The play area only exists with the channel started, so the observer is mounted again when that changes.
    useEffect(() => {
        const area = gameAreaRef.current
        if (!area) return
        resizeCanvas()
        const observer = new ResizeObserver(resizeCanvas)
        observer.observe(area)
        return () => observer.disconnect()
    }, [resizeCanvas, hud.started])

    return (
        <Box
            ref={containerRef}
            tabIndex={0}
            sx={{
                width: '100%',
                height: `calc(100vh - ${boxTop}px - 35px)`,
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                outline: 'none',
            }}
        >
            <Stack direction='row' spacing={1} alignItems='center' sx={{ px: 1, height: 44, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
                <Chip size='small' label={`Best ${hud.best}`} variant='outlined' />
                <Box sx={{ flex: 1 }} />
                <Chip size='small' color='warning' label='paused' sx={{ visibility: hud.paused ? 'visible' : 'hidden' }} />
            </Stack>

            {!hud.started &&
                <Stack sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', px: 4 }}>
                    <ChannelNotStarted icon={<Box sx={{ display: 'flex', color: 'primary.main' }}>{AbyssPatrolIcon}</Box>} name='Depth Charge'
                        hint='Depth Charge
                         not started. Start the channel to play.' channelObject={props.channelObject} />
                </Stack>
            }

            {hud.started &&
                <Box ref={gameAreaRef} sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
                    <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated' }} onClick={() => containerRef.current?.focus()} />
                </Box>
            }
        </Box>
    )
}
