import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IGlassOia, IGlassRun } from '../common/GlassTypes'
import { E3270Color } from '../common/Terminal3270Types'
import { IKeyEventLike } from './KeyMapper'
import { FONT_STACK, IFontMetrics, loadFont3270 } from './Font3270'
import { SCREEN_BACKGROUND } from './Palette'

// The keyboard as the glass sees it: each handler says whether the key was the terminal's (then the browser
// and Kwirth never get it).
export interface IGlassKeys {
    down: (e: IKeyEventLike) => boolean
    up: (e: IKeyEventLike) => boolean
    cancel: () => void
}

export interface IGlassProps {
    rows: number
    cols: number
    row: (row: number) => IGlassRun[]
    oia: IGlassOia
    palette: Record<E3270Color, string>
    oiaColor: string
    keys: IGlassKeys
    onCell: (row: number, col: number) => void     // a click on a position
    fullscreen: boolean
    testId?: string
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
    The glass of the terminal, whatever terminal it is: paints runs, the cursor and the OIA, scales the grid
    (24x80, 32x80, 27x132) to the room it has without deforming it, and hands the keyboard and the clicks to its
    owner. TerminalView (3270) and TerminalView5250 only work out the runs and translate the keys.

    It paints with the DOM, one span per run of equal look: the font stays sharp at any size and there is no
    pixel-ratio bookkeeping, which a canvas would need.
*/
export const Glass: React.FC<IGlassProps> = ({ rows, cols, row, oia, palette, oiaColor, keys, onCell, fullscreen, testId }) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const fontSizeRef = useRef(14)
    const [metrics, setMetrics] = useState<IFontMetrics>()
    const [fontSize, setFontSize] = useState(14)
    const [top, setTop] = useState(0)

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
            const first = gridRef.current?.firstElementChild
            if (!first) return metrics.width
            const range = document.createRange()
            range.selectNodeContents(first)
            const width = range.getBoundingClientRect().width
            return width > 0 ? width / cols / fontSizeRef.current : metrics.width
        }
        const fit = () => {
            const width = element.clientWidth
            const height = element.clientHeight
            if (width <= 0 || height <= 0) return
            const byWidth = width / (cols * cellWidth())
            const byHeight = height / ((rows + 1 + OIA_GAP) * metrics.height)
            const size = Math.max(4, Math.floor(Math.min(byWidth, byHeight) * 10) / 10)
            fontSizeRef.current = size
            setFontSize(size)
        }
        fit()
        const observer = new ResizeObserver(fit)
        observer.observe(element)
        return () => observer.disconnect()
    }, [metrics, cols, rows])

    /*
        The check after the fit: the advance of a character does not scale exactly with the font size (the
        browser rounds it differently at each size), so a size worked out from a row painted at another size can
        be a little too big — 20px over 80 columns at 25px. Measure the grid as it is painted now and, if it
        overflows, shrink by exactly the overflow. It only ever shrinks, so it settles in one or two passes.
    */
    useLayoutEffect(() => {
        const element = containerRef.current
        const first = gridRef.current?.firstElementChild
        if (!element || !first || !metrics) return
        const range = document.createRange()
        range.selectNodeContents(first)
        const painted = range.getBoundingClientRect().width
        const room = element.clientWidth
        if (painted > room && room > 0) {
            const size = Math.max(4, Math.floor(fontSize * room / painted * 10) / 10)
            if (size < fontSize) {
                fontSizeRef.current = size
                setFontSize(size)
            }
        }
    }, [fontSize, metrics])

    useEffect(() => { containerRef.current?.focus() }, [fullscreen])

    const handled = (yes: boolean, e: React.KeyboardEvent): void => {
        if (!yes) return
        e.preventDefault()
        e.stopPropagation()
    }

    // A click puts the cursor where it lands, as on x3270 and PCOMM.
    const onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
        containerRef.current?.focus()
        const grid = (e.currentTarget.querySelector('[data-grid]') as HTMLElement | null)?.getBoundingClientRect()
        if (!grid || !metrics) return
        // the cell as the browser laid it out: the measured font width drifts a column off towards the right
        const col = Math.floor((e.clientX - grid.left) / (grid.width / cols))
        const r = Math.floor((e.clientY - grid.top) / (grid.height / rows))
        if (r < 0 || r >= rows || col < 0 || col >= cols) return
        onCell(r, col)
    }

    const lineHeight = metrics ? `${fontSize * metrics.height}px` : 'normal'

    const span = (run: IGlassRun, key: React.Key): React.ReactNode => {
        const color = palette[run.color]
        const reverse = run.cursor !== run.reverse
        return (
            <span key={key} style={{
                color: reverse ? SCREEN_BACKGROUND : color,
                backgroundColor: reverse ? color : undefined,
                textDecoration: run.underscore ? 'underline' : undefined,
                animation: run.blink ? 'blockterm-blink 1s step-start infinite' : undefined,
                // column separators: a thin bar on the left of every position, drawn inside it so nothing moves
                boxShadow: run.separator ? `inset 1px 0 0 ${color}` : undefined
            }}>{run.text}</span>
        )
    }

    const lines: React.ReactNode[] = []
    for (let r = 0; r < rows; r++) {
        lines.push(
            <div key={r} style={{ height: lineHeight }}>
                {row(r).flatMap((run, i) => run.separator
                    // separators go on every position, so a run with them is painted one position at a time
                    ? [...run.text].map((ch, j) => span({ ...run, text: ch }, `${i}.${j}`))
                    : [span(run, i)])}
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
            onKeyDown={e => handled(keys.down(e), e)}
            onKeyUp={e => handled(keys.up(e), e)}
            onBlur={() => keys.cancel()}
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
                <div data-grid ref={gridRef}>{lines}</div>
                <div style={{ height: `${fontSize * (metrics?.height ?? 1.2) * OIA_GAP}px`, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '100%', borderTop: `1px solid ${oiaColor}` }} />
                </div>
                {oiaLine}
            </div>
        </div>
    )
}
