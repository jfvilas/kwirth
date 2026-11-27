import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CheckMark, CloseGlyph, MenuCheck, MenuRadio } from './LunaIcons'

// ─── Buttons, checkboxes, group boxes ─────────────────────────────────────────────────────────────

export const Button: React.FC<{ label: string; onClick?: () => void; disabled?: boolean; autoFocus?: boolean; testId?: string }> = ({ label, onClick, disabled, autoFocus, testId }) =>
    <button type='button' className='tl-button' onClick={onClick} disabled={disabled} autoFocus={autoFocus} data-testid={testId}>{label}</button>

export const Checkbox: React.FC<{ label: string; checked: boolean; onChange?: (checked: boolean) => void; disabled?: boolean; testId?: string }> = ({ label, checked, onChange, disabled, testId }) =>
    <label className={'tl-check' + (disabled ? ' tl-disabled' : '')} data-testid={testId} role='checkbox' aria-checked={checked} aria-disabled={disabled}
        onClick={(e) => { e.preventDefault(); if (!disabled) onChange?.(!checked) }}>
        <span className='tl-check-box'>{checked && <CheckMark />}</span>
        {label}
    </label>

export const GroupBox: React.FC<{ label: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) =>
    <div className='tl-group' style={style}>
        <span className='tl-group-label'>{label}</span>
        {children}
    </div>

// A 'label ... value' line, as the Totals and Memory boxes of the Performance tab draw them.
export const Field: React.FC<{ label: string; value: string; testId?: string }> = ({ label, value, testId }) =>
    <div className='tl-field' data-testid={testId}><span>{label}</span><span>{value}</span></div>

// ─── Menus ────────────────────────────────────────────────────────────────────────────────────────

export interface IMenuItem {
    label?: string                 // none: a separator
    disabled?: boolean
    checked?: boolean              // a tick in front
    radio?: boolean                // a dot in front (one of a group)
    isDefault?: boolean            // drawn bold, as the default item of a context menu
    items?: IMenuItem[]            // a submenu
    onClick?: () => void
}

export const PopupMenu: React.FC<{ items: IMenuItem[]; x: number; y: number; onClose: () => void; testId?: string }> = ({ items, x, y, onClose, testId }) => {
    const [open, setOpen] = useState<number>()
    const ref = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    useLayoutEffect(() => { setWidth(ref.current?.offsetWidth ?? 0) }, [])
    return (
        <div ref={ref} className='tl-menu' style={{ left: x, top: y }} role='menu' data-testid={testId} onMouseDown={(e) => e.stopPropagation()}>
            {items.map((item, i) => {
                if (!item.label) return <div key={i} className='tl-menu-sep' />
                const classes = 'tl-menu-item' + (item.disabled ? ' tl-disabled' : '') + (item.isDefault ? ' tl-default' : '') + (open === i ? ' tl-open' : '')
                return (
                    <div key={i} className={classes} role='menuitem' aria-disabled={item.disabled} aria-checked={item.checked || item.radio}
                        onMouseEnter={() => setOpen(item.items && !item.disabled ? i : undefined)}
                        onClick={() => {
                            if (item.disabled || item.items) return
                            onClose()
                            item.onClick?.()
                        }}>
                        {item.checked && <MenuCheck />}
                        {item.radio && <MenuRadio />}
                        {item.label}
                        {item.items && <span className='tl-menu-arrow' />}
                        {item.items && open === i && <PopupMenu items={item.items} x={width - 3} y={-3} onClose={onClose} />}
                    </div>
                )
            })}
        </div>
    )
}

export interface IMenuBarEntry {
    label: string
    items: IMenuItem[]
}

export const MenuBar: React.FC<{ entries: IMenuBarEntry[] }> = ({ entries }) => {
    const [open, setOpen] = useState<number>()
    const refs = useRef<(HTMLDivElement | null)[]>([])
    useEffect(() => {
        if (open === undefined) return
        const close = () => setOpen(undefined)
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [open])
    return (
        <div className='tl-menubar' role='menubar'>
            {entries.map((entry, i) => (
                <div key={entry.label} ref={el => { refs.current[i] = el }} className={'tl-menubar-item' + (open === i ? ' tl-open' : '')} role='menuitem'
                    onMouseDown={(e) => { e.stopPropagation(); setOpen(open === i ? undefined : i) }}
                    onMouseEnter={() => { if (open !== undefined) setOpen(i) }}>
                    {entry.label}
                    {open === i && (
                        <div style={{ position: 'relative' }}>
                            <PopupMenu items={entry.items} x={-6} y={1} onClose={() => setOpen(undefined)} testId={`tl-menu-${entry.label.toLowerCase().replace(/\s/g, '')}`} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

// A right-click menu, closed by any click outside it.
export const ContextMenu: React.FC<{ items: IMenuItem[]; x: number; y: number; onClose: () => void }> = ({ items, x, y, onClose }) => {
    useEffect(() => {
        const close = () => onClose()
        window.addEventListener('mousedown', close)
        return () => window.removeEventListener('mousedown', close)
    }, [onClose])
    return <PopupMenu items={items} x={x} y={y} onClose={onClose} testId='tl-context-menu' />
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────────────────────────

export const TabStrip = <T extends string>({ tabs, selected, onSelect }: { tabs: { id: T; label: string }[]; selected: T; onSelect: (id: T) => void }): JSX.Element =>
    <div className='tl-tabs' role='tablist'>
        {tabs.map(t => (
            <div key={t.id} className={'tl-tab' + (t.id === selected ? ' tl-selected' : '')} role='tab' aria-selected={t.id === selected} onMouseDown={() => onSelect(t.id)}>{t.label}</div>
        ))}
    </div>

// ─── The list view ────────────────────────────────────────────────────────────────────────────────

export interface IListColumn<T> {
    key: string
    label: string
    width: number
    right?: boolean                            // numbers, aligned right
    text: (row: T) => React.ReactNode          // what the cell shows
    sortValue: (row: T) => string | number     // what it sorts by
}

export interface IListSort {
    column: string
    descending: boolean
}

interface IListViewProps<T> {
    columns: IListColumn<T>[]
    rows: T[]
    rowKey: (row: T) => string
    selected: string[]
    onSelect: (keys: string[]) => void
    widths: Record<string, number>             // the user's, by column key
    onWidth: (column: string, width: number) => void
    sort?: IListSort
    onSort: (sort: IListSort) => void
    onActivate?: (row: T) => void              // double click, Enter
    onContextMenu?: (row: T | undefined, x: number, y: number) => void
    onKeyDown?: (e: React.KeyboardEvent) => void
    testId?: string
    style?: React.CSSProperties
}

/*
    XP's report-style ListView: headers that sort on a click (a second click turns the order round) and resize by
    their right edge, a row selected with the mouse or the arrows, blue while the list has the focus and grey
    when not. Task Manager draws no sort arrow, and neither does this.
*/
export const ListView = <T,>(props: IListViewProps<T>): JSX.Element => {
    const { columns, rows, rowKey, selected, onSelect, widths, sort, onSort } = props
    const listRef = useRef<HTMLDivElement>(null)
    const dragging = useRef(false)

    const sorted = useMemo(() => {
        const column = columns.find(c => c.key === sort?.column)
        if (!column) return rows
        const factor = sort?.descending ? -1 : 1
        return [...rows].sort((a, b) => {
            const va = column.sortValue(a)
            const vb = column.sortValue(b)
            const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })
            return c * factor
        })
    }, [rows, columns, sort])

    const widthOf = (c: IListColumn<T>) => widths[c.key] ?? c.width
    const tableWidth = columns.reduce((n, c) => n + widthOf(c), 0)

    const startResize = (e: React.MouseEvent, column: IListColumn<T>) => {
        e.preventDefault()
        e.stopPropagation()
        dragging.current = true
        const startX = e.clientX
        const startWidth = widthOf(column)
        const move = (ev: MouseEvent) => props.onWidth(column.key, Math.max(20, startWidth + ev.clientX - startX))
        const up = () => {
            window.removeEventListener('mousemove', move)
            window.removeEventListener('mouseup', up)
            setTimeout(() => { dragging.current = false }, 0)
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
    }

    const keyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
            e.preventDefault()
            if (sorted.length === 0) return
            const current = sorted.findIndex(r => rowKey(r) === selected[selected.length - 1])
            let next = current
            if (e.key === 'ArrowDown') next = Math.min(sorted.length - 1, current + 1)
            if (e.key === 'ArrowUp') next = Math.max(0, current < 0 ? 0 : current - 1)
            if (e.key === 'Home') next = 0
            if (e.key === 'End') next = sorted.length - 1
            onSelect([rowKey(sorted[next])])
            listRef.current?.querySelector(`[data-row-index="${next}"]`)?.scrollIntoView({ block: 'nearest' })
            return
        }
        if (e.key === 'Enter' && props.onActivate) {
            const row = sorted.find(r => rowKey(r) === selected[0])
            if (row) props.onActivate(row)
            return
        }
        props.onKeyDown?.(e)
    }

    return (
        <div ref={listRef} className='tl-list' tabIndex={0} onKeyDown={keyDown} data-testid={props.testId} style={props.style}
            onMouseDown={(e) => { if (e.target === listRef.current) onSelect([]) }}
            onContextMenu={(e) => {
                e.preventDefault()
                const box = listRef.current?.closest('.tl-root')?.getBoundingClientRect()
                props.onContextMenu?.(undefined, e.clientX - (box?.left ?? 0), e.clientY - (box?.top ?? 0))
            }}>
            <table className='tl-list-table' style={{ width: tableWidth }} role='grid'>
                <colgroup>{columns.map(c => <col key={c.key} style={{ width: widthOf(c) }} />)}</colgroup>
                <thead className='tl-list-head'>
                    <tr>
                        {columns.map(c => (
                            <th key={c.key} className={c.right ? 'tl-right' : undefined} style={{ position: 'sticky' }} role='columnheader'
                                onClick={() => { if (!dragging.current) onSort({ column: c.key, descending: sort?.column === c.key ? !sort.descending : false }) }}>
                                {c.label}
                                <span className='tl-resizer' onMouseDown={(e) => startResize(e, c)} onClick={(e) => e.stopPropagation()} />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((row, i) => {
                        const key = rowKey(row)
                        return (
                            <tr key={key} data-row-index={i} data-row-key={key} className={'tl-list-row' + (selected.includes(key) ? ' tl-selected' : '')} role='row' aria-selected={selected.includes(key)}
                                onMouseDown={(e) => {
                                    if (e.ctrlKey) onSelect(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
                                    else if (e.button === 0 || !selected.includes(key)) onSelect([key])
                                }}
                                onDoubleClick={() => props.onActivate?.(row)}
                                onContextMenu={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    const box = listRef.current?.closest('.tl-root')?.getBoundingClientRect()
                                    props.onContextMenu?.(row, e.clientX - (box?.left ?? 0), e.clientY - (box?.top ?? 0))
                                }}>
                                {columns.map(c => <td key={c.key} className={c.right ? 'tl-right' : undefined} role='gridcell'>{c.text(row)}</td>)}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ─── Dialogs ──────────────────────────────────────────────────────────────────────────────────────

// A window inside the window: modal, with its title bar and only a close button, as XP's message boxes.
export const Dialog: React.FC<{ title: string; onClose: () => void; children?: React.ReactNode; testId?: string; style?: React.CSSProperties }> = ({ title, onClose, children, testId, style }) => {
    useEffect(() => {
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
        window.addEventListener('keydown', key, true)
        return () => window.removeEventListener('keydown', key, true)
    }, [onClose])
    return (
        <div className='tl-modal' onMouseDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
            <div className='tl-dialog' role='dialog' aria-label={title} data-testid={testId} style={style}>
                <div className='tl-title'>
                    <span className='tl-title-text'>{title}</span>
                    <span className='tl-caption tl-close' onClick={onClose} role='button' aria-label='Close'><CloseGlyph /></span>
                </div>
                <div className='tl-frame'>{children}</div>
            </div>
        </div>
    )
}

export const MessageBox: React.FC<{ title: string; icon: JSX.Element; lines: string[]; buttons: { label: string; onClick: () => void }[]; onClose: () => void; testId?: string }> = ({ title, icon, lines, buttons, onClose, testId }) =>
    <Dialog title={title} onClose={onClose} testId={testId ?? 'tl-messagebox'}>
        <div className='tl-message'>
            {icon}
            <div>{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
        </div>
        <div className='tl-message-buttons'>
            {buttons.map((b, i) => <Button key={b.label} label={b.label} onClick={b.onClick} autoFocus={i === 0} />)}
        </div>
    </Dialog>

// ─── The green-on-black screens of Performance and Networking ─────────────────────────────────────

// A canvas that follows its box, drawn at the device's pixel ratio.
const useCanvas = (draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void, deps: unknown[]) => {
    const ref = useRef<HTMLCanvasElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useEffect(() => {
        const canvas = ref.current
        if (!canvas || typeof ResizeObserver === 'undefined') return
        const observer = new ResizeObserver(() => setSize({ width: canvas.clientWidth, height: canvas.clientHeight }))
        observer.observe(canvas)
        return () => observer.disconnect()
    }, [])
    useEffect(() => {
        const canvas = ref.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx || size.width === 0 || size.height === 0) return
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.round(size.width * ratio)
        canvas.height = Math.round(size.height * ratio)
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        ctx.clearRect(0, 0, size.width, size.height)
        draw(ctx, size.width, size.height)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [size, ...deps])
    return ref
}

const GRID = 12
const GRID_COLOUR = '#008040'

export interface IGraphLine {
    values: number[]
    colour: string
}

/*
    A history graph: the green grid that scrolls left one step per tick, and the lines over it, newest on the
    right. `points` is how many fit across; `ticks` moves the grid (XP's grid moves with the data).
*/
export const Graph: React.FC<{ lines: IGraphLine[]; max: number; points: number; ticks: number; testId?: string }> = ({ lines, max, points, ticks, testId }) => {
    const ref = useCanvas((ctx, width, height) => {
        const step = width / Math.max(1, points - 1)
        ctx.strokeStyle = GRID_COLOUR
        ctx.lineWidth = 1
        const offset = (ticks * step) % GRID
        ctx.beginPath()
        for (let x = width - offset; x >= 0; x -= GRID) { ctx.moveTo(Math.floor(x) + 0.5, 0); ctx.lineTo(Math.floor(x) + 0.5, height) }
        for (let y = height; y >= 0; y -= GRID) { ctx.moveTo(0, Math.floor(y) + 0.5); ctx.lineTo(width, Math.floor(y) + 0.5) }
        ctx.stroke()
        for (const line of lines) {
            if (line.values.length === 0) continue
            ctx.strokeStyle = line.colour
            ctx.beginPath()
            line.values.forEach((v, i) => {
                const x = width - (line.values.length - 1 - i) * step
                const y = height - 1 - Math.min(1, Math.max(0, v / (max || 1))) * (height - 2)
                if (i === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
            })
            ctx.stroke()
        }
    }, [lines, max, points, ticks])
    return <div className='tl-screen' data-testid={testId}><canvas ref={ref} /></div>
}

/*
    The meter on the left of a history: two columns of LED segments, lit from the bottom up to the value, and the
    figure under them.
*/
export const Meter: React.FC<{ value: number; max: number; text: string; testId?: string }> = ({ value, max, text, testId }) => {
    const ref = useCanvas((ctx, width, height) => {
        const top = 6
        const bottom = height - 20
        const segment = 3
        const count = Math.max(1, Math.floor((bottom - top) / segment))
        const lit = Math.round(Math.min(1, Math.max(0, value / (max || 1))) * count)
        const barWidth = Math.min(16, (width - 24) / 2)
        const left = (width - barWidth * 2 - 1) / 2
        for (let i = 0; i < count; i++) {
            const y = bottom - (i + 1) * segment
            ctx.fillStyle = i < lit ? '#00ff00' : '#008040'
            ctx.fillRect(left, y, barWidth, segment - 1)
            ctx.fillRect(left + barWidth + 1, y, barWidth, segment - 1)
        }
    }, [value, max])
    return (
        <div className='tl-screen' data-testid={testId}>
            <canvas ref={ref} />
            <div className='tl-meter-text'>{text}</div>
        </div>
    )
}
