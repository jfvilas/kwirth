/**
 * Depth Charge game core.
 *
 * Pure logic, no DOM: the TabContent feeds it elapsed time and a command snapshot, the renderer paints
 * whatever state it leaves. Everything lives in world units (WORLD_W x WORLD_H); the renderer scales.
 *
 * Every number that shapes how the game feels is in TUNING, so the dynamics can be adjusted without
 * touching the logic.
 */

export const WORLD_W = 256
export const WORLD_H = 224
/** Water line: the ship floats on it, mines that reach it explode. */
export const SURFACE_Y = 24
/** Charges that reach this line explode on the bottom. */
export const SEABED_Y = 214

export const TUNING = {
    /**
     * Multiplies every MOVEMENT (ship, subs, mines, charges and their animation). The TIME countdown and the
     * spawn / fire cadences stay in real seconds.
     */
    speedFactor: 0.765,
    startTime: 90,
    maxCharges: 6,

    shipWidth: 35,
    shipHeight: 9,
    shipSpeed: 60,
    shipAcceleration: 6,
    shipHitImmunity: 1.5,

    subWidth: 27,
    subHeight: 12,
    lanes: 10,
    firstLaneY: 40,
    laneStep: 17,
    pointsPerLane: 10,
    subSpeedMin: 12,
    subSpeedMax: 34,
    subsAtStart: 3,
    subsMax: 8,
    /** Seconds of play that add one more sub to the maximum on screen. */
    subsGrowEvery: 15,
    spawnDelayMin: 0.6,
    spawnDelayMax: 2.2,

    chargeWidth: 5,
    chargeHeight: 3,
    /** Radians per second the charge turns while it falls and sinks. */
    chargeSpin: 7,
    chargeThrowSpeed: 26,
    chargeThrowLift: 30,
    chargeGravity: 160,
    chargeSinkSpeed: 28,

    mineWidth: 5,
    mineHeight: 5,
    /** Seconds each of the two mine frames stays on screen. */
    mineFrameTime: 0.15,
    mineSpeedMin: 16,
    mineSpeedMax: 26,
    /** A sub only fires when the ship is within this horizontal distance. */
    mineRange: 70,
    mineDelayMin: 2,
    mineDelayMax: 5,
    minesAtStart: 2,
    minePoints: 5,

    hitTimePenalty: 10,
    bonusEvery: 1000,
    bonusTime: 15,

    /** Seconds per difficulty level: subs and mines get faster, and mines more frequent. */
    levelEvery: 25,
    levelMax: 6,
    /** After game over, seconds before Enter starts a new game (so a held key does not skip it). */
    restartDelay: 1,
}

export enum EGameStatus {
    Ready = 'ready',
    Running = 'running',
    Over = 'over',
}

export enum ESide {
    Left = -1,
    Right = 1,
}

/** What the player asked for since the previous tick. Drops and start are edges, move is held. */
export interface IGameCommand {
    move: number
    dropLeft: boolean
    dropRight: boolean
    start: boolean
}

export interface IBox {
    x: number
    y: number
    w: number
    h: number
}

export interface IShip extends IBox {
    vx: number
    hitTime: number
}

export interface ISub extends IBox {
    lane: number
    dir: ESide
    speed: number
    points: number
    fireIn: number
}

export interface ICharge extends IBox {
    vx: number
    vy: number
    /** Drawing only: collisions use the unrotated box. */
    angle: number
}

export interface IMine extends IBox {
    vy: number
    /** Seconds alive, drives the two-frame animation. */
    age: number
}

export interface IBlast {
    x: number
    y: number
    size: number
    age: number
    life: number
}

export interface IPopup {
    x: number
    y: number
    text: string
    age: number
    life: number
}

const overlap = (a: IBox, b: IBox): boolean =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const laneY = (lane: number): number => TUNING.firstLaneY + lane * TUNING.laneStep

export class AbyssPatrolGame {
    status = EGameStatus.Ready
    ship: IShip = AbyssPatrolGame.newShip()
    subs: ISub[] = []
    charges: ICharge[] = []
    mines: IMine[] = []
    blasts: IBlast[] = []
    popups: IPopup[] = []
    score = 0
    time = TUNING.startTime
    elapsed = 0
    sunk = 0
    nextBonus = TUNING.bonusEvery
    private spawnIn = 0
    private overAge = 0
    private readonly random: () => number

    constructor(random: () => number = Math.random) {
        this.random = random
    }

    private static newShip(): IShip {
        return {
            x: (WORLD_W - TUNING.shipWidth) / 2,
            y: SURFACE_Y - TUNING.shipHeight,
            w: TUNING.shipWidth,
            h: TUNING.shipHeight,
            vx: 0,
            hitTime: 0,
        }
    }

    get chargesLeft(): number { return TUNING.maxCharges - this.charges.length }
    get level(): number { return Math.min(TUNING.levelMax, Math.floor(this.elapsed / TUNING.levelEvery)) }

    /** Back to the attract screen, nothing on the board. */
    reset(): void {
        this.status = EGameStatus.Ready
        this.clearBoard()
    }

    start(): void {
        this.clearBoard()
        this.status = EGameStatus.Running
    }

    private clearBoard(): void {
        this.ship = AbyssPatrolGame.newShip()
        this.subs = []
        this.charges = []
        this.mines = []
        this.blasts = []
        this.popups = []
        this.score = 0
        this.time = TUNING.startTime
        this.elapsed = 0
        this.sunk = 0
        this.nextBonus = TUNING.bonusEvery
        this.spawnIn = 0.3
        this.overAge = 0
    }

    tick(elapsedMs: number, command: IGameCommand): void {
        const dt = Math.min(elapsedMs, 50) / 1000
        this.ageEffects(dt)

        switch (this.status) {
            case EGameStatus.Ready:
                if (command.start) this.start()
                return
            case EGameStatus.Over:
                this.overAge += dt
                if (command.start && this.overAge >= TUNING.restartDelay) this.start()
                return
            case EGameStatus.Running:
                break
        }

        this.elapsed += dt
        this.time -= dt
        if (this.time <= 0) {
            this.time = 0
            this.status = EGameStatus.Over
            this.overAge = 0
            return
        }

        // Movement runs on its own, scaled clock; the countdown and the cadences use the real one.
        const motion = dt * TUNING.speedFactor
        this.moveShip(dt, motion, command.move)
        if (command.dropLeft) this.drop(ESide.Left)
        if (command.dropRight) this.drop(ESide.Right)
        this.spawn(dt)
        this.moveSubs(dt, motion)
        this.moveMines(motion)
        this.moveCharges(motion)
    }

    private ageEffects(dt: number): void {
        for (const b of this.blasts) b.age += dt
        this.blasts = this.blasts.filter(b => b.age < b.life)
        for (const p of this.popups) { p.age += dt; p.y -= 8 * dt }
        this.popups = this.popups.filter(p => p.age < p.life)
    }

    private moveShip(dt: number, motion: number, move: number): void {
        const s = this.ship
        s.vx += (Math.sign(move) * TUNING.shipSpeed - s.vx) * Math.min(1, motion * TUNING.shipAcceleration)
        s.x += s.vx * motion
        if (s.x < 0) { s.x = 0; s.vx = 0 }
        if (s.x > WORLD_W - s.w) { s.x = WORLD_W - s.w; s.vx = 0 }
        s.hitTime = Math.max(0, s.hitTime - dt)
    }

    private drop(side: ESide): void {
        if (this.chargesLeft <= 0) return
        const w = TUNING.chargeWidth
        const x = side === ESide.Left ? this.ship.x - w : this.ship.x + this.ship.w
        this.charges.push({
            x, y: this.ship.y, w, h: TUNING.chargeHeight,
            vx: side * TUNING.chargeThrowSpeed,
            vy: -TUNING.chargeThrowLift,
            angle: 0,
        })
    }

    private spawn(dt: number): void {
        this.spawnIn -= dt
        const max = Math.min(TUNING.subsMax, TUNING.subsAtStart + Math.floor(this.elapsed / TUNING.subsGrowEvery))
        if (this.spawnIn > 0 || this.subs.length >= max) return
        this.spawnIn = this.between(TUNING.spawnDelayMin, TUNING.spawnDelayMax)

        // A lane is free when nothing in it is heading the other way or still close to the entry point.
        for (let attempt = 0; attempt < 8; attempt++) {
            const lane = Math.floor(this.random() * TUNING.lanes)
            const dir = this.random() < 0.5 ? ESide.Right : ESide.Left
            const x = dir === ESide.Right ? -TUNING.subWidth : WORLD_W
            const busy = this.subs.some(s => s.lane === lane && (s.dir !== dir || Math.abs(s.x - x) < TUNING.subWidth * 3))
            if (busy) continue
            this.subs.push({
                lane, dir, x,
                y: laneY(lane),
                w: TUNING.subWidth,
                h: TUNING.subHeight,
                speed: this.between(TUNING.subSpeedMin, TUNING.subSpeedMax) * (1 + this.level * 0.1),
                points: (lane + 1) * TUNING.pointsPerLane,
                fireIn: this.between(TUNING.mineDelayMin, TUNING.mineDelayMax),
            })
            return
        }
    }

    private moveSubs(dt: number, motion: number): void {
        const shipCenter = this.ship.x + this.ship.w / 2
        const maxMines = TUNING.minesAtStart + this.level
        for (const s of this.subs) {
            s.x += s.dir * s.speed * motion
            s.fireIn -= dt
            const center = s.x + s.w / 2
            const onScreen = s.x >= 0 && s.x + s.w <= WORLD_W
            if (s.fireIn <= 0) {
                s.fireIn = this.between(TUNING.mineDelayMin, TUNING.mineDelayMax) / (1 + this.level * 0.2)
                if (onScreen && Math.abs(center - shipCenter) < TUNING.mineRange && this.mines.length < maxMines) {
                    this.mines.push({
                        x: center - TUNING.mineWidth / 2,
                        y: s.y - TUNING.mineHeight,
                        w: TUNING.mineWidth,
                        h: TUNING.mineHeight,
                        vy: this.between(TUNING.mineSpeedMin, TUNING.mineSpeedMax) * (1 + this.level * 0.1),
                        age: 0,
                    })
                }
            }
        }
        this.subs = this.subs.filter(s => s.dir === ESide.Right ? s.x < WORLD_W : s.x + s.w > 0)
    }

    private moveMines(dt: number): void {
        for (const m of this.mines) {
            m.y -= m.vy * dt
            m.age += dt
            if (m.y > SURFACE_Y) continue
            m.vy = 0
            const hitsShip = m.x + m.w > this.ship.x && m.x < this.ship.x + this.ship.w
            if (hitsShip && this.ship.hitTime <= 0) this.hitShip(m.x)
            else this.blast(m.x, SURFACE_Y, 4)
        }
        this.mines = this.mines.filter(m => m.vy > 0)
    }

    private hitShip(x: number): void {
        this.time = Math.max(0, this.time - TUNING.hitTimePenalty)
        this.ship.hitTime = TUNING.shipHitImmunity
        this.blast(x, SURFACE_Y - 4, 16)
        this.popup(this.ship.x + this.ship.w / 2, SURFACE_Y + 12, `-${TUNING.hitTimePenalty} SEC`)
    }

    private moveCharges(dt: number): void {
        const kept: ICharge[] = []
        for (const c of this.charges) {
            if (c.y + c.h < SURFACE_Y) {
                c.vy += TUNING.chargeGravity * dt
            }
            else {
                c.vy = TUNING.chargeSinkSpeed
                c.vx *= Math.exp(-6 * dt)
            }
            c.x += c.vx * dt
            c.y += c.vy * dt
            c.angle += TUNING.chargeSpin * dt

            const sub = this.subs.find(s => overlap(c, s))
            if (sub) {
                this.subs = this.subs.filter(s => s !== sub)
                this.sunk++
                this.blast(sub.x + sub.w / 2, sub.y + sub.h / 2, 14)
                this.addScore(sub.points, sub.x + sub.w / 2, sub.y)
                continue
            }
            const mine = this.mines.find(m => overlap(c, m))
            if (mine) {
                this.mines = this.mines.filter(m => m !== mine)
                this.blast(mine.x, mine.y, 6)
                this.addScore(TUNING.minePoints, mine.x, mine.y)
                continue
            }
            if (c.y + c.h >= SEABED_Y) {
                this.blast(c.x, SEABED_Y, 5)
                continue
            }
            kept.push(c)
        }
        this.charges = kept
    }

    private addScore(points: number, x: number, y: number): void {
        this.score += points
        this.popup(x, y, String(points))
        while (this.score >= this.nextBonus) {
            this.time += TUNING.bonusTime
            this.nextBonus += TUNING.bonusEvery
            this.popup(WORLD_W / 2, SURFACE_Y + 30, `+${TUNING.bonusTime} SEC`)
        }
    }

    private blast(x: number, y: number, size: number): void {
        this.blasts.push({ x, y, size, age: 0, life: 0.4 })
    }

    private popup(x: number, y: number, text: string): void {
        this.popups.push({ x, y, text, age: 0, life: 1 })
    }

    private between(min: number, max: number): number {
        return min + this.random() * (max - min)
    }
}
