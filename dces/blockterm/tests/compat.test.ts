// DCE `blockterm` is shared AT RUNTIME: SDSF 0.11.0, built against 0.1.0, gets whatever version is installed.
// So every export 0.1.0 had must still be there, with the same kind of value. This list is frozen: never edit it,
// add a new frozen list when a version that consumers build against is published.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as BlockTerm from '../src/front/BlockTerm'

const EXPORTS_0_1_0: Record<string, 'function' | 'object' | 'string'> = {
    Screen3270: 'function',
    DEFAULT_ATTRIBUTE: 'object',
    Terminal3270: 'function',
    Painter: 'function',
    baseColor: 'function',
    displayCell: 'function',
    displayRow: 'function',
    oiaOf: 'function',
    E3270Aid: 'object',
    E3270Color: 'object',
    E3270Highlight: 'object',
    E3270Intensity: 'object',
    E3270Key: 'object',
    E3270Lock: 'object',
    MODEL3_GEOMETRY: 'object',
    PF_AIDS: 'object',
    EDisplay: 'object',
    TerminalView: 'function',
    KeyMapper: 'function',
    FONT_FAMILY: 'string',
    FONT_STACK: 'string',
    loadFont3270: 'function',
    oiaColorOf: 'function',
    paletteOf: 'function',
    SCREEN_BACKGROUND: 'string'
}

test('every export of 0.1.0 is still on the instance, of the same kind', () => {
    const instance = BlockTerm.createBlockterm('blockterm') as unknown as Record<string, unknown>
    for (const [name, kind] of Object.entries(EXPORTS_0_1_0)) {
        assert.ok(name in instance, `0.1.0 exported '${name}' and the instance lacks it`)
        assert.equal(typeof instance[name], kind, `'${name}' changed kind`)
    }
})

test('the 3270 values 0.1.0 consumers rely on keep their codes', () => {
    assert.equal(BlockTerm.E3270Aid.ENTER, 0x7D)
    assert.equal(BlockTerm.E3270Aid.PF3, 0xF3)
    assert.equal(BlockTerm.E3270Color.TURQUOISE, 0xF5)
    assert.equal(BlockTerm.E3270Highlight.REVERSE, 0xF2)
    assert.equal(BlockTerm.EDisplay.COLOR, 'color')
    assert.deepEqual(BlockTerm.MODEL3_GEOMETRY, { rows: 32, cols: 80 })
})
