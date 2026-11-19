import SONAR_PIXEL_GLYPHS from '../../resources/font/glifos.json'
import SONAR_PIXEL_MINI_GLYPHS from '../../resources/font-mini/glifos.json'

/*
    Bitmap fonts painted straight from their glyph data (glifos.json under resources/), one pixel per dot on
    the low-resolution buffer. Using the .ttf through ctx.fillText would antialias them.

    A glyph is a list of rows, '#' a lit pixel. Keys of the json that are not glyphs (notes such as
    '_rejilla') are ignored. Characters a font lacks are drawn as a blank.
*/
export interface IPixelFont {
    glyphs: Record<string, string[]>
    width: number
    height: number
    /** Horizontal step from one character to the next: glyph width plus spacing. */
    advance: number
}

const glyphsOf = (source: Record<string, string[] | string>): Record<string, string[]> => {
    const glyphs: Record<string, string[]> = {}
    for (const [char, rows] of Object.entries(source)) if (Array.isArray(rows)) glyphs[char] = rows
    return glyphs
}

/** Sonar Pixel: A-Z and 0-9 in 6x6. '-' and '+' are added in the same style because the game needs them. */
export const SONAR_PIXEL: IPixelFont = {
    glyphs: {
        ...glyphsOf(SONAR_PIXEL_GLYPHS),
        '-': ['......', '......', '#####.', '......', '......', '......'],
        '+': ['......', '..#...', '#####.', '..#...', '......', '......'],
    },
    width: 6,
    height: 6,
    advance: 7,
}

/** Sonar Pixel Mini: digits only, 3x5, advance 4. */
export const SONAR_PIXEL_MINI: IPixelFont = {
    glyphs: glyphsOf(SONAR_PIXEL_MINI_GLYPHS),
    width: 3,
    height: 5,
    advance: 4,
}

export enum ETextAlign {
    Left = 'left',
    Center = 'center',
    Right = 'right',
}

export const textWidth = (value: string, font: IPixelFont = SONAR_PIXEL, scale = 1): number =>
    value.length === 0 ? 0 : ((value.length - 1) * font.advance + font.width) * scale

/** `y` is the TOP of the text; positions are snapped to whole pixels. */
export const drawText = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, align = ETextAlign.Left, scale = 1, font: IPixelFont = SONAR_PIXEL): void => {
    const text = value.toUpperCase()
    const width = textWidth(text, font, scale)
    let left = align === ETextAlign.Center ? x - width / 2 : align === ETextAlign.Right ? x - width : x
    left = Math.round(left)
    const top = Math.round(y)
    ctx.fillStyle = color
    for (let i = 0; i < text.length; i++) {
        const glyph = font.glyphs[text[i]]
        if (!glyph) continue
        const gx = left + i * font.advance * scale
        glyph.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
                if (row[rx] === '#') ctx.fillRect(gx + rx * scale, top + ry * scale, scale, scale)
            }
        })
    }
}
