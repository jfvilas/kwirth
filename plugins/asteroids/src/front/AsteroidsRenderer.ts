import { GameState, GameStatus, Asteroid, UFO, Ship, Polygon, ISize } from './core'

/**
 * Vector painting of the game state onto a 2D canvas.
 *
 * 2D canvas on purpose, not WebGL: reparenting or rescaling a 2D context does not
 * cause context loss, which is exactly what breaks this use case.
 *
 * The silhouettes come straight from `hitArea`, which the core already keeps
 * translated and rotated in world coordinates. It is not an approximate collision
 * box: they are the real polygons (four asteroid models with 10 to 12
 * vertices, the saucer, and the ship with its rear notch). Here we only scale
 * and stroke; no geometry is recomputed.
 */

export interface IAsteroidsPalette {
    background: string
    ship: string
    asteroid: string
    ufo: string
    projectile: string
    text: string
}

/** Monochrome, like the original vector game: all white on black. */
export const CLASSIC_PALETTE: IAsteroidsPalette = {
    background: '#000000',
    ship: '#ffffff',
    asteroid: '#ffffff',
    ufo: '#ffffff',
    projectile: '#ffffff',
    text: '#ffffff',
}

/** Coloured variant, to tell threats apart at a glance. */
export const COLOR_PALETTE: IAsteroidsPalette = {
    background: '#05070d',
    ship: '#e8f4ff',
    asteroid: '#8fa3bf',
    ufo: '#ff5d5d',
    projectile: '#ffe066',
    text: '#e8f4ff',
}

const strokePolygon = (ctx: CanvasRenderingContext2D, polygon: Polygon, scale: number): void => {
    const points = polygon.points
    if (points.length < 4) return
    ctx.beginPath()
    ctx.moveTo(points[0] * scale, points[1] * scale)
    for (let i = 2; i < points.length; i += 2) {
        ctx.lineTo(points[i] * scale, points[i + 1] * scale)
    }
    ctx.closePath()
    ctx.stroke()
}

const fillCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, scale: number): void => {
    ctx.beginPath()
    ctx.arc(x * scale, y * scale, Math.max(1, r * scale), 0, Math.PI * 2)
    ctx.fill()
}

/**
 * Thruster flame.
 *
 * The core keeps no flame geometry, only `accelerationAmount`. It is derived
 * from the already rotated silhouette itself so as not to replicate the rotation
 * convention: vertices 3 and 4 of the ship polygon are the rear notch and
 * vertex 1 is the tip, so the flame comes out of the notch in the direction
 * opposite to the tip.
 */
const strokeThrust = (ctx: CanvasRenderingContext2D, ship: Ship, scale: number, timestamp: number): void => {
    if (!ship.accelerationAmount) return
    // Flicker, like the original: the flame was not continuous.
    if (Math.floor(timestamp / 60) % 2 === 0) return
    const hitArea = ship.hitArea
    if (typeof hitArea !== 'object') return
    const p = hitArea.points
    if (p.length < 10) return

    const tipX = p[2], tipY = p[3]
    const leftX = p[6], leftY = p[7]
    const rightX = p[8], rightY = p[9]
    const midX = (leftX + rightX) / 2
    const midY = (leftY + rightY) / 2
    const flameX = midX + (midX - tipX) * 0.32
    const flameY = midY + (midY - tipY) * 0.32

    ctx.beginPath()
    ctx.moveTo(leftX * scale, leftY * scale)
    ctx.lineTo(flameX * scale, flameY * scale)
    ctx.lineTo(rightX * scale, rightY * scale)
    ctx.stroke()
}

export interface IDrawParams {
    ctx: CanvasRenderingContext2D
    state: GameState
    worldSize: ISize
    /** Canvas size in CSS pixels. */
    canvasSize: ISize
    palette: IAsteroidsPalette
    /** Large centred text (game over, paused, press to start). */
    banner?: string
    subBanner?: string
}

export const draw = ({ ctx, state, worldSize, canvasSize, palette, banner, subBanner }: IDrawParams): void => {
    const scale = Math.min(canvasSize.width / worldSize.width, canvasSize.height / worldSize.height)
    const offsetX = (canvasSize.width - worldSize.width * scale) / 2
    const offsetY = (canvasSize.height - worldSize.height * scale) / 2

    ctx.save()
    ctx.fillStyle = palette.background
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height)
    ctx.translate(offsetX, offsetY)

    // Play area frame
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(0, 0, worldSize.width * scale, worldSize.height * scale)

    ctx.lineWidth = Math.max(1, 1.6 * scale)
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (state.status !== GameStatus.Init) {
        ctx.strokeStyle = palette.asteroid
        for (const asteroid of state.asteroids as Asteroid[]) {
            if (typeof asteroid.hitArea === 'object') strokePolygon(ctx, asteroid.hitArea, scale)
        }

        ctx.strokeStyle = palette.ufo
        for (const ufo of state.ufos as UFO[]) {
            if (typeof ufo.hitArea === 'object') strokePolygon(ctx, ufo.hitArea, scale)
        }

        ctx.fillStyle = palette.projectile
        for (const projectile of state.projectiles) {
            const radius = typeof projectile.hitArea === 'number' ? projectile.hitArea : 4
            fillCircle(ctx, projectile.position.x, projectile.position.y, radius, scale)
        }

        const ship = state.ship
        if (ship) {
            // Blinking during the invulnerability after respawning.
            const blinking = ship.invulnerable && Math.floor(state.timestamp / 120) % 2 === 0
            if (!blinking) {
                ctx.strokeStyle = palette.ship
                if (typeof ship.hitArea === 'object') strokePolygon(ctx, ship.hitArea, scale)
                strokeThrust(ctx, ship, scale, state.timestamp)
            }
        }
    }

    if (banner) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(0, 0, worldSize.width * scale, worldSize.height * scale)
        ctx.fillStyle = palette.text
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const cx = (worldSize.width * scale) / 2
        const cy = (worldSize.height * scale) / 2
        ctx.font = `${Math.round(Math.max(18, 46 * scale))}px "Trebuchet MS", sans-serif`
        ctx.fillText(banner, cx, subBanner ? cy - 22 : cy)
        if (subBanner) {
            ctx.font = `${Math.round(Math.max(12, 20 * scale))}px "Trebuchet MS", sans-serif`
            ctx.fillStyle = 'rgba(255,255,255,0.75)'
            ctx.fillText(subBanner, cx, cy + 20)
        }
    }

    ctx.restore()
}
