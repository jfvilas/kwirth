import { Painter } from './Painter'
import { EMessageLevel, paintActionBar, paintCommandLine, paintPfKeys, paintShortMessage, ROW_FIRST_BODY, ROW_TITLE } from './SdsfLayout'
import { E3270Color } from '../terminal/Terminal3270Types'

/*
    SDSF PRIMARY OPTION MENU, with the options that have a Kubernetes meaning. The JES-only ones (printers,
    punches, readers, spool…) are not shown, because there is nothing behind them.
*/
export interface IMenuOption {
    code: string
    description: string
}

// undefined is a blank row, as the groups of the real menu have between them.
export const MENU_LEFT: (IMenuOption | undefined)[] = [
    { code: 'DA', description: 'Active pods' },
    { code: 'I', description: 'Input queue (jobs waiting to run)' },
    { code: 'O', description: 'Output queue (ended jobs)' },
    { code: 'H', description: 'Held output queue (suspended cronjobs)' },
    { code: 'ST', description: 'Status of jobs (jobs and cronjobs)' },
    undefined,
    { code: 'LOG', description: 'System log (events)' },
    { code: 'SR', description: 'System requests (pending CSRs)' },
    undefined,
    { code: 'JC', description: 'Job classes (priority classes)' },
    undefined,
    { code: 'RES', description: 'Resources (quotas)' }
]

export const MENU_RIGHT: (IMenuOption | undefined)[] = [
    { code: 'INIT', description: 'Initiators (nodes)' },
    undefined, undefined, undefined, undefined, undefined,
    { code: 'ULOG', description: 'User session log' },
    { code: 'SP', description: 'Spool volumes (PVs and claims)' }
]

export interface IMenuState {
    system: string         // shown where SDSF shows the system name: the cluster
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
}

// Paints the menu; returns the command and scroll field addresses.
export const paintPrimaryMenu = (p: Painter, state: IMenuState): { command: number; scroll: number } => {
    const cols = p.screen.cols
    paintActionBar(p)
    const system = state.system.toUpperCase().slice(0, 8).padEnd(8)
    const heading = '  SDSF PRIMARY OPTION MENU  '
    const dashes = cols - 1 - system.length - 1 - heading.length
    const left = Math.floor(dashes / 2)
    p.text(ROW_TITLE, 1, system + ' ' + '-'.repeat(left) + heading + '-'.repeat(dashes - left), { color: E3270Color.WHITE })
    paintShortMessage(p, state.message, state.messageLevel)
    const fields = paintCommandLine(p, state.command, state.scroll)

    const paintColumn = (options: (IMenuOption | undefined)[], col: number) => options.forEach((o, i) => {
        if (!o) return
        p.text(ROW_FIRST_BODY + 1 + i, col, o.code.padEnd(5), { color: E3270Color.TURQUOISE })
        p.text(ROW_FIRST_BODY + 1 + i, col + 6, o.description, { color: E3270Color.BLUE })
    })
    paintColumn(MENU_LEFT, 1)
    paintColumn(MENU_RIGHT, 41)
    p.text(ROW_FIRST_BODY + 2 + MENU_LEFT.length, 1, 'END  ', { color: E3270Color.TURQUOISE })
    p.text(ROW_FIRST_BODY + 2 + MENU_LEFT.length, 7, 'Exit SDSF', { color: E3270Color.BLUE })
    paintPfKeys(p)
    return fields
}
