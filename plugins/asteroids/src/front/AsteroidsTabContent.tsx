import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppBar, Box, Button, Chip, Divider, Paper, Stack, Toolbar, Typography } from '@mui/material'
import { IContentProps, HelpButton as _HelpButton, pluginDocsUrl as _pluginDocsUrl } from '@kwirthmagnify/kwirth-common-front'
import { ENotifyLevel } from '@kwirthmagnify/kwirth-common'
import { GameStatus } from './core'
import { IAsteroidsData } from './AsteroidsData'
import { IAsteroidsConfig } from './AsteroidsConfig'
import { IAsteroidsInstanceConfig } from './AsteroidsTypes'
import { AsteroidsInput } from './AsteroidsInput'
import { CLASSIC_PALETTE, COLOR_PALETTE, draw } from './AsteroidsRenderer'
import { BackScoreStore, MAX_NAME, qualifies } from './AsteroidsScores'
import { AsteroidsIcon } from './AsteroidsSetup'

/*
    Runtime guard: the core's global may serve a common-front version older than these
    exports, and then HelpButton would arrive as undefined and React would blow up when painting the topbar.
*/
const HelpButton: typeof _HelpButton = typeof _HelpButton === 'function' ? _HelpButton : () => null
const pluginDocsUrl: typeof _pluginDocsUrl = typeof _pluginDocsUrl === 'function' ? _pluginDocsUrl : () => ''

interface IEmptyStateProps {
    title: string
    detail: string
}

/*
    With the channel stopped there is no game to paint: the canvas would show a black rectangle with a
    banner inside, and the user would have no way of knowing that what is missing is pressing Start. Same
    pattern as sugarless.
*/
const EmptyState: React.FC<IEmptyStateProps> = ({ title, detail }) => (
    <Stack alignItems='center' justifyContent='center' spacing={1}
        sx={{ flex: 1, height: '100%', px: 4, textAlign: 'center' }}>
        <Typography variant='h6' color='text.secondary'>{title}</Typography>
        <Typography variant='body2' color='text.secondary'>{detail}</Typography>
    </Stack>
)

/*
    Mirror of the scoreboard for React. The truth lives in asteroidsData; this only forces the topbar
    to repaint, which cannot run at 60fps. 'started' and 'paused' are included here because WHAT
    gets rendered (game or EmptyState) depends on them, and the raw data does not trigger a render on its own.
*/
interface IHudState {
    score: number
    lives: number
    level: number
    best: number
    over: boolean
    started: boolean
    paused: boolean
}

/**
 * Tab component.
 *
 * It is mounted and unmounted every time the user switches tabs in Kwirth.
 * That is why NOTHING of the game lives here: only the canvas, the animation
 * loop and the keyboard, which are things tied to the DOM and can be recreated.
 *
 * The AsteroidsGame instance lives in `channelObject.data`, which Kwirth
 * keeps in the ITabObject outside the React tree. When coming back to the tab the
 * loop hooks back onto the same game and continues where it was.
 */
export const AsteroidsTabContent: React.FC<IContentProps> = (props: IContentProps) => {
    const asteroidsData: IAsteroidsData = props.channelObject.data
    const asteroidsConfig: IAsteroidsConfig = props.channelObject.config
    const asteroidsInstanceConfig: IAsteroidsInstanceConfig = props.channelObject.instanceConfig

    const containerRef = useRef<HTMLDivElement | null>(null)
    const gameAreaRef = useRef<HTMLDivElement | null>(null)
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const inputRef = useRef<AsteroidsInput>(new AsteroidsInput())
    const frameRef = useRef<number | undefined>(undefined)
    const lastTimeRef = useRef<number>(0)

    // It is initialised from the data, not to zero: when coming back to a tab with the game running, an
    // empty state would paint the EmptyState during the first quarter of a second.
    const [hud, setHud] = useState<IHudState>({
        score: asteroidsData.score,
        lives: asteroidsData.lives,
        level: asteroidsData.level,
        best: asteroidsData.highScore,
        over: asteroidsData.gameOver,
        started: asteroidsData.started,
        paused: asteroidsData.paused,
    })
    const [scoreSaved, setScoreSaved] = useState(false)
    const [boxTop, setBoxTop] = useState(0)

    /*
        The name in the table is the LOGGED-IN USER, not a typed alias. Kwirth always injects it
        into channelObject.userName (it is the user id), with no need to request it in the
        requirements. The 'anon' is only in case there were no session: the back end would set it anyway.
    */
    const playerName = props.channelObject.userName || 'anon'

    const palette = asteroidsConfig?.theme === 'color' ? COLOR_PALETTE : CLASSIC_PALETTE
    const aspect = asteroidsInstanceConfig?.aspectRatio ?? 1.6

    const syncHud = useCallback(() => {
        const game = asteroidsData.game
        if (!game) {
            // No game means no scoreboard, but 'started' DOES have to be tracked: it is what makes
            // the play area appear when the user starts the channel.
            setHud({
                score: 0, lives: 0, level: 0,
                best: asteroidsData.highScore,
                over: false,
                started: asteroidsData.started,
                paused: asteroidsData.paused,
            })
            return
        }
        asteroidsData.score = game.state.score
        asteroidsData.lives = game.state.lives
        asteroidsData.level = game.state.level
        const finished = game.state.status === GameStatus.Finished
        if (finished && !asteroidsData.gameOver) {
            // Transition to game over: decide whether it gets into the table.
            asteroidsData.pendingScore = qualifies(asteroidsData.scores, game.state.score)
            setScoreSaved(false)
        }
        asteroidsData.gameOver = finished
        if (game.state.score > asteroidsData.highScore) asteroidsData.highScore = game.state.score
        setHud({
            score: game.state.score,
            lives: game.state.lives,
            level: game.state.level,
            best: asteroidsData.highScore,
            over: game.state.status === GameStatus.Finished,
            started: asteroidsData.started,
            paused: asteroidsData.paused,
        })
    }, [asteroidsData])

    /*
        The canvas fills the WHOLE play area while keeping the aspect ratio: width is tried first and, if
        the resulting height does not fit, height rules and there is spare room at the sides. The play area is measured and not the
        whole container because the latter includes the topbar and the touch controls.
    */
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current
        const area = gameAreaRef.current
        if (!canvas || !area) return
        const dpr = window.devicePixelRatio || 1
        const rect = area.getBoundingClientRect()
        const availableWidth = Math.max(160, Math.floor(rect.width))
        const availableHeight = Math.max(120, Math.floor(rect.height))
        let width = availableWidth
        let height = Math.floor(width / aspect)
        if (height > availableHeight) {
            height = availableHeight
            width = Math.floor(height * aspect)
        }
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
        canvas.width = Math.floor(width * dpr)
        canvas.height = Math.floor(height * dpr)
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }, [aspect])

    const renderFrame = useCallback(() => {
        const canvas = canvasRef.current
        const game = asteroidsData.game
        if (!canvas || !game) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const dpr = window.devicePixelRatio || 1

        // With the channel stopped this is never reached: the canvas is not even rendered, it is replaced by the
        // EmptyState, which is what explains that Start has to be pressed.
        let banner: string | undefined
        let subBanner: string | undefined
        if (game.state.status === GameStatus.Init) {
            banner = 'READY'
            subBanner = 'Click here and press Enter'
        }
        else if (game.state.status === GameStatus.Finished) {
            banner = 'GAME OVER'
            subBanner = `Score ${game.state.score} — press Enter to play again`
        }
        else if (asteroidsData.paused) {
            banner = 'PAUSED'
        }

        draw({
            ctx,
            state: game.state,
            worldSize: game.worldSize,
            canvasSize: { width: canvas.width / dpr, height: canvas.height / dpr },
            palette,
            banner,
            subBanner,
        })
    }, [asteroidsData, palette])

    // ── Animation loop ────────────────────────────────────────────────────
    // Created on mount and cancelled on unmount. The game is not touched.
    useEffect(() => {
        const loop = (time: number) => {
            frameRef.current = requestAnimationFrame(loop)
            const game = asteroidsData.game
            if (!game) return

            const elapsed = lastTimeRef.current ? time - lastTimeRef.current : 0
            lastTimeRef.current = time

            const running = asteroidsData.started && !asteroidsData.paused
            if (running) {
                const input = inputRef.current.current
                // 'start' starts or restarts the game from within the game itself.
                if (input.start && game.state.status !== GameStatus.Running) {
                    if (game.state.status === GameStatus.Finished) game.reset()
                    game.start()
                    inputRef.current.setVirtual('start', 0)
                }
                game.tick(elapsed, input as any)
            }
            renderFrame()
        }

        lastTimeRef.current = 0
        frameRef.current = requestAnimationFrame(loop)

        return () => {
            if (frameRef.current !== undefined) cancelAnimationFrame(frameRef.current)
            frameRef.current = undefined
            inputRef.current.reset()
        }
    }, [asteroidsData, renderFrame])

    // ── HUD: syncs four times per second, not every frame ──────────────────
    useEffect(() => {
        const id = setInterval(syncHud, 250)
        return () => clearInterval(id)
    }, [syncHud])

    // ── Keyboard ──────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current
        if (!container) return
        const input = inputRef.current
        input.attach(container)
        return () => { input.detach() }
    }, [])

    // ── Channel height ────────────────────────────────────────────────────
    // We measure where the content starts and give it the rest of the window. A 'height: 100%' does not work
    // here: the Kwirth container has no defined height and collapses.
    useEffect(() => {
        const measure = () => { if (containerRef.current) setBoxTop(containerRef.current.getBoundingClientRect().top) }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [])

    // ── Canvas size ───────────────────────────────────────────────────────
    // The play area only exists with the channel started, so the observer is mounted again
    // when 'started' changes.
    useEffect(() => {
        const area = gameAreaRef.current
        if (!area) return
        resizeCanvas()
        renderFrame()

        const observer = new ResizeObserver(() => { resizeCanvas(); renderFrame() })
        observer.observe(area)

        return () => observer.disconnect()
    }, [resizeCanvas, renderFrame, hud.started])

    // ── Pause on focus loss, if configured ────────────────────────────────
    const onBlur = useCallback(() => {
        if (asteroidsConfig?.pauseOnBlur && asteroidsData.started && !asteroidsData.paused) {
            asteroidsData.paused = true
            inputRef.current.reset()
            renderFrame()
        }
    }, [asteroidsConfig, asteroidsData, renderFrame])

    const onFocus = useCallback(() => {
        if (asteroidsConfig?.pauseOnBlur && asteroidsData.paused) {
            asteroidsData.paused = false
            lastTimeRef.current = 0
        }
    }, [asteroidsConfig, asteroidsData])

    const saveScore = useCallback(async () => {
        const game = asteroidsData.game
        if (!game || !asteroidsData.pendingScore) return
        const name = (playerName.trim() || 'anon').slice(0, MAX_NAME)
        asteroidsData.pendingScore = false
        setScoreSaved(true)
        // The back end inserts and trims: it is the authority over the shared table.
        const updated = await asteroidsData.scoreStore?.submit({
            name,
            score: game.state.score,
            level: game.state.level,
            date: new Date().toISOString(),
        })
        if (updated && updated.length) {
            asteroidsData.scores = updated
            asteroidsData.highScore = Math.max(asteroidsData.highScore, updated[0].score)
            return
        }
        /*
            Empty table as the response = the back end did not answer and the wait timed out. It happens, for example,
            when the channel has been open since before the back end was reloaded: the core no longer
            recognises the instance and drops the command without telling anyone.

            Losing the score is a minor annoyance; losing it SILENTLY is what makes the
            user believe the scoreboard is broken. So it is reported, together with what to do.
        */
        /*
            The two possible faults are different and must be distinguishable without opening a log:
            a socket that is not open fails instantly, and a back end that does not answer within 5s points to
            the core having dropped the command before it reached the plugin.
        */
        const store = asteroidsData.scoreStore
        const failure = store instanceof BackScoreStore ? store.lastFailure : undefined
        const detail = failure === 'not-connected'
            ? 'the channel is not connected'
            : 'the server did not answer'
        const socket = props.channelObject.webSocket
        console.error('[asteroids] score not saved:', {
            failure,
            instanceId: props.channelObject.instanceId,
            socketReadyState: socket?.readyState,
            hasAccessString: Boolean(props.channelObject.accessString),
        })
        props.channelObject.notify?.(props.channelObject.channelId, ENotifyLevel.ERROR,
            `The score could not be saved: ${detail}. Stop and start the channel and try again.`)
    }, [asteroidsData, playerName])

    const press = (control: 'turn' | 'thrust' | 'fire' | 'hyperspace' | 'start', value: number) =>
        () => inputRef.current.setVirtual(control, value)

    // Set by the core: the channel in full screen, without the product's tab bar.
    const isFullscreen = (props.channelObject as unknown as { isFullscreen?: boolean }).isFullscreen === true

    return (
        <>
        {/*
            In full screen the tab bar disappears, and with it the only thing that said what
            this is and which cluster it is connected to. This bar brings it back: the brand, the channel and the
            cluster. It goes OUTSIDE the Box that measures its own height, so the game keeps filling what
            is left without having to subtract anything by hand.
        */}
        {isFullscreen && (
            <AppBar position='sticky' color='default' elevation={1} sx={{ zIndex: 1300 }}>
                <Toolbar sx={{ gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>{AsteroidsIcon}</Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant='h6' sx={{ fontWeight: 700 }}>Asteroids</Typography>
                        {props.channelObject.clusterName && <Typography variant='subtitle1' sx={{ fontWeight: 600, color: 'text.secondary' }}>· {props.channelObject.clusterName}</Typography>}
                    </Box>
                    <Box sx={{ flex: 1 }} />
                    {props.channelObject.clusterUrl && <Typography variant='caption' color='text.secondary'>{props.channelObject.clusterUrl}</Typography>}
                </Toolbar>
            </AppBar>
        )}
        <Box
            ref={containerRef}
            tabIndex={0}
            onBlur={onBlur}
            onFocus={onFocus}
            sx={{
                width: '100%',
                height: `calc(100vh - ${boxTop}px - 35px)`,
                minHeight: 220,
                display: 'flex', flexDirection: 'column',
                outline: 'none',
            }}
        >
            {/* The topbar only makes sense with the channel running: stopped it would be a 'Score 0 / Lives 0 /
                Level 0' that tells nothing and competes with the message saying it has to be started. */}
            {hud.started &&
            <Stack direction='row' spacing={1} alignItems='center'
                sx={{ px: 1, height: 44, flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}>
                <Chip size='small' label={`Score ${hud.score}`} />
                <Chip size='small' label={`Lives ${hud.lives}`} variant='outlined' />
                <Chip size='small' label={`Level ${hud.level}`} variant='outlined' />
                <Chip size='small' label={`Best ${hud.best}`} variant='outlined' />
                <Box sx={{ flex: 1 }} />
                {hud.paused && <Chip size='small' color='warning' label='paused' />}
                <HelpButton docsUrl={pluginDocsUrl(props.channelObject?.clusterUrl, 'asteroids')} section='user/04-playing' />
            </Stack>
            }

            {!hud.started &&
                <EmptyState title='Asteroids not started'
                    detail='Start the channel (tab settings ⚙ → Start) to play.' />
            }

            {hud.started &&
            <Box ref={gameAreaRef} sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0, position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    style={{ display: 'block', borderRadius: 4 }}
                    onClick={() => containerRef.current?.focus()}
                />

                {hud.over &&
                    <Paper
                        elevation={8}
                        sx={{
                            position: 'absolute', minWidth: 260, maxWidth: '80%',
                            p: 2, opacity: 0.97,
                        }}
                    >
                        <Typography variant='subtitle2' gutterBottom>High scores</Typography>
                        <Divider sx={{ mb: 1 }} />

                        {asteroidsData.scores.length === 0 &&
                            <Typography variant='caption' color='text.secondary'>No scores yet.</Typography>
                        }
                        {asteroidsData.scores.map((entry, index) => (
                            <Stack key={`${entry.name}-${entry.date}-${index}`} direction='row' spacing={1} sx={{ py: 0.25 }}>
                                <Typography variant='caption' sx={{ width: 20, color: 'text.secondary' }}>{index + 1}</Typography>
                                <Typography variant='caption' sx={{ flex: 1 }}>{entry.name}</Typography>
                                <Typography variant='caption' sx={{ color: 'text.secondary' }}>L{entry.level}</Typography>
                                <Typography variant='caption' sx={{ width: 56, textAlign: 'right' }}>{entry.score}</Typography>
                            </Stack>
                        ))}

                        {asteroidsData.pendingScore && !scoreSaved &&
                            <>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant='caption' color='text.secondary'>
                                    {hud.score} points — you made the table
                                </Typography>
                                {/* An alias is no longer typed: the table entry is signed by the logged-in user. */}
                                <Stack direction='row' spacing={1} sx={{ mt: 1 }} alignItems='center'>
                                    <Typography variant='caption' sx={{ flex: 1 }}>
                                        Saving as <b>{playerName}</b>
                                    </Typography>
                                    <Button size='small' variant='contained' onClick={() => void saveScore()}>Save</Button>
                                </Stack>
                            </>
                        }

                        <Divider sx={{ my: 1 }} />
                        <Typography variant='caption' color='text.secondary'>
                            Click the canvas and press Enter to play again
                        </Typography>
                    </Paper>
                }
            </Box>
            }

            {hud.started && asteroidsConfig?.touchControls &&
                <Stack direction='row' spacing={1} justifyContent='center' sx={{ p: 1, flexShrink: 0 }}>
                    <Button variant='outlined' size='small'
                        onPointerDown={press('turn', -1)} onPointerUp={press('turn', 0)} onPointerLeave={press('turn', 0)}>◀</Button>
                    <Button variant='outlined' size='small'
                        onPointerDown={press('thrust', 1)} onPointerUp={press('thrust', 0)} onPointerLeave={press('thrust', 0)}>▲</Button>
                    <Button variant='outlined' size='small'
                        onPointerDown={press('turn', 1)} onPointerUp={press('turn', 0)} onPointerLeave={press('turn', 0)}>▶</Button>
                    <Button variant='contained' size='small'
                        onPointerDown={press('fire', 1)} onPointerUp={press('fire', 0)} onPointerLeave={press('fire', 0)}>FIRE</Button>
                    <Button variant='outlined' size='small' onPointerDown={press('start', 1)}>START</Button>
                </Stack>
            }
        </Box>
        </>
    )
}
