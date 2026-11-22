import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SdsfSession } from '../src/common/SdsfSession'
import { E3270Aid, E3270Color, E3270Highlight, E3270Key, E3270Lock } from '../src/common/terminal/Terminal3270Types'
import { displayCell } from '../src/common/terminal/Display3270'
import { COMMAND_COL, ROW_COMMAND, ROW_PF_KEYS, ROW_RULE, ROW_TITLE } from '../src/common/panels/SdsfLayout'

const type = (s: SdsfSession, text: string) => { for (const c of text) s.key({ key: E3270Key.CHAR, char: c }) }
const enter = (s: SdsfSession) => s.key({ key: E3270Key.AID, aid: E3270Aid.ENTER })

test('the session opens on the primary option menu, cursor on the command line', () => {
    const s = new SdsfSession('k3d-dev-cluster')
    const screen = s.terminal.screen
    assert.match(screen.rowText(0), /^  Display  Filter  View  Print  Options  Search  Help/)
    assert.equal(screen.rowText(ROW_RULE), ' ' + '-'.repeat(79))
    assert.match(screen.rowText(ROW_TITLE), /^ K3D-DEV- -+  SDSF PRIMARY OPTION MENU  -+$/)
    assert.match(screen.rowText(ROW_COMMAND), /^ COMMAND INPUT ===>\s+SCROLL ===> PAGE$/)
    assert.match(screen.rowText(5), /^ DA    Active pods\s+INIT  Initiators \(nodes\)/)
    assert.match(screen.rowText(ROW_PF_KEYS), /F1=HELP .* F6=BOOK/)
    assert.match(screen.rowText(ROW_PF_KEYS + 1), /F7=UP .* F12=RETRIEVE/)
    assert.equal(screen.cursor, screen.address(ROW_COMMAND, COMMAND_COL), 'cursor at column 21, as in the captures')
})

test('colours as in the captures: white action bar with underscored mnemonic, blue rule, red input, turquoise codes', () => {
    const s = new SdsfSession('c')
    const screen = s.terminal.screen
    assert.equal(displayCell(screen, screen.address(0, 2)).color, E3270Color.WHITE)
    assert.equal(displayCell(screen, screen.address(0, 2)).highlight, E3270Highlight.UNDERSCORE)
    assert.equal(displayCell(screen, screen.address(0, 3)).highlight, E3270Highlight.DEFAULT)
    assert.equal(displayCell(screen, screen.address(ROW_RULE, 5)).color, E3270Color.BLUE)
    assert.equal(displayCell(screen, screen.address(ROW_COMMAND, 76)).color, E3270Color.RED, 'PAGE in red')
    assert.equal(displayCell(screen, screen.address(5, 1)).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(screen, screen.address(5, 7)).color, E3270Color.BLUE)
    type(s, 'da')
    assert.equal(displayCell(screen, screen.address(ROW_COMMAND, COMMAND_COL)).color, E3270Color.RED, 'typed command in red')
})

test('a known option answers NOT AVAILABLE (S1), an unknown one INVALID COMMAND, and the keyboard unlocks', () => {
    const s = new SdsfSession('c')
    const screen = s.terminal.screen
    type(s, 'da')
    enter(s)
    assert.match(screen.rowText(ROW_TITLE), /NOT AVAILABLE$/)
    assert.equal(displayCell(screen, screen.address(ROW_TITLE, 79)).color, E3270Color.YELLOW)
    assert.equal(s.terminal.lock, E3270Lock.NONE)
    assert.match(screen.rowText(ROW_COMMAND), /===> DA /, 'the command stays, upper-cased')
    screen.cursor = screen.address(ROW_COMMAND, COMMAND_COL)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, 'xyz')
    enter(s)
    assert.match(screen.rowText(ROW_TITLE), /INVALID COMMAND$/)
    assert.equal(displayCell(screen, screen.address(ROW_TITLE, 79)).color, E3270Color.RED)
})

test('a PF key clears the message and the command; an untouched field keeps its value', () => {
    const s = new SdsfSession('c')
    const screen = s.terminal.screen
    type(s, 'zz')
    enter(s)
    s.key({ key: E3270Key.AID, aid: E3270Aid.PF3 })
    assert.doesNotMatch(screen.rowText(ROW_TITLE), /INVALID/)
    assert.match(screen.rowText(ROW_COMMAND), /SCROLL ===> PAGE$/)
})

test('the scroll amount typed by the operator is kept', () => {
    const s = new SdsfSession('c')
    const screen = s.terminal.screen
    screen.cursor = screen.address(ROW_COMMAND, 76)
    s.key({ key: E3270Key.ERASE_EOF })
    type(s, 'csr')
    enter(s)
    assert.match(screen.rowText(ROW_COMMAND), /SCROLL ===> CSR $/)
})
