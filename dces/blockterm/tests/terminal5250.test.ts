import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Screen5250 } from '../src/common/Screen5250'
import { Terminal5250 } from '../src/common/Terminal5250'
import { Painter5250 } from '../src/common/Painter5250'
import {
    E5250Adjust, E5250Aid, E5250Attribute, E5250Error, E5250Key, E5250Lock, E5250Shift, GEOMETRY_5250_27X132
} from '../src/common/Terminal5250Types'

// A WRKACTJOB-like screen: a heading, an Opt field of 2 at (9,2), another at (10,2), a monocase command line of
// 20 at (20,7), a numeric-only field of 3 at (5,10), a signed numeric of 5 at (6,10) and an output field.
const fixture = () => {
    const terminal = new Terminal5250()
    const screen = terminal.screen
    const p = new Painter5250(screen)
    p.text(0, 28, 'Work with Active Jobs', E5250Attribute.WHITE)
    const opt1 = p.input(9, 2, 2)
    const opt2 = p.input(10, 2, 2)
    const command = p.input(20, 7, 20, '', { monocase: true })
    const numeric = p.input(5, 10, 3, '', { shift: E5250Shift.NUMERIC_ONLY })
    const signed = p.input(6, 10, 5, '', { shift: E5250Shift.SIGNED_NUMERIC })
    const output = p.input(7, 10, 4, 'OUT', { bypass: true, attribute: E5250Attribute.GREEN })
    screen.cursor = opt1
    return { terminal, screen, opt1, opt2, command, numeric, signed, output }
}

const type = (t: Terminal5250, text: string) => { for (const c of text) t.apply({ key: E5250Key.CHAR, char: c }) }
const key = (t: Terminal5250, k: E5250Key) => t.apply({ key: k })

test('a 24x80 screen by default, 27x132 when asked; addresses row by row', () => {
    assert.equal(new Screen5250().size, 24 * 80)
    const wide = new Screen5250(GEOMETRY_5250_27X132)
    assert.equal(wide.rows, 27)
    assert.equal(wide.cols, 132)
    assert.equal(wide.address(1, 0), 132)
    assert.equal(wide.rowOf(133), 1)
    assert.equal(wide.colOf(133), 1)
    assert.equal(wide.wrap(-1), 27 * 132 - 1)
})

test('Start of Field: attribute before, ending attribute after, the field in the format table', () => {
    const { screen, opt1 } = fixture()
    assert.equal(screen.cells[opt1 - 1].attribute, E5250Attribute.GREEN_UNDERSCORE)
    assert.equal(screen.cells[opt1 + 2].attribute, E5250Attribute.GREEN)
    assert.equal(screen.fieldAt(opt1)?.length, 2)
    assert.equal(screen.fieldAt(opt1 + 2), undefined)
    assert.ok(screen.isInput(opt1 + 1))
    assert.ok(!screen.isInput(opt1 + 2))
    // starting the same field again replaces it
    screen.startField(opt1, 3)
    assert.equal(screen.fields.filter(f => f.start === opt1).length, 1)
    assert.equal(screen.fieldAt(opt1)?.length, 3)
})

test('a constant is its attribute plus its text; rowText shows both as the glass does', () => {
    const { screen } = fixture()
    assert.equal(screen.cells[screen.address(0, 27)].attribute, E5250Attribute.WHITE)
    assert.equal(screen.rowText(0).trim(), 'Work with Active Jobs')
    const p = new Painter5250(screen)
    p.text(1, 1, 'ABC', E5250Attribute.RED, true)
    assert.equal(screen.cells[screen.address(1, 4)].attribute, E5250Attribute.GREEN)
    p.cursor(3, 4)
    assert.equal(screen.cursor, screen.address(3, 4))
})

test('typing fills the field, sets its MDT and skips to the next input field past its end', () => {
    const { terminal, screen, opt1, opt2 } = fixture()
    type(terminal, '4')
    assert.equal(screen.cursor, opt1 + 1)
    type(terminal, '5')
    assert.equal(screen.fieldValue(screen.fieldAt(opt1)!), '45')
    assert.ok(screen.fieldAt(opt1)!.mdt)
    assert.equal(screen.cursor, opt2)
})

test('a field that wants Field Exit keeps the cursor on its last position', () => {
    const terminal = new Terminal5250()
    const start = new Painter5250(terminal.screen).input(2, 2, 2, '', { fieldExitRequired: true })
    new Painter5250(terminal.screen).input(3, 2, 2)
    terminal.screen.cursor = start
    type(terminal, 'AB')
    assert.equal(terminal.screen.cursor, start + 1)
})

test('outside an input field, or on a bypass field, typing is operator error 0005 until Reset', () => {
    const { terminal, screen, output } = fixture()
    screen.cursor = screen.address(0, 0)
    type(terminal, 'X')
    assert.equal(terminal.lock, E5250Lock.OPERATOR)
    assert.equal(terminal.error, E5250Error.PROTECTED)
    assert.equal(screen.cells[0].char, '')
    // locked: nothing else works, not even moving
    key(terminal, E5250Key.RIGHT)
    assert.equal(screen.cursor, 0)
    key(terminal, E5250Key.RESET)
    assert.equal(terminal.lock, E5250Lock.NONE)
    assert.equal(terminal.error, undefined)
    screen.cursor = output
    type(terminal, 'X')
    assert.equal(terminal.error, E5250Error.PROTECTED)
})

test('the shift decides what can be typed: numeric only, digits only, alpha only, signed numeric', () => {
    const { terminal, screen, numeric, signed } = fixture()
    screen.cursor = numeric
    type(terminal, '1-')
    assert.equal(screen.fieldValue(screen.fieldAt(numeric)!), '1-')
    type(terminal, 'A')
    assert.equal(terminal.error, E5250Error.NUMERIC_ONLY)
    key(terminal, E5250Key.RESET)

    screen.cursor = signed
    type(terminal, '1')
    type(terminal, '+')
    assert.equal(terminal.error, E5250Error.NUMERIC_ONLY)
    key(terminal, E5250Key.RESET)

    const p = new Painter5250(screen)
    const alpha = p.input(12, 2, 3, '', { shift: E5250Shift.ALPHA_ONLY })
    screen.cursor = alpha
    type(terminal, 'a.')
    type(terminal, '9')
    assert.equal(terminal.error, E5250Error.NUMERIC_ONLY)
    key(terminal, E5250Key.RESET)
    const digits = p.input(13, 2, 3, '', { shift: E5250Shift.DIGITS_ONLY })
    screen.cursor = digits
    type(terminal, '7')
    type(terminal, '.')
    assert.equal(terminal.error, E5250Error.NUMERIC_ONLY)
})

test('a monocase field turns what is typed to upper case, as an IBM i command line', () => {
    const { terminal, screen, command } = fixture()
    screen.cursor = command
    type(terminal, 'wrkactjob')
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'WRKACTJOB')
})

test('insert mode shifts the field right, and with it full is operator error 0012', () => {
    const { terminal, screen, command } = fixture()
    screen.cursor = command
    type(terminal, 'AC')
    screen.cursor = command + 1
    key(terminal, E5250Key.INSERT)
    assert.ok(terminal.insert)
    type(terminal, 'B')
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'ABC')

    const { terminal: t2, screen: s2, opt1 } = fixture()
    type(t2, '12')
    s2.cursor = opt1
    key(t2, E5250Key.INSERT)
    type(t2, '3')
    assert.equal(t2.error, E5250Error.NO_ROOM_TO_INSERT)
    key(t2, E5250Key.RESET)
    assert.ok(!t2.insert)
})

test('Field Exit nulls the rest of the field, sets its MDT and goes to the next input field', () => {
    const { terminal, screen, command } = fixture()
    screen.setFieldValue(screen.fieldAt(command)!, 'WRKACTJOB SBS(QBATCH)')
    screen.cursor = command + 9
    key(terminal, E5250Key.FIELD_EXIT)
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'WRKACTJOB')
    assert.ok(screen.fieldAt(command)!.mdt)
    // the field after the command line, by address, is the first one again (wrapping)
    assert.equal(screen.cursor, screen.nextInputField(command)!.start)
})

test('Field Exit right-adjusts a zero-fill or blank-fill field', () => {
    const terminal = new Terminal5250()
    const p = new Painter5250(terminal.screen)
    const zero = p.input(2, 2, 5, '', { shift: E5250Shift.NUMERIC_ONLY, adjust: E5250Adjust.ZERO_FILL })
    const blank = p.input(3, 2, 5, '', { adjust: E5250Adjust.BLANK_FILL })
    terminal.screen.cursor = zero
    type(terminal, '42')
    key(terminal, E5250Key.FIELD_EXIT)
    assert.equal(terminal.screen.fieldValue(terminal.screen.fieldAt(zero)!), '00042')
    assert.equal(terminal.screen.cursor, blank)
    type(terminal, 'AB')
    key(terminal, E5250Key.FIELD_PLUS)
    assert.equal(terminal.screen.fieldValue(terminal.screen.fieldAt(blank)!), '   AB')
})

test('a signed numeric field: digits before the sign position; Field+ positive, Field- negative', () => {
    const { terminal, screen, signed } = fixture()
    screen.cursor = signed
    type(terminal, '123')
    key(terminal, E5250Key.FIELD_MINUS)
    assert.equal(screen.fieldValue(screen.fieldAt(signed)!), ' 123-')
    // typed over the first position, Field+ erases from the cursor on: only the 9 is left, positive
    screen.cursor = signed
    type(terminal, '9')
    key(terminal, E5250Key.FIELD_PLUS)
    assert.equal(screen.fieldValue(screen.fieldAt(signed)!), '   9 ')
    // the sign position cannot be typed on
    screen.cursor = signed + 4
    type(terminal, '5')
    assert.equal(terminal.error, E5250Error.PROTECTED)
})

test('Field- outside a numeric field is operator error 0019; Field Exit outside a field is 0005', () => {
    const { terminal, screen, command } = fixture()
    screen.cursor = command
    key(terminal, E5250Key.FIELD_MINUS)
    assert.equal(terminal.error, E5250Error.FIELD_MINUS)
    key(terminal, E5250Key.RESET)
    screen.cursor = 0
    key(terminal, E5250Key.FIELD_EXIT)
    assert.equal(terminal.error, E5250Error.PROTECTED)
})

test('Tab, Backtab, Home and Newline move between input fields, skipping bypass ones', () => {
    const { terminal, screen, opt1, opt2, command, numeric, signed } = fixture()
    // input fields by address: numeric (5,10), signed (6,10), opt1 (9,2), opt2 (10,2), command (20,7)
    screen.cursor = numeric
    key(terminal, E5250Key.TAB)
    assert.equal(screen.cursor, signed)
    key(terminal, E5250Key.TAB)
    assert.equal(screen.cursor, opt1, 'the bypass field at (7,10) is skipped')
    key(terminal, E5250Key.BACKTAB)
    assert.equal(screen.cursor, signed)
    screen.cursor = opt2 + 1
    key(terminal, E5250Key.BACKTAB)
    assert.equal(screen.cursor, opt2, 'inside a field, Backtab goes to its start')
    screen.cursor = command
    key(terminal, E5250Key.TAB)
    assert.equal(screen.cursor, numeric, 'Tab wraps round')
    key(terminal, E5250Key.HOME)
    assert.equal(screen.cursor, numeric)
    screen.cursor = opt1
    key(terminal, E5250Key.NEWLINE)
    assert.equal(screen.cursor, opt2)
    screen.cursor = command
    key(terminal, E5250Key.NEWLINE)
    assert.equal(screen.cursor, numeric, 'no field below: the first of the screen')
    screen.cursor = screen.address(0, 0)
    key(terminal, E5250Key.BACKTAB)
    assert.equal(screen.cursor, command, 'from before every field, Backtab wraps to the last one')
})

test('the arrows move freely and wrap; a click moves the cursor', () => {
    const { terminal, screen } = fixture()
    screen.cursor = 0
    key(terminal, E5250Key.LEFT)
    assert.equal(screen.cursor, screen.size - 1)
    key(terminal, E5250Key.RIGHT)
    assert.equal(screen.cursor, 0)
    key(terminal, E5250Key.DOWN)
    assert.equal(screen.cursor, 80)
    key(terminal, E5250Key.UP)
    assert.equal(screen.cursor, 0)
    terminal.apply({ key: E5250Key.MOVE_CURSOR, address: 161 })
    assert.equal(screen.cursor, 161)
})

test('Backspace and Delete pull the rest of the field left; Erase EOF nulls to its end', () => {
    const { terminal, screen, command } = fixture()
    screen.cursor = command
    type(terminal, 'ABCD')
    key(terminal, E5250Key.BACKSPACE)
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'ABC')
    screen.cursor = command
    key(terminal, E5250Key.BACKSPACE)
    assert.equal(screen.cursor, command, 'Backspace at the start of the field does nothing')
    key(terminal, E5250Key.DELETE)
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'BC')
    screen.cursor = command + 1
    key(terminal, E5250Key.ERASE_EOF)
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), 'B')
    screen.cursor = 0
    key(terminal, E5250Key.DELETE)
    assert.equal(terminal.error, E5250Error.PROTECTED)
})

test('Erase Input empties every input field, clears their MDT and goes to the first one', () => {
    const { terminal, screen, opt1, command, output, numeric } = fixture()
    type(terminal, '4')
    screen.cursor = command
    type(terminal, 'X')
    key(terminal, E5250Key.ERASE_INPUT)
    assert.equal(screen.fieldValue(screen.fieldAt(opt1)!), '')
    assert.equal(screen.fieldValue(screen.fieldAt(command)!), '')
    assert.ok(screen.inputFields().every(f => !f.mdt))
    assert.equal(screen.fieldValue(screen.fieldAt(output)!), 'OUT', 'output fields stay')
    assert.equal(screen.cursor, numeric)
})

test('an AID sends the modified fields (Read MDT Fields) and locks the keyboard until the host answers', () => {
    const { terminal, screen, opt1, command } = fixture()
    type(terminal, '4')
    screen.cursor = command
    type(terminal, 'wrksbs')
    const input = terminal.apply({ key: E5250Key.AID, aid: E5250Aid.ENTER })
    assert.deepEqual(input, {
        aid: E5250Aid.ENTER,
        cursor: command + 6,
        fields: [{ start: opt1, value: '4' }, { start: command, value: 'WRKSBS' }]
    })
    assert.equal(terminal.lock, E5250Lock.SYSTEM)
    // under X SYSTEM nothing works, Reset neither
    type(terminal, 'X')
    key(terminal, E5250Key.RESET)
    assert.equal(terminal.lock, E5250Lock.SYSTEM)
    terminal.unlock()
    assert.equal(terminal.lock, E5250Lock.NONE)
})

test('Clear sends no fields and clears the screen and its format table', () => {
    const { terminal, screen } = fixture()
    type(terminal, '4')
    const input = terminal.aid(E5250Aid.CLEAR)
    assert.deepEqual(input.fields, [])
    assert.equal(screen.fields.length, 0)
    assert.equal(screen.rowText(0).trim(), '')
})

test('a host error covers the error line and locks; Reset gives the line back', () => {
    const { terminal, screen, opt1 } = fixture()
    const last = screen.rows - 1
    new Painter5250(screen).text(last, 1, 'F3=Exit   F5=Refresh', E5250Attribute.BLUE)
    terminal.aid(E5250Aid.ENTER)
    terminal.hostError('Option 9 not valid.', opt1)
    assert.equal(screen.rowText(last).trim(), 'Option 9 not valid.')
    assert.equal(terminal.lock, E5250Lock.HOST_ERROR)
    assert.equal(screen.cursor, opt1)
    type(terminal, '5')
    assert.equal(screen.fieldValue(screen.fieldAt(opt1)!), '', 'locked: nothing is typed')
    key(terminal, E5250Key.RESET)
    assert.equal(terminal.lock, E5250Lock.NONE)
    assert.equal(screen.rowText(last).trim(), 'F3=Exit   F5=Refresh')
    // a host error without a cursor leaves it where it is, and unlock() drops the saved line
    terminal.hostError('Message', undefined, E5250Attribute.RED)
    assert.equal(screen.cursor, opt1)
    terminal.unlock()
    key(terminal, E5250Key.RESET)
    assert.equal(screen.rowText(last).trim(), 'Message')
})

test('an AID key without its AID does nothing', () => {
    const { terminal } = fixture()
    assert.equal(terminal.apply({ key: E5250Key.AID }), undefined)
    assert.equal(terminal.lock, E5250Lock.NONE)
})
