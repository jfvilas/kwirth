import tahoma from '../fonts/tahoma.ttf'
import tahomaBold from '../fonts/tahomabd.ttf'

/*
    Wine's Tahoma (LGPL-2.1, derived from Bitstream Vera; LICENSE-wine-tahoma.txt next to it): metric-compatible
    with the one XP drew its dialogs in, so columns measure what they measured there. Never Microsoft's own (PRD D2).
    Embedded as data URLs and registered once per page with the FontFace API: no stylesheet, no theme involved.
*/
export const LUNA_FONT = 'KwirthTahoma'
export const LUNA_FONT_STACK = `${LUNA_FONT}, Tahoma, Verdana, sans-serif`

let loading: Promise<void> | undefined

export const loadLunaFont = (): Promise<void> => {
    if (!loading) {
        loading = (async () => {
            try {
                const regular = new FontFace(LUNA_FONT, `url(${tahoma}) format('truetype')`, { weight: '400' })
                const bold = new FontFace(LUNA_FONT, `url(${tahomaBold}) format('truetype')`, { weight: '700' })
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
