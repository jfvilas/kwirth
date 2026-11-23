import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Terminal3270 } from '../common/Terminal3270'
import { displayRow, oiaOf } from '../common/Display3270'
import { E3270Highlight, E3270Key, I3270KeyAction } from '../common/Terminal3270Types'
import { EDisplay } from '../common/DisplayTypes'
import { KeyMapper } from './KeyMapper'
import { FONT_STACK, IFontMetrics, loadFont3270 } from './Font3270'
import { oiaColorOf, paletteOf, SCREEN_BACKGROUND } from './Palette'

export interface ITerminalViewProps {
    terminal: Terminal3270
    revision: number                                   // bumped by the owner whenever the buffer changed
    onKey: (action: I3270KeyAction) => void
    fullscreen: boolean
    display: EDisplay                                  // a 3279 in colour or a 3278 in green phosphor
    testId?: string                                    // the consumer's data-testid, for its e2e
}

// Rows painted: those of the screen plus the OIA line, and the rule between them.
const OIA_GAP = 0.35

const BLINK_STYLE_ID = 'blockterm-blink'
const ensureBlinkStyle = (): void => {
    if (document.getElementById(BLINK_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = BLINK_STYLE_ID
    style.textContent = '@keyframes blockterm-blink { 50% { opacity: 0 } }'
    document.head.appendChild(style)
}

/*
    The glass of the terminal: paints the buffer, the cursor and the OIA, scales the grid (24x80, 32x80 or 27x132) to the room it
    has without deforming it, and turns the PC keyboard into 3270 keys for its owner.

    It paints with the DOM, one span per run of equal appearance: the 3270 font stays sharp at any size and
    there is no pixel-ratio bookkeeping, which a canvas would need.
*/
export const TerminalView: React.FC<ITerminalViewProps> = ({ terminal, revision, onKey, fullscreen, display, testId }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const fontSizeRef = useRef(14)
    const mapperRef = useRef(new KeyMapper())
    const [metrics, setMetrics] = useState<IFontMetrics>()
    const [fontSize, setFontSize] = useState(14)
    const [top, setTop] = useState(0)
    const screen = terminal.screen
    const mono = display === EDisplay.GREEN
    const palette = paletteOf(display)
    const oiaColor = oiaColorOf(display)
    void revision

    useEffect(() => {
        ensureBlinkStyle()
        let alive = true
        void loadFont3270().then(m => { if (alive) setMetrics(m) })
        return () => { alive = false }
    }, [])

    // The tab has no defined height in Kwirth: measure where this box starts and take the rest of the window.
    useLayoutEffect(() => {
        const measureTop = () => { if (containerRef.current && !fullscreen) setTop(containerRef.current.getBoundingClientRect().top) }
        measureTop()
        const observer = new ResizeObserver(measureTop)
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [fullscreen])

    /*
        The largest font size at which the columns and rows plus the OIA fit. The width of a cell is the one the
        browser lays out, measured on a painted row: the font's measured advance falls a little short, and over
        132 columns that is enough to push the grid out of the tab.
    */
    useLayoutEffect(() => {
        const element = containerRef.current
        if (!element || !metrics) return
        const cellWidth = (): number => {
            const row = gridRef.current?.firstElementChild
            if (!row) return metrics.width
            const range = document.createRange()
            range.selectNodeContents(row)
            const width = range.getBoundingClientRect().width
            return width > 0 ? width / screen.cols / fontSizeRef.current : metrics.width
        }
        const fit = () => {
            const width = element.clientWidth
            const height = element.clientHeight
            if (width <= 0 || height <= 0) return
            const byWidth = width / (screen.cols * cellWidth())
            const byHeight = height / ((screen.rows + 1 + OIA_GAP) * metrics.height)
            const size = Math.max(4, Math.floor(Math.min(byWidth, byHeight) * 10) / 10)
            fontSizeRef.current = size
            setFontSize(size)
        }
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(element)
        return () => observer.disconnect()
    }, [metrics, screen.cols, screen.rows])

    useEffect(() => { containerRef.current?.focus() }, [fullscreen])

    const handle = (action: I3270KeyAction | undefined, e: React.KeyboardEvent): void => {
        if (!action) return
        e.preventDefault()
        e.stopPropagation()
        onKey(action)
    }

    // A click puts the cursor where it lands, as on x3270.
    const onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        containerRef.current?.focus()
        const grid = (e.currentTarget.querySelector('[data-grid]') as HTMLElement | null)?.getBoundingClientRect()
        if (!grid || !metrics) return
        // the cell as the browser laid it out: the measured font width drifts a column off towards the right
        const col = Math.floor((e.clientX - grid.left) / (grid.width / screen.cols))
        const row = Math.floor((e.clientY - grid.top) / (grid.height / screen.rows))
        if (row < 0 || row >= screen.rows || col < 0 || col >= screen.cols) return
        onKey({ key: E3270Key.MOVE_CURSOR, address: screen.address(row, col) })
    }

    const lineHeight = metrics ? `${fontSize * metrics.height}px` : 'normal'
    const oia = oiaOf(terminal)
    const rows: React.ReactNode[] = []
    for (let row = 0; row < screen.rows; row++) {
        rows.push(
            <div key={row} style={{ height: lineHeight }}>
                {displayRow(screen, row, true, mono).map((run, i) => {
                    const color = palette[run.color]
                    const reverse = run.cursor !== (run.highlight === E3270Highlight.REVERSE)
                    return (
                        <span key={i} style={{
                            color: reverse ? SCREEN_BACKGROUND : color,
                            backgroundColor: reverse ? color : undefined,
                            textDecoration: run.highlight === E3270Highlight.UNDERSCORE ? 'underline' : undefined,
                            animation: run.highlight === E3270Highlight.BLINK ? 'blockterm-blink 1s step-start infinite' : undefined
                        }}>{run.text}</span>
                    )
                })}
            </div>
        )
    }

    const oiaLine = (
        <div style={{ height: lineHeight, color: oiaColor, display: 'flex' }}>
            <span style={{ color: SCREEN_BACKGROUND, backgroundColor: oiaColor }}>{oia.ready[0]}</span>
            <span>{oia.ready.slice(1).padEnd(7)}</span>
            <span style={{ flex: 1 }}>{oia.lock}</span>
            <span>{oia.insert ? '^' : ' '}{' '.repeat(12)}{oia.position}</span>
        </div>
    )

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            data-testid={testId}
            onKeyDown={e => handle(mapperRef.current.down(e), e)}
            onKeyUp={e => handle(mapperRef.current.up(e), e)}
            onBlur={() => mapperRef.current.cancel()}
            onClick={onClick}
            style={{
                ...(fullscreen
                    ? { position: 'fixed', inset: 0, zIndex: 1300 }
                    : { width: '100%', height: `calc(100vh - ${top}px - 35px)`, minHeight: 200 }),
                backgroundColor: SCREEN_BACKGROUND,
                outline: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', cursor: 'text', userSelect: 'none'
            }}
        >
            <div style={{ fontFamily: FONT_STACK, fontSize: `${fontSize}px`, whiteSpace: 'pre', lineHeight, visibility: metrics ? 'visible' : 'hidden' }}>
                <div data-grid ref={gridRef}>{rows}</div>
                <div style={{ height: `${fontSize * (metrics?.height ?? 1.2) * OIA_GAP}px`, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '100%', borderTop: `1px solid ${oiaColor}` }} />
                </div>
                {oiaLine}
            </div>
        </div>
    )
}
