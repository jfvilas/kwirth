import { E3270Color } from '../../common/terminal/Terminal3270Types'

/*
    The screen colours. They are x3270's, with the blue lightened as every PC emulator does: a pure 3270 blue
    on black cannot be read, and the reference captures show this lighter blue.
*/
export const SCREEN_BACKGROUND = '#000000'

export const PALETTE: Record<E3270Color, string> = {
    [E3270Color.DEFAULT]: '#00ff00',
    [E3270Color.BLUE]: '#7890f0',
    [E3270Color.RED]: '#ff0000',
    [E3270Color.PINK]: '#ff00ff',
    [E3270Color.GREEN]: '#00ff00',
    [E3270Color.TURQUOISE]: '#40e0d0',
    [E3270Color.YELLOW]: '#ffff00',
    [E3270Color.WHITE]: '#ffffff'
}

// The OIA line and the rule above it.
export const OIA_COLOR = '#7890f0'
