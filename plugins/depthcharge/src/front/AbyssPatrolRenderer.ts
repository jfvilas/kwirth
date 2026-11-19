import { AbyssPatrolGame, EGameStatus, ESide, SEABED_Y, SURFACE_Y, TUNING, WORLD_H, WORLD_W } from './core/AbyssPatrolGame'
import { drawText, ETextAlign, SONAR_PIXEL, SONAR_PIXEL_MINI } from './AbyssPatrolFont'
import { drawSprite, ESprite } from './AbyssPatrolSprites'

/*
    Low resolution on purpose: the whole frame is painted on a WORLD_W x WORLD_H buffer at one pixel per
    world unit, positions snapped to whole pixels, and that buffer is blown up onto the visible canvas
    with smoothing off. Nothing is antialiased, not even turning objects: they step through hand-drawn
    frames instead of being rotated.

    Ship and submarines are external SVG sprites (src/front/sprites, see AbyssPatrolSprites.ts); charges,
    mines and blasts are small pixel patterns drawn here.
*/
/** Pixels the sub's points sit below the vertical centre of its box, and to the right of its horizontal centre. */
const SUB_LABEL_DROP = 3
const SUB_LABEL_SHIFT = 2

const COLORS = {
    sky: '#4a86c8',
    hud: '#000000',
    water: '#020a14',
    seabed: '#4a86c8',
    subText: '#02221f',
    charge: '#f6e05e',
    mine: '#fc8181',
    blast: '#fbd38d',
    popup: '#fefcbf',
    banner: '#ffffff',
}

type TPattern = string[]

/** Mine frames, alternated every TUNING.mineFrameTime. */
const MINE_FRAMES: TPattern[] = [
    ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    ['..#..', '.#.#.', '#.#.#', '.#.#.', '..#..'],
]

/** Charge frames: the same small block at 0, 45, 90 and 135 degrees. */
const CHARGE_FRAMES: TPattern[] = [
    ['.....', '.###.', '#####', '.###.', '.....'],
    ['...#.', '..###', '.###.', '###..', '.#...'],
    ['..#..', '.###.', '.###.', '.###.', '..#..'],
    ['.#...', '###..', '.###.', '..###', '...#.'],
]

export interface IDrawOptions {
    ctx: CanvasRenderingContext2D
    game: AbyssPatrolGame
    width: number
    height: number
    paused: boolean
    now: number
}

let buffer: HTMLCanvasElement | undefined

const getBuffer = (): CanvasRenderingContext2D | null => {
    if (!buffer) {
        buffer = document.createElement('canvas')
        buffer.width = WORLD_W
        buffer.height = WORLD_H
    }
    return buffer.getContext('2d')
}

const px = (v: number): number => Math.round(v)

const pattern = (ctx: CanvasRenderingContext2D, rows: TPattern, x: number, y: number, color: string): void => {
    ctx.fillStyle = color
    rows.forEach((row, ry) => {
        for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') ctx.fillRect(px(x) + rx, px(y) + ry, 1, 1)
    })
}

const paintWorld = (ctx: CanvasRenderingContext2D, game: AbyssPatrolGame, paused: boolean, now: number): void => {
    ctx.fillStyle = COLORS.sky
    ctx.fillRect(0, 0, WORLD_W, SURFACE_Y)
    ctx.fillStyle = COLORS.water
    ctx.fillRect(0, SURFACE_Y, WORLD_W, SEABED_Y - SURFACE_Y)
    ctx.fillStyle = COLORS.seabed
    ctx.fillRect(0, SEABED_Y, WORLD_W, WORLD_H - SEABED_Y)

    // Status line on the top band: time left, one dash per charge available, score.
    const hudY = 3
    drawText(ctx, `${String(Math.ceil(game.time)).padStart(2, ' ')} TIME`, 4, hudY, COLORS.hud)
    drawText(ctx, '-'.repeat(game.chargesLeft), 128, hudY, COLORS.hud, ETextAlign.Center)
    drawText(ctx, 'SCORE', 170, hudY, COLORS.hud)
    drawText(ctx, String(game.score), WORLD_W - 4, hudY, COLORS.hud, ETextAlign.Right)

    // Sunk counter along the bottom band.
    ctx.fillStyle = COLORS.water
    for (let i = 0; i < Math.min(game.sunk, 40); i++) ctx.fillRect(2 + i * 6, SEABED_Y + 3, 4, 3)

    const ship = game.ship
    // While hit, the ship blinks.
    const blinking = ship.hitTime > 0 && Math.floor(now / 100) % 2 === 0
    if (!blinking) drawSprite(ctx, ESprite.Ship, ship.x, ship.y, 35, 9)

    for (const s of game.subs) {
        drawSprite(ctx, ESprite.Submarine, s.x, s.y, 30, 12, s.dir === ESide.Left)
        drawText(ctx, String(s.points), s.x + s.w / 2 + SUB_LABEL_SHIFT, s.y + (s.h - SONAR_PIXEL_MINI.height) / 2 + SUB_LABEL_DROP, COLORS.subText, ETextAlign.Center, 1, SONAR_PIXEL_MINI)
    }

    for (const m of game.mines) {
        const frame = MINE_FRAMES[Math.floor(m.age / TUNING.mineFrameTime) % MINE_FRAMES.length]
        pattern(ctx, frame, m.x, m.y, COLORS.mine)
    }

    // The 5x5 frame is centred on the charge's box.
    for (const c of game.charges) {
        const step = Math.round((c.angle % Math.PI) / (Math.PI / CHARGE_FRAMES.length)) % CHARGE_FRAMES.length
        pattern(ctx, CHARGE_FRAMES[step], c.x + c.w / 2 - 2.5, c.y + c.h / 2 - 2.5, COLORS.charge)
    }

    // Blasts: a square ring growing and fading, one pixel thick.
    ctx.fillStyle = COLORS.blast
    for (const b of game.blasts) {
        const r = Math.max(1, px(b.size * (0.3 + 0.7 * b.age / b.life)))
        const x = px(b.x), y = px(b.y)
        ctx.globalAlpha = 1 - b.age / b.life
        ctx.fillRect(x - r, y - r, r * 2, 1)
        ctx.fillRect(x - r, y + r - 1, r * 2, 1)
        ctx.fillRect(x - r, y - r, 1, r * 2)
        ctx.fillRect(x + r - 1, y - r, 1, r * 2)
    }
    ctx.globalAlpha = 1

    for (const p of game.popups) {
        ctx.globalAlpha = 1 - p.age / p.life
        drawText(ctx, p.text, p.x, p.y - SONAR_PIXEL.height / 2, COLORS.popup, ETextAlign.Center)
    }
    ctx.globalAlpha = 1

    const middle = (SURFACE_Y + SEABED_Y) / 2
    switch (game.status) {
        case EGameStatus.Ready:
            drawText(ctx, 'DEPTH CHARGE', WORLD_W / 2, middle - 30, COLORS.banner, ETextAlign.Center, 2)
            drawText(ctx, 'CLICK HERE AND PRESS ENTER', WORLD_W / 2, middle, COLORS.banner, ETextAlign.Center)
            drawText(ctx, 'ARROWS MOVE', WORLD_W / 2, middle + 16, COLORS.banner, ETextAlign.Center)
            drawText(ctx, 'Z DROP LEFT   X DROP RIGHT', WORLD_W / 2, middle + 26, COLORS.banner, ETextAlign.Center)
            break
        case EGameStatus.Over:
            drawText(ctx, 'TIME UP', WORLD_W / 2, middle - 20, COLORS.banner, ETextAlign.Center, 2)
            drawText(ctx, `SCORE ${game.score}`, WORLD_W / 2, middle + 2, COLORS.banner, ETextAlign.Center)
            drawText(ctx, 'PRESS ENTER TO PLAY AGAIN', WORLD_W / 2, middle + 14, COLORS.banner, ETextAlign.Center)
            break
        case EGameStatus.Running:
            if (paused) drawText(ctx, 'PAUSED', WORLD_W / 2, middle - SONAR_PIXEL.height, COLORS.banner, ETextAlign.Center, 2)
            break
    }
}

export const draw = ({ ctx, game, width, height, paused, now }: IDrawOptions): void => {
    const low = getBuffer()
    if (!low || !buffer) return
    paintWorld(low, game, paused, now)

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    const scale = Math.min(width / WORLD_W, height / WORLD_H)
    const w = Math.floor(WORLD_W * scale), h = Math.floor(WORLD_H * scale)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(buffer, Math.floor((width - w) / 2), Math.floor((height - h) / 2), w, h)
}

export const WORLD_ASPECT = WORLD_W / WORLD_H
