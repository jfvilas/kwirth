// DCE `blockterm`: the instance IS the module for a consumer's browser build (DCE_PACKAGES), so anything the
// module exports at runtime and the instance lacks would build and then be undefined in the browser.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as BlockTerm from '../src/front/BlockTerm'

test('the instance carries every runtime export of the package, the very same value', () => {
    const instance = BlockTerm.createBlockterm('blockterm') as unknown as Record<string, unknown>
    const module = BlockTerm as unknown as Record<string, unknown>
    const exported = Object.keys(module).filter(name => name !== 'createBlockterm')
    assert.ok(exported.length > 20)
    for (const name of exported) {
        assert.ok(name in instance, `the instance lacks '${name}'`)
        assert.equal(instance[name], module[name], `'${name}' is not the module's own value`)
    }
})

test('the instance carries nothing the package does not export, but its id', () => {
    const instance = BlockTerm.createBlockterm('blockterm')
    const module = BlockTerm as unknown as Record<string, unknown>
    for (const name of Object.keys(instance)) {
        if (name === 'id') continue
        assert.ok(name in module, `'${name}' is on the instance but not exported`)
    }
    assert.equal(instance.id, 'blockterm')
})

test('the enums travel as objects with their data-stream codes', () => {
    const instance = BlockTerm.createBlockterm('blockterm')
    assert.equal(instance.E3270Aid.ENTER, 0x7D)
    assert.equal(instance.E3270Color.RED, 0xF2)
    assert.equal(instance.EDisplay.GREEN, 'green')
})
