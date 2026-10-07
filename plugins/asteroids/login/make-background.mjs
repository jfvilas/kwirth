/**
 * Generates background.png: a vector asteroid field, in the same style as the game.
 *
 * Why generate it by code instead of drawing it by hand:
 *
 * 1. The background has a HARD CAP of 600 KB (it travels in base64 inside a ConfigMap). Going over
 *    it does not break the installation: the login is installed HALF-WAY, without a background, and
 *    you do not find out until you open the page.
 *    White-on-black grayscale line art compresses to a few tens of KB, so the problem disappears at
 *    the root instead of being managed by recompressing.
 * 2. It is reproducible: the composition can be changed and regenerated, without depending on an
 *    editor.
 *
 * The PNG is written by hand (8-bit grayscale, no filters) to avoid pulling in dependencies: all it
 * needs is zlib, which already ships with node.
 */
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const WIDTH = 1408
const HEIGHT = 768

/*
    Zone that is NOT drawn: it is where the renderer places the login panel, on top of the
    background. An asteroid right behind the fields would make them unreadable. The margins are
    generous because the panel has its own padding and grows with its content.
*/
const CLEAR = { x0: 520, y0: 120, x1: 900, y1: 640 }

/*
    And the title band: without reserving it, an asteroid crosses over the letters and makes them
    unreadable. It is excluded BEFORE drawing anything, not by moving rocks around by hand.
*/
const TITLE_BAND = { x0: 380, y0: 20, x1: 1030, y1: 130 }

const inBox = (box, x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1
let titleBandOpen = false   // opened only to paint the title itself
const inClearZone = (x, y) =>
    inBox(CLEAR, x, y) || (!titleBandOpen && inBox(TITLE_BAND, x, y))

// ── Canvas ────────────────────────────────────────────────────────────────

const pixels = new Uint8Array(WIDTH * HEIGHT)   // 0 = black

const plot = (x, y, value) => {
    const px = Math.round(x)
    const py = Math.round(y)
    if (px < 0 || py < 0 || px >= WIDTH || py >= HEIGHT) return
    if (inClearZone(px, py)) return
    const i = py * WIDTH + px
    if (pixels[i] < value) pixels[i] = value
}

/** Bresenham. The game draws with a thin stroke, so a one-pixel line is exactly the style. */
const line = (x0, y0, x1, y1, value) => {
    let x = Math.round(x0)
    let y = Math.round(y0)
    const ex = Math.round(x1)
    const ey = Math.round(y1)
    const dx = Math.abs(ex - x)
    const dy = -Math.abs(ey - y)
    const sx = x < ex ? 1 : -1
    const sy = y < ey ? 1 : -1
    let err = dx + dy
    for (;;) {
        plot(x, y, value)
        if (x === ex && y === ey) break
        const e2 = 2 * err
        if (e2 >= dy) { err += dy; x += sx }
        if (e2 <= dx) { err += dx; y += sy }
    }
}

const polyline = (points, value, close = false) => {
    for (let i = 0; i < points.length - 1; i++) {
        line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], value)
    }
    if (close && points.length > 1) {
        const a = points[points.length - 1]
        const b = points[0]
        line(a[0], a[1], b[0], b[1], value)
    }
}

// ── Seeded randomness: the background must come out THE SAME on every regeneration ──

let seed = 20260912
const random = () => {
    // mulberry32
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (a, b) => a + random() * (b - a)

// ── Pieces ────────────────────────────────────────────────────────────────

/** Asteroid: a closed irregular polygon, like the game's. */
const asteroid = (cx, cy, radius, value) => {
    const vertices = Math.round(between(9, 13))
    const points = []
    for (let i = 0; i < vertices; i++) {
        const angle = (i / vertices) * Math.PI * 2
        const r = radius * between(0.62, 1.15)
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r])
    }
    polyline(points, value, true)
}

/** The ship, with its thrust flame. */
const ship = (cx, cy, size, angle, value) => {
    const rotate = ([x, y]) => [
        cx + (x * Math.cos(angle) - y * Math.sin(angle)) * size,
        cy + (x * Math.sin(angle) + y * Math.cos(angle)) * size,
    ]
    polyline([[0, -1], [0.62, 0.9], [0, 0.5], [-0.62, 0.9]].map(rotate), value, true)
    polyline([[-0.3, 0.72], [0, 1.5], [0.3, 0.72]].map(rotate), Math.round(value * 0.75))
}

/** UFO: the two saucer halves and the cockpit. */
const ufo = (cx, cy, size, value) => {
    const s = (x, y) => [cx + x * size, cy + y * size]
    polyline([s(-1, 0), s(-0.45, -0.42), s(0.45, -0.42), s(1, 0), s(0.45, 0.42), s(-0.45, 0.42)], value, true)
    polyline([s(-1, 0), s(1, 0)], value)
    polyline([s(-0.45, -0.42), s(-0.25, -0.8), s(0.25, -0.8), s(0.45, -0.42)], value)
}

/*
    Minimal vector typeface, only the letters of ASTEROIDS. It is drawn with strokes, like the
    arcade: there is no font to load and it matches the rest of the drawing. Coordinates in a 0..1
    box, with Y pointing down.
*/
const GLYPHS = {
    A: [[[0, 1], [0.5, 0], [1, 1]], [[0.18, 0.62], [0.82, 0.62]]],
    S: [[[1, 0.14], [0.8, 0], [0.2, 0], [0, 0.16], [0, 0.4], [0.2, 0.5], [0.8, 0.5], [1, 0.62], [1, 0.86], [0.8, 1], [0.2, 1], [0, 0.86]]],
    T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
    E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.72, 0.5]]],
    R: [[[0, 1], [0, 0], [0.78, 0], [1, 0.18], [1, 0.4], [0.78, 0.56], [0, 0.56]], [[0.5, 0.56], [1, 1]]],
    O: [[[0.22, 0], [0.78, 0], [1, 0.2], [1, 0.8], [0.78, 1], [0.22, 1], [0, 0.8], [0, 0.2], [0.22, 0]]],
    I: [[[0.5, 0], [0.5, 1]], [[0.2, 0], [0.8, 0]], [[0.2, 1], [0.8, 1]]],
    D: [[[0, 0], [0.7, 0], [1, 0.3], [1, 0.7], [0.7, 1], [0, 1], [0, 0]]],
}

const text = (word, x, y, glyphHeight, spacing, value) => {
    const glyphWidth = glyphHeight * 0.66
    let cursor = x
    for (const ch of word) {
        const strokes = GLYPHS[ch]
        if (strokes) {
            for (const stroke of strokes) {
                polyline(stroke.map(([gx, gy]) => [cursor + gx * glyphWidth, y + gy * glyphHeight]), value)
            }
        }
        cursor += glyphWidth + spacing
    }
    return cursor - spacing
}

// ── Composition ───────────────────────────────────────────────────────────

// Stars: loose, faint dots, so that the black does not look dead.
for (let i = 0; i < 260; i++) {
    plot(between(0, WIDTH), between(0, HEIGHT), Math.round(between(45, 110)))
}

// Big asteroids in the corners and on the sides, away from the panel.
const bigRocks = [
    [170, 150, 92], [300, 560, 74], [120, 400, 52],
    [1180, 180, 104], [1280, 520, 78], [1050, 660, 58],
    [640, 60, 46], [760, 710, 50],
]
for (const [x, y, r] of bigRocks) asteroid(x, y, r, 235)

// Small asteroids scattered around, skipping those that fall on the panel.
for (let i = 0; i < 26; i++) {
    const x = between(40, WIDTH - 40)
    const y = between(40, HEIGHT - 40)
    if (x > CLEAR.x0 - 60 && x < CLEAR.x1 + 60 && y > CLEAR.y0 - 60 && y < CLEAR.y1 + 60) continue
    asteroid(x, y, between(14, 30), Math.round(between(150, 215)))
}

// The ship, at the lower left, climbing towards the title.
ship(400, 300, 26, 0.42, 255)

// Shots ahead of the ship.
for (let i = 0; i < 5; i++) {
    const t = i * 34
    line(432 + t, 262 - t * 0.5, 438 + t, 256 - t * 0.5, 210)
}

ufo(1120, 380, 44, 225)

// The title, at the top and centred over the panel's gap.
titleBandOpen = true
const TITLE_HEIGHT = 62
const TITLE_SPACING = 18
const titleWidth = 'ASTEROIDS'.length * (TITLE_HEIGHT * 0.66 + TITLE_SPACING) - TITLE_SPACING
text('ASTEROIDS', (WIDTH - titleWidth) / 2, 44, TITLE_HEIGHT, TITLE_SPACING, 255)
titleBandOpen = false

// ── PNG writing ───────────────────────────────────────────────────────────

const crcTable = (() => {
    const table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
        table[n] = c
    }
    return table
})()

const crc32 = (buf) => {
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    return (c ^ 0xFFFFFFFF) >>> 0
}

const chunk = (type, data) => {
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([length, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(WIDTH, 0)
ihdr.writeUInt32BE(HEIGHT, 4)
ihdr[8] = 8     // bits per sample
ihdr[9] = 0     // color type 0 = grayscale
ihdr[10] = 0    // deflate
ihdr[11] = 0    // adaptive filtering
ihdr[12] = 0    // no interlacing

// Each scanline is preceded by its filter byte; with 0 (none) deflate already does the job,
// because the image is almost entirely black.
const raw = Buffer.alloc((WIDTH + 1) * HEIGHT)
for (let y = 0; y < HEIGHT; y++) {
    raw[y * (WIDTH + 1)] = 0
    Buffer.from(pixels.buffer, y * WIDTH, WIDTH).copy(raw, y * (WIDTH + 1) + 1)
}

const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
])

const out = join(__dir, 'background.png')
writeFileSync(out, png)
console.log(`background.png ${WIDTH}x${HEIGHT} — ${(png.length / 1024).toFixed(0)} KB (cap 600 KB)`)
