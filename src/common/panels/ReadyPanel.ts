import { E3270Color, Painter } from '@jfvilas/kwirth-dce-blockterm'

/*
    What is left after END on the primary menu: TSO's READY, as when SDSF ends. Typing SDSF (or SDSF DA) goes
    back in; anything else gets TSO's answer to an unknown command.
*/
export interface IReadyState {
    lines: string[]            // what TSO has said so far, oldest first
}

// Paints the conversation and the input line under it; returns the input field's attribute.
export const paintReady = (p: Painter, state: IReadyState): number => {
    const rows = p.screen.rows
    const shown = state.lines.slice(-(rows - 2))
    shown.forEach((line, i) => p.text(i, 1, line.slice(0, p.screen.cols - 1), { color: E3270Color.GREEN }))
    const row = shown.length
    const field = p.input(row, 1, p.screen.cols - 2, '', { color: E3270Color.GREEN })
    p.cursor(row, 1)
    return field
}
