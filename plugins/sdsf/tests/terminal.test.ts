import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Screen3270 } from '../src/common/terminal/Screen3270'
import { Terminal3270 } from '../src/common/terminal/Terminal3270'
import { E3270Aid, E3270Color, E3270Highlight, E3270Intensity, E3270Key, E3270Lock } from '../src/common/terminal/Terminal3270Types'
import { baseColor, displayCell, displayRow, oiaOf } from '../src/common/terminal/Display3270'
import { Painter } from '../src/common/panels/Painter'

// A screen with a label at (0,1), an input of 5 at (0,10) and another of 3 at (2,5).
const fixture = () => {
    const terminal = new Terminal3270()
    const p = new Painter(terminal.screen)
    p.text(0, 1, 'LABEL')
    const a = p.input(0, 10, 5, 'AB')
    const b = p.input(2, 5, 3)
    terminal.screen.cursor = a + 1
    return { terminal, screen: terminal.screen, a, b }
}

const type = (t: Terminal3270, text: string) => { for (const c of text) t.apply({ key: E3270Key.CHAR, char: c }) }

test('model 3 geometry: 32x80, addresses wrap', () => {
    const s = new Screen3270()
    assert.equal(s.size, 2560)
    assert.equal(s.address(31, 79), 2559)
    assert.equal(s.address(32, 0), 0)
    assert.equal(s.wrap(-1), 2559)
    assert.equal(s.rowOf(81), 1)
    assert.equal(s.colOf(81), 1)
})

test('an unformatted screen is all input; attributes make fields', () => {
    const s = new Screen3270()
    assert.equal(s.isFormatted(), false)
    assert.equal(s.isProtected(100), false)
    assert.equal(s.fieldBounds(100), undefined)
    s.startField(10, { protected: false })
    s.startField(20, { protected: true })
    assert.equal(s.isFormatted(), true)
    assert.equal(s.isProtected(10), true, 'the attribute position itself')
    assert.equal(s.isProtected(15), false)
    assert.equal(s.isProtected(25), true)
    assert.equal(s.isProtected(5), true, 'before the first attribute it wraps to the last one')
    assert.deepEqual(s.fieldBounds(15), { attribute: 10, first: 11, last: 19 })
    assert.equal(s.fieldLength(10), 9)
    assert.deepEqual(s.fieldAddresses(), [10, 20])
})

test('writing over an attribute replaces it', () => {
    const s = new Screen3270()
    s.startField(10, { protected: false })
    s.write(9, 'XYZ')
    assert.equal(s.isAttribute(10), false)
    assert.equal(s.isFormatted(), false)
})

test('typing fills the field, sets the MDT and skips to the next input field at its end', () => {
    const { terminal, screen, a, b } = fixture()
    type(terminal, 'XYZ')
    assert.equal(screen.fieldValue(a), 'XYZ')
    assert.equal(screen.cells[a].attribute!.mdt, true)
    assert.equal(screen.cursor, a + 4)
    type(terminal, 'QW')
    assert.equal(screen.fieldValue(a), 'XYZQW')
    assert.equal(screen.cursor, b + 1, 'past the last position the cursor skips to the next input field')
    assert.equal(screen.cells[b].attribute!.mdt, false)
})

test('typing on a protected position locks the keyboard until Reset', () => {
    const { terminal, screen } = fixture()
    screen.cursor = 2
    type(terminal, 'Z')
    assert.equal(terminal.lock, E3270Lock.PROTECTED)
    assert.equal(screen.cells[2].char, 'A')
    // locked: nothing else works
    terminal.apply({ key: E3270Key.RIGHT })
    assert.equal(screen.cursor, 2)
    terminal.apply({ key: E3270Key.RESET })
    assert.equal(terminal.lock, E3270Lock.NONE)
    terminal.apply({ key: E3270Key.RIGHT })
    assert.equal(screen.cursor, 3)
})

test('a numeric field refuses letters', () => {
    const terminal = new Terminal3270()
    const f = new Painter(terminal.screen).input(1, 1, 4, '', { numeric: true })
    terminal.screen.cursor = f + 1
    type(terminal, '1.')
    assert.equal(terminal.screen.fieldValue(f), '1.')
    type(terminal, 'x')
    assert.equal(terminal.lock, E3270Lock.NUMERIC)
})

test('insert mode shifts right, and overflows when the field is full', () => {
    const { terminal, screen, a } = fixture()
    terminal.apply({ key: E3270Key.INSERT })
    assert.equal(terminal.insert, true)
    type(terminal, 'X')
    assert.equal(screen.fieldValue(a), 'XAB')
    type(terminal, 'YZ')
    assert.equal(screen.fieldValue(a), 'XYZAB')
    type(terminal, 'W')
    assert.equal(terminal.lock, E3270Lock.OVERFLOW)
    terminal.apply({ key: E3270Key.RESET })
    assert.equal(terminal.insert, false, 'Reset also leaves insert mode')
})

test('delete, backspace and erase EOF work inside the field and refuse protected positions', () => {
    const { terminal, screen, a } = fixture()
    type(terminal, 'ABCDE')
    screen.cursor = a + 2
    terminal.apply({ key: E3270Key.DELETE })
    assert.equal(screen.fieldValue(a), 'ACDE')
    terminal.apply({ key: E3270Key.BACKSPACE })
    assert.equal(screen.fieldValue(a), 'CDE')
    assert.equal(screen.cursor, a + 1)
    terminal.apply({ key: E3270Key.BACKSPACE })
    assert.equal(screen.fieldValue(a), 'CDE', 'at the first position backspace does nothing')
    screen.cursor = a + 2
    terminal.apply({ key: E3270Key.ERASE_EOF })
    assert.equal(screen.fieldValue(a), 'C')
    screen.cursor = 3
    terminal.apply({ key: E3270Key.ERASE_EOF })
    assert.equal(terminal.lock, E3270Lock.PROTECTED)
})

test('tab, backtab, home and newline move between input fields', () => {
    const { terminal, screen, a, b } = fixture()
    terminal.apply({ key: E3270Key.TAB })
    assert.equal(screen.cursor, b + 1)
    terminal.apply({ key: E3270Key.TAB })
    assert.equal(screen.cursor, a + 1, 'tab wraps round the screen')
    screen.cursor = b + 3
    terminal.apply({ key: E3270Key.BACKTAB })
    assert.equal(screen.cursor, b + 1, 'inside a field: to its start')
    terminal.apply({ key: E3270Key.BACKTAB })
    assert.equal(screen.cursor, a + 1, 'at its start: to the previous field')
    screen.cursor = 5
    terminal.apply({ key: E3270Key.HOME })
    assert.equal(screen.cursor, a + 1)
    screen.cursor = screen.address(1, 40)
    terminal.apply({ key: E3270Key.NEWLINE })
    assert.equal(screen.cursor, b + 1, 'row 2 has an input field: newline lands on it')
    terminal.apply({ key: E3270Key.NEWLINE })
    assert.equal(screen.cursor, a + 1, 'no input on the following rows: the next field, wrapping')
})

test('arrows move the cursor and wrap round the screen; a click places it', () => {
    const t = new Terminal3270()
    t.apply({ key: E3270Key.UP })
    assert.equal(t.screen.cursor, t.screen.address(31, 0))
    t.apply({ key: E3270Key.DOWN })
    assert.equal(t.screen.cursor, 0)
    t.apply({ key: E3270Key.LEFT })
    assert.equal(t.screen.cursor, 2559)
    t.apply({ key: E3270Key.RIGHT })
    assert.equal(t.screen.cursor, 0)
    t.apply({ key: E3270Key.MOVE_CURSOR, address: 123 })
    assert.equal(t.screen.cursor, 123)
})

test('an AID sends the modified fields and locks the keyboard in X SYSTEM, which Reset cannot clear', () => {
    const { terminal, a } = fixture()
    type(terminal, 'Z')
    const input = terminal.apply({ key: E3270Key.AID, aid: E3270Aid.ENTER })
    assert.deepEqual(input, { aid: E3270Aid.ENTER, cursor: a + 2, fields: [{ address: a, value: 'ZB' }] })
    assert.equal(terminal.lock, E3270Lock.SYSTEM)
    assert.equal(terminal.apply({ key: E3270Key.AID, aid: E3270Aid.ENTER }), undefined, 'no second AID while locked')
    terminal.apply({ key: E3270Key.RESET })
    assert.equal(terminal.lock, E3270Lock.SYSTEM)
    terminal.unlock()
    assert.equal(terminal.lock, E3270Lock.NONE)
})

test('CLEAR and PA keys are a short read; CLEAR wipes the screen', () => {
    const { terminal, screen } = fixture()
    type(terminal, 'Z')
    const pa = terminal.apply({ key: E3270Key.AID, aid: E3270Aid.PA1 })
    assert.deepEqual(pa?.fields, [])
    terminal.unlock()
    const clear = terminal.apply({ key: E3270Key.AID, aid: E3270Aid.CLEAR })
    assert.deepEqual(clear?.fields, [])
    assert.equal(screen.isFormatted(), false)
})

test('base colours follow the 3270 rule; extended and character attributes override', () => {
    assert.equal(baseColor(undefined), E3270Color.GREEN)
    const s = new Screen3270()
    const p = new Painter(s)
    p.text(0, 1, 'BLUE')
    p.text(0, 10, 'WHITE', { intensity: E3270Intensity.HIGH })
    p.text(0, 20, 'TURQ', { color: E3270Color.TURQUOISE })
    p.input(0, 30, 4, 'RED')
    p.input(0, 40, 4, 'GRN', { intensity: E3270Intensity.NORMAL })
    p.input(0, 50, 4, 'PWD', { intensity: E3270Intensity.HIDDEN })
    p.attribute(0, 2, 1, E3270Color.YELLOW, E3270Highlight.UNDERSCORE)
    assert.equal(displayCell(s, 1).color, E3270Color.BLUE)
    assert.equal(displayCell(s, 2).color, E3270Color.YELLOW)
    assert.equal(displayCell(s, 2).highlight, E3270Highlight.UNDERSCORE)
    assert.equal(displayCell(s, 10).color, E3270Color.WHITE)
    assert.equal(displayCell(s, 20).color, E3270Color.TURQUOISE)
    assert.equal(displayCell(s, 30).color, E3270Color.RED)
    assert.equal(displayCell(s, 40).color, E3270Color.GREEN)
    assert.equal(displayCell(s, 50).text, ' ', 'a hidden field shows nothing')
    assert.equal(displayCell(s, 0).text, ' ', 'an attribute shows as a blank')
})

test('display rows are runs, with the cursor always on its own', () => {
    const s = new Screen3270()
    new Painter(s).text(0, 1, 'ABCDEF')
    s.cursor = 3
    const runs = displayRow(s, 0, true)
    assert.equal(runs.map(r => r.text).join(''), ' ABCDEF' + ' '.repeat(73))
    const cursor = runs.filter(r => r.cursor)
    assert.equal(cursor.length, 1)
    assert.equal(cursor[0].text, 'C')
    assert.equal(displayRow(s, 0, false).filter(r => r.cursor).length, 0)
})

test('the OIA shows the lock, insert mode and the 1-based cursor position', () => {
    const t = new Terminal3270()
    t.screen.cursor = t.screen.address(1, 20)
    assert.deepEqual(oiaOf(t), { ready: '4A', lock: '', insert: false, position: '02/021' })
    t.lock = E3270Lock.SYSTEM
    t.insert = true
    assert.equal(oiaOf(t).lock, 'X SYSTEM')
    assert.equal(oiaOf(t).insert, true)
    t.lock = E3270Lock.PROTECTED
    assert.equal(oiaOf(t).lock, 'X Protected')
})
