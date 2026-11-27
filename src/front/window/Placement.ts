import { TasklistSession } from '../TasklistSession'

// The window when it is not maximised: its first size, and the smallest it can be dragged to (as XP's).
export const NORMAL_WIDTH = 620
export const NORMAL_HEIGHT = 600
export const MIN_WIDTH = 380
export const MIN_HEIGHT = 320

// [x, y, width, height] on the tab's desktop
export type TPlacement = [number, number, number, number]

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n))

/*
    Where the window is on a desktop of this size: where the user left it, or centred the first time; never
    bigger than the desktop and never out of it, so a tab that shrinks (or leaves full screen) brings it back in.
*/
export const placementOf = (session: TasklistSession, desktopWidth: number, desktopHeight: number): TPlacement => {
    const width = Math.min(session.windowWidth ?? NORMAL_WIDTH, desktopWidth)
    const height = Math.min(session.windowHeight ?? NORMAL_HEIGHT, desktopHeight)
    const x = session.windowX ?? (desktopWidth - width) / 2
    const y = session.windowY ?? (desktopHeight - height) / 2
    return [clamp(Math.round(x), 0, desktopWidth - width), clamp(Math.round(y), 0, desktopHeight - height), width, height]
}

/*
    A resize from one of the eight handles ('n', 'se', 'w'...): the new size, and — when the handle is on the left
    or the top edge — the corner moved so the opposite edge stays where it was. Kept inside the desktop and above
    the minimum size.
*/
export const resizedPlacement = (start: TPlacement, handle: string, width: number, height: number, desktopWidth: number, desktopHeight: number): TPlacement => {
    const [x0, y0, w0, h0] = start
    let x = x0, y = y0
    let w = Math.max(MIN_WIDTH, width)
    let h = Math.max(MIN_HEIGHT, height)
    if (handle.includes('w')) {
        w = Math.min(w, x0 + w0)
        x = x0 + w0 - w
    }
    else w = Math.min(w, desktopWidth - x0)
    if (handle.includes('n')) {
        h = Math.min(h, y0 + h0)
        y = y0 + h0 - h
    }
    else h = Math.min(h, desktopHeight - y0)
    return [Math.round(x), Math.round(y), Math.round(w), Math.round(h)]
}
