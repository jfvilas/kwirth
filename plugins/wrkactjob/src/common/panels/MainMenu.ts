import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { paintCommandLine, paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

/*
    The entries of the adapted IBM i Main Menu (PRD D5, PRD-fase3 §3): only what this plugin can do. The real
    menu's entries are submenus with no equivalent here, so these are numbered in a row; only 90 keeps its number,
    and a blank line above it, as on IBM i.
*/
export const MENU_ENTRIES: { option: string; text: string; command: string }[] = [
    { option: '1', text: 'Work with active jobs', command: 'WRKACTJOB' },
    { option: '2', text: 'Work with subsystems', command: 'WRKSBS' },
    { option: '3', text: 'Display operator messages', command: 'DSPMSG QSYSOPR' },
    { option: '4', text: 'Work with system status', command: 'WRKSYSSTS' },
    { option: '5', text: 'Work with job schedule entries', command: 'WRKJOBSCDE' },
    { option: '90', text: 'Sign off', command: 'SIGNOFF' }
]

export const SIGN_OFF_OPTION = '90'


/*
    'MAIN' on the left, the title centred, the system on the right, then the menu, as IBM i shows it. A
    selection is typed on the same command line as a command, and the menu's numbers are its options.
    Returns the command line field.
*/
export const paintMainMenu = (p: Painter5250, system: string, command: string, message: string): number => {
    const rows = rowsOf(p.screen)
    p.text(0, 1, 'MAIN', E5250Attribute.WHITE, true)
    paintTitle(p, 'IBM i Main Menu', '', 0)
    paintRight(p, 1, `System:   ${system.slice(0, 10)}`)
    p.text(3, 1, 'Select one of the following:', E5250Attribute.BLUE, true)
    MENU_ENTRIES.forEach((e, i) => {
        const row = 5 + i + (e.option === SIGN_OFF_OPTION ? 1 : 0)
        p.text(row, 6, `${e.option.padStart(2)}. `, E5250Attribute.GREEN)
        p.text(row, 10, e.text, E5250Attribute.GREEN, true)
    })
    const field = paintCommandLine(p, rows, 'Selection or command', command)
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
    return field
}

// After SIGNOFF: the session is over; any key starts a new one at the menu.
export const paintSignedOff = (p: Painter5250, system: string): void => {
    paintTitle(p, 'Sign Off', system, 0)
    p.text(5, 6, 'Your job has ended.', E5250Attribute.GREEN, true)
    p.text(7, 6, 'Press Enter to sign on again.', E5250Attribute.BLUE, true)
}
