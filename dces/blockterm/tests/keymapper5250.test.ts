import { test } from 'node:test'
import assert from 'node:assert/strict'
import { KeyMapper5250 } from '../src/front/KeyMapper5250'
import { IKeyEventLike } from '../src/front/KeyMapper'
import { E5250Aid, E5250Key } from '../src/common/Terminal5250Types'

const ev = (code: string, key: string, mods: Partial<IKeyEventLike> = {}): IKeyEventLike =>
    ({ code, key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods })

test('right Ctrl alone is ENTER and left Ctrl alone is RESET, on release', () => {
    const m = new KeyMapper5250()
    assert.equal(m.down(ev('ControlRight', 'Control')), undefined)
    assert.deepEqual(m.up(ev('ControlRight', 'Control')), { key: E5250Key.AID, aid: E5250Aid.ENTER })
    m.down(ev('ControlLeft', 'Control'))
    assert.deepEqual(m.up(ev('ControlLeft', 'Control')), { key: E5250Key.RESET })
})

test('a Ctrl held with another key is an ordinary Ctrl; a lost focus forgets it', () => {
    const m = new KeyMapper5250()
    m.down(ev('ControlRight', 'Control'))
    assert.equal(m.down(ev('KeyC', 'c', { ctrlKey: true })), undefined)
    assert.equal(m.up(ev('ControlRight', 'Control')), undefined)
    m.down(ev('ControlLeft', 'Control'))
    m.cancel()
    assert.equal(m.up(ev('ControlLeft', 'Control')), undefined)
    assert.equal(m.up(ev('KeyA', 'a')), undefined)
    assert.equal(m.down(ev('KeyA', 'a', { metaKey: true })), undefined)
})

test('Intro is FIELD EXIT; numpad + and - are FIELD+ and FIELD-', () => {
    const m = new KeyMapper5250()
    assert.deepEqual(m.down(ev('Enter', 'Enter')), { key: E5250Key.FIELD_EXIT })
    assert.deepEqual(m.down(ev('NumpadEnter', 'Enter')), { key: E5250Key.FIELD_EXIT })
    assert.deepEqual(m.down(ev('NumpadAdd', '+')), { key: E5250Key.FIELD_PLUS })
    assert.deepEqual(m.down(ev('NumpadSubtract', '-')), { key: E5250Key.FIELD_MINUS })
    // the main keyboard's + and - are characters
    assert.deepEqual(m.down(ev('Minus', '-')), { key: E5250Key.CHAR, char: '-' })
})

test('F1..F12 are F1..F12 and with Shift F13..F24; PgDn and PgUp roll', () => {
    const m = new KeyMapper5250()
    assert.deepEqual(m.down(ev('F1', 'F1')), { key: E5250Key.AID, aid: E5250Aid.F1 })
    assert.deepEqual(m.down(ev('F12', 'F12')), { key: E5250Key.AID, aid: E5250Aid.F12 })
    assert.deepEqual(m.down(ev('F11', 'F11', { shiftKey: true })), { key: E5250Key.AID, aid: E5250Aid.F23 })
    assert.deepEqual(m.down(ev('PageDown', 'PageDown')), { key: E5250Key.AID, aid: E5250Aid.ROLL_UP })
    assert.deepEqual(m.down(ev('PageUp', 'PageUp')), { key: E5250Key.AID, aid: E5250Aid.ROLL_DOWN })
})

test('the editing and moving keys', () => {
    const m = new KeyMapper5250()
    const cases: [string, string, E5250Key, Partial<IKeyEventLike>?][] = [
        ['Tab', 'Tab', E5250Key.TAB],
        ['Tab', 'Tab', E5250Key.BACKTAB, { shiftKey: true }],
        ['Home', 'Home', E5250Key.HOME],
        ['End', 'End', E5250Key.ERASE_EOF],
        ['End', 'End', E5250Key.ERASE_INPUT, { altKey: true }],
        ['Insert', 'Insert', E5250Key.INSERT],
        ['Delete', 'Delete', E5250Key.DELETE],
        ['Backspace', 'Backspace', E5250Key.BACKSPACE],
        ['ArrowUp', 'ArrowUp', E5250Key.UP],
        ['ArrowDown', 'ArrowDown', E5250Key.DOWN],
        ['ArrowLeft', 'ArrowLeft', E5250Key.LEFT],
        ['ArrowRight', 'ArrowRight', E5250Key.RIGHT]
    ]
    for (const [code, key, expected, mods] of cases) assert.deepEqual(m.down(ev(code, key, mods)), { key: expected }, `${code}`)
})

test('printable characters are typed; the rest is left to the browser', () => {
    const m = new KeyMapper5250()
    assert.deepEqual(m.down(ev('KeyA', 'a')), { key: E5250Key.CHAR, char: 'a' })
    assert.deepEqual(m.down(ev('Digit4', '4')), { key: E5250Key.CHAR, char: '4' })
    assert.equal(m.down(ev('Escape', 'Escape')), undefined)
    assert.equal(m.down(ev('KeyA', 'a', { altKey: true })), undefined)
    assert.equal(m.down(ev('ShiftLeft', 'Shift')), undefined)
    assert.equal(m.down(ev('Unidentified', '\u007f')), undefined, 'DEL as a character is not typed')
    assert.equal(m.down(ev('Unidentified', '\u0007')), undefined, 'nor a control character')
})
