import { Painter } from './Painter'
import { ELineCommand } from './LineCommand'
import { ISdsfPod } from '../SdsfTypes'
import { E3270Color } from '../terminal/Terminal3270Types'

/*
    SDSF's CONFIRM ACTION window, over the DA: what is about to be done and to which pods, and a one-character
    field to answer 1 (process) or 2 (cancel the action). It is always shown before a C or CA (R4): cancelling
    a pod deletes it for real.
*/
export interface IPendingCancel {
    command: ELineCommand.CANCEL | ELineCommand.CANCEL_FORCE
    pod: ISdsfPod
}

export const POPUP_ROW = 8
export const POPUP_COL = 9
export const POPUP_WIDTH = 62
const SELECTION_COL_OFFSET = 3
const MAX_LISTED = 5

// Paints the window; returns the attribute address of the selection field.
export const paintConfirm = (p: Painter, pending: IPendingCancel[]): number => {
    p.protectAll()
    const listed = pending.slice(0, MAX_LISTED).map(c =>
        `   ${c.command.padEnd(2)}  ${c.pod.jobId}  ${(c.pod.namespace + '/' + c.pod.name).slice(0, 44)}`)
    if (pending.length > MAX_LISTED) listed.push(`   ... and ${pending.length - MAX_LISTED} more`)
    const what = pending.every(c => c.command === ELineCommand.CANCEL_FORCE)
        ? 'Cancel (delete) immediately, with no grace period:'
        : pending.some(c => c.command === ELineCommand.CANCEL_FORCE)
            ? 'Cancel (delete); CA with no grace period:'
            : 'Cancel (delete), with the pod\'s grace period:'
    const lines = [
        '',
        ' Pending action:',
        `   ${what}`,
        '',
        ...listed,
        '',
        ' Select one of the following and press Enter:',
        '',
        '     1. Process the action',
        '     2. Cancel the action',
        ''
    ]
    p.window(POPUP_ROW, POPUP_COL, POPUP_WIDTH, 'Confirm Action', lines, { color: E3270Color.WHITE })
    // The selection field sits on the line of option 1, before it; what follows it keeps the window's colour.
    const row = POPUP_ROW + 1 + lines.indexOf('     1. Process the action')
    const col = POPUP_COL + 1 + SELECTION_COL_OFFSET
    const field = p.input(row, col, 1)
    p.screen.startField(p.screen.address(row, col + 1), { protected: true, color: E3270Color.WHITE })
    p.cursor(row, col)
    return field
}
