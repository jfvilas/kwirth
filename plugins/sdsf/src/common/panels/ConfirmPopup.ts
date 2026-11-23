import { E3270Color, E3270Highlight, E3270Intensity, Painter } from '@jfvilas/kwirth-dce-blockterm'
import { ELineCommand } from './LineCommand'
import { ESdsfObjectKind } from '../SdsfTypes'

/*
    SDSF's Confirm Action window, as the reference capture shows it: ONE action at a time, over the table, by
    its line number and its job name. It does not say what the action does — the letter is still on the row's
    NP — and offers to process it, discard it, or process it and stop asking (SET CONFIRM OFF):

        ┌────────────────────────────────────────┐
        │                                        │
        │             Confirm Action             │       turquoise
        │                                        │
        │ 1_  1.  Process action character       │       field turquoise, underscored; text white
        │     2.  Discard action character       │
        │     3.  Process action character and   │
        │         set confirmation off           │
        │                                        │
        │ Line number: 1        API-7D9F         │       label green, values turquoise
        │                                        │
        │  F1=Help     F2=Split     F3=Cancel    │       blue
        │  F9=Swap     F12=Cancel                │
        └────────────────────────────────────────┘       frame yellow

    It is shown before what changes the cluster: C and CA (R4), which delete a pod, or a Job or CronJob with
    its pods; and S, Z and P on INIT, which start, halt or drain a node.
*/
export interface IActionTarget {
    kind: ESdsfObjectKind
    namespace: string          // '' for a node
    name: string
    jobId: string              // '' for a node
}

export interface IPendingAction {
    command: ELineCommand
    target: IActionTarget
    line: number               // the row of the table it was typed on, 1-based: the window's 'Line number'
    jobname: string            // as the table shows it: the JOBNAME, or the ID on INIT
}

// What the action does, for PF1 on the window: the window itself does not say it, as on SDSF.
export const ACTION_HELP: Partial<Record<ELineCommand, string>> = {
    [ELineCommand.CANCEL]: 'C cancels (deletes) it, with its grace period; a Job or CronJob goes with its pods.',
    [ELineCommand.CANCEL_FORCE]: 'CA cancels (deletes) it immediately, with no grace period.',
    [ELineCommand.SELECT]: 'S on INIT starts the node: uncordon, it takes pods again.',
    [ELineCommand.HALT]: 'Z halts the node: cordon, no new pods; the running ones stay.',
    [ELineCommand.PURGE]: 'P drains the node: cordon, and evict its pods but the DaemonSet and static ones.'
}

export const POPUP_WIDTH = 42
export const POPUP_HEIGHT = 14
const INNER = POPUP_WIDTH - 2
const FIELD_OFFSET = 2         // the selection field, from the left border
const RIGHT_MARGIN = 13        // as the capture: to the right of the JOBNAME, short of the screen's edge

const FRAME = E3270Color.YELLOW
const TITLE = E3270Color.TURQUOISE
const TEXT = E3270Color.WHITE
const LABEL = E3270Color.GREEN
const VALUE = E3270Color.TURQUOISE
const KEYS = E3270Color.BLUE

export interface IConfirmPlace {
    top: number
    left: number
}

// Over the table, from the row of the column headers; on the right, as on SDSF.
export const confirmPlace = (rows: number, cols: number, headersRow: number): IConfirmPlace => ({
    top: Math.max(1, Math.min(headersRow, rows - 2 - POPUP_HEIGHT)),
    left: Math.max(0, cols - POPUP_WIDTH - RIGHT_MARGIN)
})

// Paints the window; returns the attribute address of the selection field.
export const paintConfirm = (p: Painter, pending: IPendingAction, headersRow: number): number => {
    const screen = p.screen
    p.protectAll()
    const { top, left } = confirmPlace(screen.rows, screen.cols, headersRow)
    const lineNumber = `Line number: ${pending.line}`
    const rows: { text: string; colors?: { from: number; length: number; color: E3270Color }[] }[] = [
        { text: '' },
        { text: 'Confirm Action'.padStart(Math.floor((INNER + 14) / 2)), colors: [{ from: 0, length: INNER, color: TITLE }] },
        { text: '' },
        { text: '     1.  Process action character', colors: [{ from: 0, length: INNER, color: TEXT }] },
        { text: '     2.  Discard action character', colors: [{ from: 0, length: INNER, color: TEXT }] },
        { text: '     3.  Process action character and', colors: [{ from: 0, length: INNER, color: TEXT }] },
        { text: '         set confirmation off', colors: [{ from: 0, length: INNER, color: TEXT }] },
        { text: '' },
        {
            text: ` ${lineNumber.padEnd(22)}${pending.jobname}`,
            colors: [{ from: 1, length: 12, color: LABEL }, { from: 13, length: INNER - 13, color: VALUE }]
        },
        { text: '' },
        { text: '  F1=Help     F2=Split     F3=Cancel', colors: [{ from: 0, length: INNER, color: KEYS }] },
        { text: '  F9=Swap     F12=Cancel', colors: [{ from: 0, length: INNER, color: KEYS }] }
    ]
    const frame = [
        '┌' + '─'.repeat(INNER) + '┐',
        ...rows.map(r => '│' + r.text.slice(0, INNER).padEnd(INNER) + '│'),
        '└' + '─'.repeat(INNER) + '┘'
    ]
    // The frame is one protected field per row, yellow; the inside is coloured character by character. Right
    // after it the field that was under it starts again, so the table beside the window keeps its colours.
    frame.forEach((text, i) => {
        const after = screen.address(top + i, left + POPUP_WIDTH)
        const under = screen.isAttribute(after) ? undefined : screen.attributeOf(after)
        p.text(top + i, left, text, { color: FRAME })
        if (under) screen.startField(after, { ...under })
        const colors = i === 0 || i === frame.length - 1 ? undefined : rows[i - 1].colors
        for (const c of colors ?? []) p.attribute(top + i, left + 1 + c.from, Math.min(c.length, INNER - c.from), c.color)
    })
    // The selection: pre-filled with 1, on the line of option 1. After it the row is the frame's field again (the
    // options keep their own colour, character by character), so the right border stays yellow.
    const row = top + 4
    const col = left + 1 + FIELD_OFFSET
    const field = p.input(row, col, 1, '1', { color: VALUE, highlight: E3270Highlight.UNDERSCORE, intensity: E3270Intensity.HIGH })
    screen.startField(screen.address(row, col + 1), { protected: true, color: FRAME })
    p.cursor(row, col)
    return field
}
