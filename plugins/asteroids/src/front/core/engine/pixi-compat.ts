/**
 * Local replacement for the six symbols the asteroids core used from
 * '@pixi/core'. None of them had anything to do with rendering: they are
 * constants and geometry. With this the core is left with no external dependencies
 * and the plugin bundle does not drag in the whole of Pixi.
 *
 * The extra methods (translate, scale, intersects, getBoundingBox, rotate,
 * contains2) are declared here through declaration merging and implemented in math.ts, which
 * is where they originally were.
 */

export const DEG_TO_RAD = Math.PI / 180
export const PI_2 = Math.PI * 2

export interface ISize {
    width: number
    height: number
}

export interface IPointData {
    x: number
    y: number
}

export class Rectangle {
    x: number
    y: number
    width: number
    height: number

    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }

    get left(): number { return this.x }
    get right(): number { return this.x + this.width }
    get top(): number { return this.y }
    get bottom(): number { return this.y + this.height }

    clone(): Rectangle {
        return new Rectangle(this.x, this.y, this.width, this.height)
    }

    copyFrom(other: Rectangle): this {
        this.x = other.x
        this.y = other.y
        this.width = other.width
        this.height = other.height
        return this
    }

    contains(x: number, y: number): boolean {
        if (this.width <= 0 || this.height <= 0) return false
        return x >= this.x && x < this.x + this.width && y >= this.y && y < this.y + this.height
    }
}

export class Polygon {
    points: number[]
    closeStroke = true

    constructor(...args: (number | IPointData)[] | [(number | IPointData)[]]) {
        let flat = args as (number | IPointData)[]
        if (flat.length === 1 && Array.isArray(flat[0])) {
            flat = flat[0] as unknown as (number | IPointData)[]
        }
        if (flat.length > 0 && typeof flat[0] !== 'number') {
            const points: number[] = []
            for (const p of flat as IPointData[]) {
                points.push(p.x, p.y)
            }
            this.points = points
        }
        else {
            this.points = (flat as number[]).slice()
        }
    }

    clone(): Polygon {
        const p = new Polygon(this.points.slice())
        p.closeStroke = this.closeStroke
        return p
    }

    contains(x: number, y: number): boolean {
        let inside = false
        const length = this.points.length / 2
        for (let i = 0, j = length - 1; i < length; j = i++) {
            const xi = this.points[i * 2]
            const yi = this.points[i * 2 + 1]
            const xj = this.points[j * 2]
            const yj = this.points[j * 2 + 1]
            if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) {
                inside = !inside
            }
        }
        return inside
    }
}

export class ObservablePoint {
    private _x: number
    private _y: number
    private readonly _cb: () => void
    private readonly _scope: unknown

    constructor(cb: () => void, scope: unknown, x = 0, y = 0) {
        this._cb = cb
        this._scope = scope
        this._x = x
        this._y = y
    }

    get x(): number { return this._x }
    set x(value: number) {
        if (this._x !== value) {
            this._x = value
            this._cb.call(this._scope)
        }
    }

    get y(): number { return this._y }
    set y(value: number) {
        if (this._y !== value) {
            this._y = value
            this._cb.call(this._scope)
        }
    }

    set(x = 0, y = x): this {
        if (this._x !== x || this._y !== y) {
            this._x = x
            this._y = y
            this._cb.call(this._scope)
        }
        return this
    }

    equals(point: IPointData): boolean {
        return point.x === this._x && point.y === this._y
    }

    copyFrom(point: IPointData): this {
        return this.set(point.x, point.y)
    }

    clone(cb = this._cb, scope = this._scope): ObservablePoint {
        return new ObservablePoint(cb, scope, this._x, this._y)
    }
}

// Declarations of the methods that math.ts injects into the prototypes.
// This used to be a `declare module "@pixi/core"`.
export interface Rectangle {
    translate(x: number, y: number): Rectangle
    scale(scale: number): Rectangle
    intersects(other: Rectangle): boolean
}

export interface Polygon {
    translate(x: number, y: number): Polygon
    rotate(angle: number): Polygon
    scale(scale: number): Polygon
    getBoundingBox(result?: Rectangle): Rectangle
    intersects(other: Polygon): boolean
    contains2(point: IPointData, center: IPointData, margin?: number): boolean
}
