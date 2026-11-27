import React, { useRef } from 'react'
import { DraggableCore, DraggableData, DraggableEvent } from 'react-draggable'
import { Resizable, ResizeCallbackData, ResizeHandle } from 'react-resizable'
import { IWindowFrame } from '../TasklistSessionTypes'
import { placementOf, resizedPlacement, TPlacement } from '../window/Placement'
import { CloseGlyph, MaximizeGlyph, MinimizeGlyph, RestoreGlyph } from './LunaIcons'

// The eight edges and corners a window is resized by, as XP's.
const RESIZE_HANDLES: ResizeHandle[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export interface ILunaWindowProps {
    title: string
    icon: JSX.Element
    frame: IWindowFrame
    firstWidth: number                     // its size the first time, centred
    firstHeight: number
    desktop: HTMLElement | null            // what it is dragged against (it stays still while the window moves)
    desktopWidth: number
    desktopHeight: number
    active: boolean                        // in front: a bright title bar
    zIndex: number
    onFrame: (patch: Partial<IWindowFrame>) => void
    onActivate: () => void
    onClose?: () => void                   // none: the close button is there, disabled
    compact?: boolean                      // the Task Manager's tiny footprint: no title bar
    testId: string
    children?: React.ReactNode             // the window's body: menus, panels, status bar
}

/*
    An XP window on the tab's desktop: the title bar with its icon and its three buttons, dragged by the title bar,
    resized by its eight edges and corners, maximised by its button or a double click, minimised to the taskbar.
    Where it is lives in its frame, in the session; a click anywhere on it brings it to the front.
*/
export const LunaWindow: React.FC<ILunaWindowProps> = (props) => {
    const { frame, desktopWidth, desktopHeight, onFrame } = props
    const maximized = frame.maximized
    const [x, y, w, h] = maximized ? [0, 0, desktopWidth, desktopHeight] : placementOf(frame, props.firstWidth, props.firstHeight, desktopWidth, desktopHeight)

    const titleRef = useRef<HTMLDivElement>(null)
    const drag = (_e: DraggableEvent, d: DraggableData) => {
        const [x0, y0, w0, h0] = placementOf(frame, props.firstWidth, props.firstHeight, desktopWidth, desktopHeight)
        onFrame({ x: Math.max(0, Math.min(desktopWidth - w0, x0 + d.deltaX)), y: Math.max(0, Math.min(desktopHeight - h0, y0 + d.deltaY)), width: w0, height: h0 })
    }
    // the placement when a resize started, so a left or top edge moves the window too
    const resizeStart = useRef<TPlacement>([0, 0, 0, 0])
    const resize = (_e: React.SyntheticEvent, data: ResizeCallbackData) => {
        const [nx, ny, nw, nh] = resizedPlacement(resizeStart.current, data.handle, data.size.width, data.size.height, desktopWidth, desktopHeight)
        onFrame({ x: nx, y: ny, width: nw, height: nh })
    }
    const classes = 'tl-window' + (maximized ? ' tl-max' : '') + (props.compact ? ' tl-compact' : '') + (props.active ? '' : ' tl-inactive')

    return (
        <Resizable width={w} height={h} resizeHandles={maximized ? [] : RESIZE_HANDLES} onResizeStart={() => { resizeStart.current = [x, y, w, h] }} onResize={resize}
            handle={(axis, ref) => <span ref={ref as React.Ref<HTMLSpanElement>} className={`tl-resize tl-resize-${axis}`} data-testid={`tl-resize-${axis}`} />}>
            <div className={classes} data-testid={props.testId} onMouseDownCapture={props.onActivate}
                style={{ left: x, top: y, width: w, height: h, zIndex: props.zIndex, display: frame.minimized ? 'none' : undefined }}>
                {/*
                    Measured against the desktop, which stays still. Against the window, which moves with every step,
                    each step was corrected twice over: the window shook and jumped while being dragged.
                */}
                <DraggableCore nodeRef={titleRef} onDrag={drag} cancel='.tl-caption' disabled={maximized || !props.desktop} offsetParent={props.desktop ?? undefined}>
                    <div className='tl-title' ref={titleRef} onDoubleClick={() => onFrame({ maximized: !maximized })}>
                        {props.icon}
                        <span className='tl-title-text'>{props.title}</span>
                        <span className='tl-caption' aria-label='Minimize' role='button' onClick={() => onFrame({ minimized: true })}><MinimizeGlyph /></span>
                        <span className='tl-caption' aria-label={maximized ? 'Restore' : 'Maximize'} role='button'
                            onClick={() => onFrame({ maximized: !maximized })}>{maximized ? <RestoreGlyph /> : <MaximizeGlyph />}</span>
                        {props.onClose
                            ? <span className='tl-caption tl-close' aria-label='Close' role='button' onClick={props.onClose}><CloseGlyph /></span>
                            : <span className='tl-caption tl-close tl-disabled' aria-label='Close' aria-disabled='true'><CloseGlyph /></span>}
                    </div>
                </DraggableCore>
                {props.children}
            </div>
        </Resizable>
    )
}
