import tahoma from '../fonts/tahoma.ttf'
import tahomaBold from '../fonts/tahomabd.ttf'

/*
    Wine's Tahoma (LGPL-2.1, derived from Bitstream Vera; LICENSE-wine-tahoma.txt next to it): metric-compatible
    with the one XP drew its dialogs in, so columns measure what they measured there. Never Microsoft's own (PRD D2).
    Embedded as data URLs and registered once per page with the FontFace API: no stylesheet, no theme involved.
*/
export const LUNA_FONT = 'KwirthTahoma'
export const LUNA_FONT_STACK = `${LUNA_FONT}, Tahoma, Verdana, sans-serif`

/*
    The vertical metrics Windows lays Tahoma out with: its win ascent and descent (2049 and 423 of 2048 units), no
    line gap. Wine's file sets USE_TYPO_METRICS, and with it Chrome on Linux takes the typo ascent (1566, 0.765 em):
    with capitals 0.727 em tall that left no room above them, and every text sat at the top of its box — buttons,
    rows, tabs. Overriding them puts the text where XP had it.
*/
const WINDOWS_METRICS = { ascentOverride: '100%', descentOverride: '20.65%', lineGapOverride: '0%' }

let loading: Promise<void> | undefined

export const loadLunaFont = (): Promise<void> => {
    if (!loading) {
        loading = (async () => {
            try {
                const regular = new FontFace(LUNA_FONT, `url(${tahoma}) format('truetype')`, { weight: '400', ...WINDOWS_METRICS })
                const bold = new FontFace(LUNA_FONT, `url(${tahomaBold}) format('truetype')`, { weight: '700', ...WINDOWS_METRICS })
                await Promise.all([regular.load(), bold.load()])
                document.fonts.add(regular)
                document.fonts.add(bold)
            }
            catch (err) {
                // Without it the window still works in the fallbacks; not worth failing for.
                console.error('[tasklist] cannot load the Tahoma font', err)
            }
        })()
    }
    return loading
}
