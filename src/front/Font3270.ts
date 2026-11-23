import font3270 from './fonts/3270-Regular.woff'

/*
    The 3270 font (rbanffy/3270font, BSD-3-Clause, LICENSE-3270font.txt next to it), embedded in the bundle as a
    data URL and registered once per page with the FontFace API: no stylesheet, no dependency on the theme,
    and every terminal of every consumer shares the same face.
*/
export const FONT_FAMILY = 'Kwirth3270'
// What the screen is painted with: the 3270 face, or the browser's monospace if it could not be loaded.
export const FONT_STACK = `${FONT_FAMILY}, monospace`

export interface IFontMetrics {
    width: number      // advance of one character, per unit of font size
    height: number     // line height, per unit of font size
}

let loading: Promise<IFontMetrics> | undefined

const measure = (): IFontMetrics => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return { width: 0.5, height: 1.2 }
    ctx.font = `100px ${FONT_STACK}`
    const m = ctx.measureText('M'.repeat(10))
    const height = (m.fontBoundingBoxAscent ?? 0) + (m.fontBoundingBoxDescent ?? 0)
    return { width: m.width / 1000, height: height > 0 ? height / 100 : 1.2 }
}

export const loadFont3270 = (): Promise<IFontMetrics> => {
    if (!loading) {
        loading = (async () => {
            try {
                const face = new FontFace(FONT_FAMILY, `url(${font3270}) format('woff')`)
                await face.load()
                document.fonts.add(face)
            }
            catch (err) {
                // Without it the screen still works in the browser's monospace; it is not worth failing for.
                console.error('[blockterm] cannot load the 3270 font', err)
            }
            return measure()
        })()
    }
    return loading
}
