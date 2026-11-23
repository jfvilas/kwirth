import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Terminal5250 } from '../src/common/Terminal5250'
import { Painter5250 } from '../src/common/Painter5250'
import { attributeLook, displayCell5250, displayRow5250, oiaOf5250 } from '../src/common/Display5250'
import { E3270Color } from '../src/common/Terminal3270Types'
import { E5250Attribute, E5250Error, E5250Key, E5250Lock } from '../src/common/Terminal5250Types'
import { Screen3270 } from '../src/common/Screen3270'
import { Painter } from '../src/common/Painter'
import { glassRow3270 } from '../src/common/Display3270'
import { E3270Highlight } from '../src/common/Terminal3270Types'

test('colour display: the attribute table of the 5292 / 3477', () => {
    assert.deepEqual(attributeLook(0x20), { color: E3270Color.GREEN, reverse: false, underscore: false, blink: false, separator: false, hidden: false })
    assert.equal(attributeLook(0x22).color, E3270Color.WHITE)
    assert.ok(attributeLook(0x24).underscore)
    assert.ok(attributeLook(0x25).reverse && attributeLook(0x25).underscore)
    assert.equal(attributeLook(0x28).color, E3270Color.RED)
    assert.ok(attributeLook(0x2A).blink)
    assert.ok(attributeLook(0x30).separator)
    assert.equal(attributeLook(0x30).color, E3270Color.TURQUOISE)
    assert.equal(attributeLook(0x32).color, E3270Color.YELLOW)
    assert.ok(!attributeLook(0x34).separator && attributeLook(0x34).underscore)
    assert.equal(attributeLook(0x38).color, E3270Color.PINK)
    assert.equal(attributeLook(0x3A).color, E3270Color.BLUE)
    assert.ok(attributeLook(0x3B).reverse)
    for (const nd of [0x27, 0x2F, 0x37, 0x3F]) assert.ok(attributeLook(nd).hidden, `0x${nd.toString(16)} is non-display`)
    for (let a = 0x20; a <= 0x3F; a++) assert.notEqual(attributeLook(a).color, E3270Color.DEFAULT)
})

test('monochrome display: the colour screen in two intensities; white, red and yellow are the bright one', () => {
    assert.equal(attributeLook(0x20, true).color, E3270Color.GREEN)
    assert.equal(attributeLook(0x22, true).color, E3270Color.WHITE)
    assert.equal(attributeLook(0x28, true).color, E3270Color.WHITE, 'red stands out')
    assert.equal(attributeLook(0x32, true).color, E3270Color.WHITE, 'yellow stands out')
    assert.equal(attributeLook(0x3A, true).color, E3270Color.GREEN, 'blue is normal')
    assert.equal(attributeLook(0x30, true).color, E3270Color.GREEN, 'turquoise is normal')
    assert.equal(attributeLook(0x38, true).color, E3270Color.GREEN, 'pink is normal')
    // the blue help text of IBM i is NOT column separators nor blink on a 5251
    const blue = attributeLook(0x3A, true)
    assert.ok(!blue.separator && !blue.blink)
    assert.ok(attributeLook(0x21, true).reverse)
    assert.ok(attributeLook(0x24, true).underscore)
    assert.ok(attributeLook(0x2A, true).blink, 'blink stays')
    assert.ok(attributeLook(0x30, true).separator, 'separators the attribute has stay')
    const nd = attributeLook(0x27, true)
    assert.ok(nd.hidden && !nd.reverse && !nd.underscore)
})

test('a position takes the look of the nearest attribute before it; the attribute itself is a blank', () => {
    const terminal = new Terminal5250()
    const screen = terminal.screen
    const p = new Painter5250(screen)
    p.text(0, 1, 'HEAD', E5250Attribute.WHITE)
    p.text(0, 10, 'PWD', E5250Attribute.NONDISPLAY, true)
    assert.equal(displayCell5250(screen, screen.address(0, 0)).text, ' ')
    assert.equal(displayCell5250(screen, screen.address(0, 1)).color, E3270Color.WHITE)
    assert.equal(displayCell5250(screen, screen.address(0, 5)).color, E3270Color.WHITE, 'until the next attribute')
    assert.equal(displayCell5250(screen, screen.address(0, 10)).text, ' ', 'non-display')
    assert.equal(displayCell5250(screen, screen.address(0, 20)).color, E3270Color.GREEN, 'closed with normal green')
    // an empty screen is normal green
    assert.equal(displayCell5250(new Terminal5250().screen, 100).color, E3270Color.GREEN)
})

test('a row is runs of equal look, the cursor on its own; the look carries over from the previous row', () => {
    const terminal = new Terminal5250()
    const screen = terminal.screen
    const p = new Painter5250(screen)
    p.text(0, 70, 'XYZ', E5250Attribute.YELLOW_SEPARATOR)
    const opt = p.input(1, 2, 2, '4')
    screen.cursor = opt
    const row0 = displayRow5250(screen, 0, true)
    assert.equal(row0.map(r => r.text).join('').length, 80)
    const sep = row0.find(r => r.text.startsWith('XYZ'))!
    assert.ok(sep.separator)
    assert.equal(sep.color, E3270Color.YELLOW)
    const row1 = displayRow5250(screen, 1, true)
    assert.equal(row1[0].color, E3270Color.YELLOW, 'row 1 starts with what row 0 left')
    const cursor = row1.filter(r => r.cursor)
    assert.equal(cursor.length, 1)
    assert.equal(cursor[0].text, '4')
    assert.ok(cursor[0].underscore)
    assert.equal(displayRow5250(screen, 1, false).filter(r => r.cursor).length, 0)
    // monochrome: only the two greens
    const mono = displayRow5250(screen, 0, false, true)
    assert.ok(mono.every(r => r.color === E3270Color.GREEN || r.color === E3270Color.WHITE))
})

test('the OIA of a 5250: MA, the lock and the operator error code, insert, cursor position', () => {
    const terminal = new Terminal5250()
    const screen = terminal.screen
    new Painter5250(screen).input(1, 2, 2)
    assert.deepEqual(oiaOf5250(terminal), { ready: 'MA', lock: '', insert: false, position: '01/001' })
    screen.cursor = screen.address(5, 9)
    terminal.apply({ key: E5250Key.CHAR, char: 'X' })
    assert.equal(terminal.error, E5250Error.PROTECTED)
    assert.equal(oiaOf5250(terminal).lock, 'X II 0005')
    assert.equal(oiaOf5250(terminal).position, '06/010')
    terminal.apply({ key: E5250Key.RESET })
    terminal.apply({ key: E5250Key.INSERT })
    assert.ok(oiaOf5250(terminal).insert)
    terminal.aid(0xF1)
    assert.equal(terminal.lock, E5250Lock.SYSTEM)
    assert.equal(oiaOf5250(terminal).lock, 'X SYSTEM')
    terminal.hostError('Bad')
    assert.equal(oiaOf5250(terminal).lock, 'X II')
})

test('the 3270 on the glass: its single highlight becomes the glass flags, no separators', () => {
    const screen = new Screen3270()
    const p = new Painter(screen)
    p.text(0, 1, 'REV', { highlight: E3270Highlight.REVERSE })
    p.text(0, 10, 'UND', { highlight: E3270Highlight.UNDERSCORE })
    p.text(0, 20, 'BLI', { highlight: E3270Highlight.BLINK })
    const runs = glassRow3270(screen, 0, false)
    const find = (t: string) => runs.find(r => r.text.includes(t))!
    assert.ok(find('REV').reverse && !find('REV').underscore)
    assert.ok(find('UND').underscore && !find('UND').reverse)
    assert.ok(find('BLI').blink)
    assert.ok(runs.every(r => !r.separator))
    assert.equal(runs.map(r => r.text).join('').length, 80)
})
