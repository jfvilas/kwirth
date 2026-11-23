import { test } from 'node:test'
import assert from 'node:assert/strict'
import { oiaColorOf, paletteOf, SCREEN_BACKGROUND } from '../src/front/Palette'
import { EDisplay } from '../src/common/DisplayTypes'
import { E3270Color } from '../src/common/Terminal3270Types'

const ALL_COLORS = Object.values(E3270Color).filter((v): v is E3270Color => typeof v === 'number')

test('the colour display paints every 3270 colour, the blue lightened to be read on black', () => {
    const palette = paletteOf(EDisplay.COLOR)
    for (const c of ALL_COLORS) assert.match(palette[c], /^#[0-9a-f]{6}$/)
    assert.equal(palette[E3270Color.BLUE], '#7890f0')
    assert.equal(palette[E3270Color.RED], '#ff0000')
    assert.equal(oiaColorOf(EDisplay.COLOR), '#7890f0')
})

test('green phosphor has two greens only, the bright one for the emphasised colours', () => {
    const palette = paletteOf(EDisplay.GREEN)
    const used = new Set(ALL_COLORS.map(c => palette[c]))
    assert.equal(used.size, 2)
    assert.notEqual(palette[E3270Color.WHITE], palette[E3270Color.GREEN])
    assert.equal(palette[E3270Color.WHITE], palette[E3270Color.RED])
    assert.equal(palette[E3270Color.YELLOW], palette[E3270Color.WHITE])
    assert.equal(oiaColorOf(EDisplay.GREEN), palette[E3270Color.GREEN])
})

test('the screen is always black', () => {
    assert.equal(SCREEN_BACKGROUND, '#000000')
})
