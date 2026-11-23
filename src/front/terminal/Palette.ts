import { E3270Color } from '../../common/terminal/Terminal3270Types'
import { ESdsfDisplay } from '../../common/SdsfTypes'

/*
    The screen colours. On a 3279 they are x3270's, with the blue lightened as every PC emulator does: a pure
    3270 blue on black cannot be read, and the reference captures show this lighter blue.

    On a monochrome 3278 the engine (Display3270, mono) already brought every cell down to its two levels,
    GREEN for normal and WHITE for intensified; here they become the two greens of the phosphor.
*/
export const SCREEN_BACKGROUND = '#000000'

const COLOR_PALETTE: Record<E3270Color, string> = {
    [E3270Color.DEFAULT]: '#00ff00',
    [E3270Color.BLUE]: '#7890f0',
    [E3270Color.RED]: '#ff0000',
    [E3270Color.PINK]: '#ff00ff',
    [E3270Color.GREEN]: '#00ff00',
    [E3270Color.TURQUOISE]: '#40e0d0',
    [E3270Color.YELLOW]: '#ffff00',
    [E3270Color.WHITE]: '#ffffff'
}

const PHOSPHOR_NORMAL = '#2fbf3f'
const PHOSPHOR_BRIGHT = '#7dff8a'

const GREEN_PALETTE: Record<E3270Color, string> = {
    [E3270Color.DEFAULT]: PHOSPHOR_NORMAL,
    [E3270Color.BLUE]: PHOSPHOR_NORMAL,
    [E3270Color.RED]: PHOSPHOR_BRIGHT,
    [E3270Color.PINK]: PHOSPHOR_NORMAL,
    [E3270Color.GREEN]: PHOSPHOR_NORMAL,
    [E3270Color.TURQUOISE]: PHOSPHOR_NORMAL,
    [E3270Color.YELLOW]: PHOSPHOR_BRIGHT,
    [E3270Color.WHITE]: PHOSPHOR_BRIGHT
}

export const paletteOf = (display: ESdsfDisplay): Record<E3270Color, string> =>
    display === ESdsfDisplay.GREEN ? GREEN_PALETTE : COLOR_PALETTE

// The OIA line and the rule above it.
export const oiaColorOf = (display: ESdsfDisplay): string =>
    display === ESdsfDisplay.GREEN ? PHOSPHOR_NORMAL : '#7890f0'
