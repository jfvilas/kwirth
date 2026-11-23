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
import { glassRow3270 } from '../common/Display3270'
import { Screen5250, DEFAULT_FIELD_FORMAT } from '../common/Screen5250'
import { Terminal5250 } from '../common/Terminal5250'
import { Painter5250 } from '../common/Painter5250'
import { attributeLook, displayCell5250, displayRow5250, oiaOf5250 } from '../common/Display5250'
import {
    E5250Adjust, E5250Aid, E5250Attribute, E5250AttributeBit, E5250Error, E5250Key, E5250Lock, E5250Shift, F_AIDS,
    GEOMETRY_5250_24X80, GEOMETRY_5250_27X132
} from '../common/Terminal5250Types'
import { TerminalView5250 } from './TerminalView5250'
import { KeyMapper5250 } from './KeyMapper5250'
import { Glass } from './Glass'

/*
    The contract of DCE `blockterm`: the entry of the npm package AND the shape of the instance the core keeps.

    A consumer imports from '@jfvilas/kwirth-dce-blockterm' as from any package. Its build maps that package to
    the instance (DCE_PACKAGES), so at runtime every named import is read from the instance — which is why the
    instance carries EVERY runtime export of this module, under the same name: classes, functions, constants
    and the enums as objects. An export missing from IBlockterm would build and be undefined in the browser.

    In a consumer's unit tests there is no mapping: the same imports resolve to this module, bundled in
    dist/index.mjs, and run the real engine.

    🔴 The instance is SHARED AT RUNTIME: every consumer installed gets the version of the DCE installed, not the
    one it was built against. So a new version only ADDS — no export is removed or renamed and no signature
    changes — or a consumer already published breaks in the browser while it still builds.
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

// The glass both terminals are painted on (0.2.0)
export { glassRow3270 } from '../common/Display3270'
export type { IGlassOia, IGlassRun } from '../common/GlassTypes'
export { Glass } from './Glass'
export type { IGlassKeys, IGlassProps } from './Glass'

// 5250 (0.2.0)
export { Screen5250, DEFAULT_FIELD_FORMAT } from '../common/Screen5250'
export { Terminal5250 } from '../common/Terminal5250'
export { Painter5250 } from '../common/Painter5250'
export type { I5250FieldStyle } from '../common/Painter5250'
export { attributeLook, displayCell5250, displayRow5250, oiaOf5250 } from '../common/Display5250'
export type { I5250Look } from '../common/Display5250'
export {
    E5250Adjust, E5250Aid, E5250Attribute, E5250AttributeBit, E5250Error, E5250Key, E5250Lock, E5250Shift, F_AIDS,
    GEOMETRY_5250_24X80, GEOMETRY_5250_27X132
} from '../common/Terminal5250Types'
export type {
    I5250Cell, I5250Field, I5250FieldFormat, I5250Input, I5250KeyAction, I5250ModifiedField
} from '../common/Terminal5250Types'
export { TerminalView5250 } from './TerminalView5250'
export type { ITerminalView5250Props } from './TerminalView5250'
export { KeyMapper5250 } from './KeyMapper5250'

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

    // The glass (0.2.0)
    readonly glassRow3270: typeof glassRow3270
    readonly Glass: typeof Glass

    // 5250 engine (0.2.0, no DOM)
    readonly Screen5250: typeof Screen5250
    readonly DEFAULT_FIELD_FORMAT: typeof DEFAULT_FIELD_FORMAT
    readonly Terminal5250: typeof Terminal5250
    readonly Painter5250: typeof Painter5250
    readonly attributeLook: typeof attributeLook
    readonly displayCell5250: typeof displayCell5250
    readonly displayRow5250: typeof displayRow5250
    readonly oiaOf5250: typeof oiaOf5250
    readonly E5250Adjust: typeof E5250Adjust
    readonly E5250Aid: typeof E5250Aid
    readonly E5250Attribute: typeof E5250Attribute
    readonly E5250AttributeBit: typeof E5250AttributeBit
    readonly E5250Error: typeof E5250Error
    readonly E5250Key: typeof E5250Key
    readonly E5250Lock: typeof E5250Lock
    readonly E5250Shift: typeof E5250Shift
    readonly F_AIDS: typeof F_AIDS
    readonly GEOMETRY_5250_24X80: typeof GEOMETRY_5250_24X80
    readonly GEOMETRY_5250_27X132: typeof GEOMETRY_5250_27X132

    // 5250 glass (0.2.0)
    readonly TerminalView5250: typeof TerminalView5250
    readonly KeyMapper5250: typeof KeyMapper5250
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
    SCREEN_BACKGROUND,
    glassRow3270,
    Glass,
    Screen5250,
    DEFAULT_FIELD_FORMAT,
    Terminal5250,
    Painter5250,
    attributeLook,
    displayCell5250,
    displayRow5250,
    oiaOf5250,
    E5250Adjust,
    E5250Aid,
    E5250Attribute,
    E5250AttributeBit,
    E5250Error,
    E5250Key,
    E5250Lock,
    E5250Shift,
    F_AIDS,
    GEOMETRY_5250_24X80,
    GEOMETRY_5250_27X132,
    TerminalView5250,
    KeyMapper5250
})
