import { test } from 'node:test'
import assert from 'node:assert/strict'
import { IKeyEventLike, KeyMapper } from '../src/front/terminal/KeyMapper'
import { E3270Aid, E3270Key } from '../src/common/terminal/Terminal3270Types'

const ev = (code: string, key: string, mods: Partial<IKeyEventLike> = {}): IKeyEventLike =>
    ({ code, key, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...mods })

test('Right Ctrl alone is ENTER and Left Ctrl alone is RESET, on release', () => {
    const m = new KeyMapper()
    assert.equal(m.down(ev('ControlRight', 'Control', { ctrlKey: true })), undefined)
    assert.deepEqual(m.up(ev('ControlRight', 'Control')), { key: E3270Key.AID, aid: E3270Aid.ENTER })
    m.down(ev('ControlLeft', 'Control', { ctrlKey: true }))
    assert.deepEqual(m.up(ev('ControlLeft', 'Control')), { key: E3270Key.RESET })
})

test('a Ctrl held with another key is an ordinary Ctrl: Ctrl+C and Ctrl+Shift+Enter pass through', () => {
    const m = new KeyMapper()
    m.down(ev('ControlRight', 'Control', { ctrlKey: true }))
    assert.equal(m.down(ev('KeyC', 'c', { ctrlKey: true })), undefined)
    assert.equal(m.up(ev('ControlRight', 'Control')), undefined)
    m.down(ev('ControlLeft', 'Control', { ctrlKey: true }))
    assert.equal(m.down(ev('Enter', 'Enter', { ctrlKey: true, shiftKey: true })), undefined)
    assert.equal(m.up(ev('ControlLeft', 'Control')), undefined)
})

test('losing focus with a Ctrl held does not fire it', () => {
    const m = new KeyMapper()
    m.down(ev('ControlRight', 'Control', { ctrlKey: true }))
    m.cancel()
    assert.equal(m.up(ev('ControlRight', 'Control')), undefined)
})

test('Intro (both) is NEWLINE, never ENTER', () => {
    const m = new KeyMapper()
    assert.deepEqual(m.down(ev('Enter', 'Enter')), { key: E3270Key.NEWLINE })
    assert.deepEqual(m.down(ev('NumpadEnter', 'Enter')), { key: E3270Key.NEWLINE })
})

test('F1-F12 are PF1-PF12, with Shift PF13-PF24; PgUp/PgDn are PF7/PF8; Alt+1..3 the PA keys; Esc is CLEAR', () => {
    const m = new KeyMapper()
    assert.deepEqual(m.down(ev('F1', 'F1')), { key: E3270Key.AID, aid: E3270Aid.PF1 })
    assert.deepEqual(m.down(ev('F12', 'F12')), { key: E3270Key.AID, aid: E3270Aid.PF12 })
    assert.deepEqual(m.down(ev('F1', 'F1', { shiftKey: true })), { key: E3270Key.AID, aid: E3270Aid.PF13 })
    assert.deepEqual(m.down(ev('F12', 'F12', { shiftKey: true })), { key: E3270Key.AID, aid: E3270Aid.PF24 })
    assert.deepEqual(m.down(ev('PageUp', 'PageUp')), { key: E3270Key.AID, aid: E3270Aid.PF7 })
    assert.deepEqual(m.down(ev('PageDown', 'PageDown')), { key: E3270Key.AID, aid: E3270Aid.PF8 })
    assert.deepEqual(m.down(ev('Digit1', '1', { altKey: true })), { key: E3270Key.AID, aid: E3270Aid.PA1 })
    assert.deepEqual(m.down(ev('Digit3', '3', { altKey: true })), { key: E3270Key.AID, aid: E3270Aid.PA3 })
    assert.equal(m.down(ev('KeyX', 'x', { altKey: true })), undefined)
    assert.deepEqual(m.down(ev('Escape', 'Escape')), { key: E3270Key.AID, aid: E3270Aid.CLEAR })
})

test('editing and movement keys', () => {
    const m = new KeyMapper()
    const k = (code: string, key: string, mods: Partial<IKeyEventLike> = {}) => m.down(ev(code, key, mods))?.key
    assert.equal(k('Tab', 'Tab'), E3270Key.TAB)
    assert.equal(k('Tab', 'Tab', { shiftKey: true }), E3270Key.BACKTAB)
    assert.equal(k('Home', 'Home'), E3270Key.HOME)
    assert.equal(k('End', 'End'), E3270Key.ERASE_EOF)
    assert.equal(k('Insert', 'Insert'), E3270Key.INSERT)
    assert.equal(k('Delete', 'Delete'), E3270Key.DELETE)
    assert.equal(k('Backspace', 'Backspace'), E3270Key.BACKSPACE)
    assert.equal(k('ArrowUp', 'ArrowUp'), E3270Key.UP)
    assert.equal(k('ArrowDown', 'ArrowDown'), E3270Key.DOWN)
    assert.equal(k('ArrowLeft', 'ArrowLeft'), E3270Key.LEFT)
    assert.equal(k('ArrowRight', 'ArrowRight'), E3270Key.RIGHT)
})

test('printable characters are typed; everything else is left to the browser', () => {
    const m = new KeyMapper()
    assert.deepEqual(m.down(ev('KeyA', 'a')), { key: E3270Key.CHAR, char: 'a' })
    assert.deepEqual(m.down(ev('Space', ' ')), { key: E3270Key.CHAR, char: ' ' })
    assert.deepEqual(m.down(ev('Digit4', '$', { shiftKey: true })), { key: E3270Key.CHAR, char: '$' })
    assert.equal(m.down(ev('ShiftLeft', 'Shift', { shiftKey: true })), undefined)
    assert.equal(m.down(ev('CapsLock', 'CapsLock')), undefined)
    assert.equal(m.down(ev('KeyV', 'v', { metaKey: true })), undefined)
    assert.equal(m.down(ev('KeyV', 'v', { ctrlKey: true })), undefined)
})
