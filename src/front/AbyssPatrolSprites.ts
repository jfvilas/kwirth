import SHIP_SVG from './sprites/ship.svg'
import SUBMARINE_SVG from './sprites/submarine.svg'

/*
    Sprites are external SVG files (src/front/sprites), bundled as text and turned into images once. They are
    drawn at their native size on the low-resolution buffer, so one SVG unit is one game pixel: draw them on
    whole-pixel grids with shape-rendering='crispEdges' to keep them sharp.

    Every sprite faces RIGHT; the renderer mirrors it for things heading left.
*/
export enum ESprite {
    Ship = 'ship',
    Submarine = 'submarine',
}

const SOURCES: Record<ESprite, string> = {
    [ESprite.Ship]: SHIP_SVG,
    [ESprite.Submarine]: SUBMARINE_SVG,
}

const images = new Map<ESprite, HTMLImageElement>()

const load = (sprite: ESprite): HTMLImageElement => {
    let image = images.get(sprite)
    if (!image) {
        image = new Image()
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SOURCES[sprite])}`
        images.set(sprite, image)
    }
    return image
}

/**
 * Draws the sprite with its top-left corner at (x, y), scaled to w x h (its native size when omitted) and
 * mirrored when `flip`. Both branches use the same size, so a flipped sprite covers exactly the same box.
 * Nothing until the image has decoded.
 */
export const drawSprite = (ctx: CanvasRenderingContext2D, sprite: ESprite, x: number, y: number, w?: number, h?: number, flip = false): void => {
    const image = load(sprite)
    if (!image.complete || image.naturalWidth === 0) return
    const left = Math.round(x)
    const top = Math.round(y)
    const width = w ?? image.naturalWidth
    const height = h ?? image.naturalHeight
    ctx.imageSmoothingEnabled = false
    if (!flip) {
        ctx.drawImage(image, left, top, width, height)
        return
    }
    ctx.save()
    ctx.translate(left + width, top)
    ctx.scale(-1, 1)
    ctx.drawImage(image, 0, 0, width, height)
    ctx.restore()
}
