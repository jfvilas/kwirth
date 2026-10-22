/*
    Web Mercator arithmetic for the tile map, kept apart from the component so it can be tested without
    React. Coordinates are world pixels at a given zoom: 256 × 2^zoom wide.
*/

export const TILE = 256
export const MIN_ZOOM = 2
export const MAX_ZOOM = 17

export interface IMapBounds {
    lamin: number
    lomin: number
    lamax: number
    lomax: number
}

export const project = (lat: number, lon: number, zoom: number): { x: number, y: number } => {
    const scale = TILE * Math.pow(2, zoom)
    const clamped = Math.max(-85.05, Math.min(85.05, lat))
    const rad = clamped * Math.PI / 180
    return {
        x: (lon + 180) / 360 * scale,
        y: (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * scale
    }
}

export const unproject = (x: number, y: number, zoom: number): { lat: number, lon: number } => {
    const scale = TILE * Math.pow(2, zoom)
    const lon = x / scale * 360 - 180
    const n = Math.PI - 2 * Math.PI * y / scale
    return { lat: 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), lon }
}

/** The highest zoom at which the whole box fits in a viewport of that size. */
export const fitZoom = (b: IMapBounds, width: number, height: number): number => {
    for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
        const a = project(b.lamax, b.lomin, z)
        const c = project(b.lamin, b.lomax, z)
        if (c.x - a.x <= width && c.y - a.y <= height) return z
    }
    return MIN_ZOOM
}
