import { Screen3270, DEFAULT_ATTRIBUTE } from '../common/Screen3270'
import { Terminal3270 } from '../common/Terminal3270'
import { Painter } from '../common/Painter'
import { baseColor, displayCell, displayRow, oiaOf } from '../common/Display3270'
import {
    E3270Aid, E3270Color, E3270Highlight, E3270Intensity, E3270Key, E3270Lock, MODEL3_GEOMETRY, PF_AIDS
} from '../common/Terminal3270Types'
import { EDisplay } from '../common/DisplayTypes'
import { TerminalView } from './TerminalView'
import { KeyMapper } from './KeyMapper'
import { FONT_FAMILY, FONT_STACK, loadFont3270 } from './Font3270'
import { oiaColorOf, paletteOf, SCREEN_BACKGROUND } from './Palette'

/*
    The contract of DCE `blockterm`: the entry of the npm package AND the shape of the instance the core keeps.

    A consumer imports from '@jfvilas/kwirth-dce-blockterm' as from any package. Its build maps that package to
    the instance (DCE_PACKAGES), so at runtime every named import is read from the instance — which is why the
    instance carries EVERY runtime export of this module, under the same name: classes, functions, constants
    and the enums as objects. An export missing from IBlockterm would build and be undefined in the browser.

    In a consumer's unit tests there is no mapping: the same imports resolve to this module, bundled in
    dist/index.mjs, and run the real engine.
*/

export { Screen3270, DEFAULT_ATTRIBUTE } from '../common/Screen3270'
export { Terminal3270 } from '../common/Terminal3270'
export { Painter } from '../common/Painter'
export type { ITextStyle } from '../common/Painter'
export { baseColor, displayCell, displayRow, oiaOf } from '../common/Display3270'
export type { IDisplayCell, IDisplayRun, IOia } from '../common/Display3270'
export {
    E3270Aid, E3270Color, E3270Highlight, E3270Intensity, E3270Key, E3270Lock, MODEL3_GEOMETRY, PF_AIDS
} from '../common/Terminal3270Types'
export type {
    I3270Cell, I3270FieldAttribute, I3270Geometry, I3270Input, I3270KeyAction, I3270ModifiedField
} from '../common/Terminal3270Types'
export { EDisplay } from '../common/DisplayTypes'
export { TerminalView } from './TerminalView'
export type { ITerminalViewProps } from './TerminalView'
export { KeyMapper } from './KeyMapper'
export type { IKeyEventLike } from './KeyMapper'
export { FONT_FAMILY, FONT_STACK, loadFont3270 } from './Font3270'
export type { IFontMetrics } from './Font3270'
export { oiaColorOf, paletteOf, SCREEN_BACKGROUND } from './Palette'

export interface IBlockterm {
    /** The DCE's id, as the core installed it. */
    readonly id: string

    // 3270 engine (no DOM)
    readonly Screen3270: typeof Screen3270
    readonly DEFAULT_ATTRIBUTE: typeof DEFAULT_ATTRIBUTE
    readonly Terminal3270: typeof Terminal3270
    readonly Painter: typeof Painter
    readonly baseColor: typeof baseColor
    readonly displayCell: typeof displayCell
    readonly displayRow: typeof displayRow
    readonly oiaOf: typeof oiaOf
    readonly E3270Aid: typeof E3270Aid
    readonly E3270Color: typeof E3270Color
    readonly E3270Highlight: typeof E3270Highlight
    readonly E3270Intensity: typeof E3270Intensity
    readonly E3270Key: typeof E3270Key
    readonly E3270Lock: typeof E3270Lock
    readonly MODEL3_GEOMETRY: typeof MODEL3_GEOMETRY
    readonly PF_AIDS: typeof PF_AIDS
    readonly EDisplay: typeof EDisplay

    // The glass, in the front end
    readonly TerminalView: typeof TerminalView
    readonly KeyMapper: typeof KeyMapper
    readonly FONT_FAMILY: typeof FONT_FAMILY
    readonly FONT_STACK: typeof FONT_STACK
    readonly loadFont3270: typeof loadFont3270
    readonly oiaColorOf: typeof oiaColorOf
    readonly paletteOf: typeof paletteOf
    readonly SCREEN_BACKGROUND: typeof SCREEN_BACKGROUND
}

export const createBlockterm = (id: string): IBlockterm => ({
    id,
    Screen3270,
    DEFAULT_ATTRIBUTE,
    Terminal3270,
    Painter,
    baseColor,
    displayCell,
    displayRow,
    oiaOf,
    E3270Aid,
    E3270Color,
    E3270Highlight,
    E3270Intensity,
    E3270Key,
    E3270Lock,
    MODEL3_GEOMETRY,
    PF_AIDS,
    EDisplay,
    TerminalView,
    KeyMapper,
    FONT_FAMILY,
    FONT_STACK,
    loadFont3270,
    oiaColorOf,
    paletteOf,
    SCREEN_BACKGROUND
})
