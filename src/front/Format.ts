// The figures as XP's Task Manager wrote them. Pure, so the tests check them without a browser.

const thousands = (n: number): string => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')

// Mem Usage and the memory boxes: kilobytes with thousands separators, '4,128 K'.
export const kilobytes = (bytes: number | undefined): string => bytes === undefined ? '' : `${thousands(bytes / 1024)} K`

// The same, without the unit: the Performance tab's boxes say '(K)' in their title.
export const kilobytesBare = (bytes: number | undefined): string => bytes === undefined ? '' : thousands(bytes / 1024)

// The CPU column: two digits, '00' to '99' (a whole machine is '100' only for the idle process).
export const cpuColumn = (percent: number | undefined): string => {
    if (percent === undefined) return ''
    const n = Math.min(100, Math.max(0, Math.round(percent)))
    return n < 10 ? `0${n}` : String(n)
}

// CPU Time: hours, minutes and seconds, '0:00:12'.
export const cpuTime = (seconds: number | undefined): string => {
    if (seconds === undefined) return ''
    const s = Math.floor(seconds)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// The status bar and the meters: a whole percentage, '1%'.
export const percent = (value: number | undefined): string => value === undefined ? '--' : `${Math.round(value)}%`

// Commit Charge in the status bar: megabytes, '276M'.
export const megabytes = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)}M`

// The PF Usage meter: '276 MB', or '1.2 GB' once it no longer fits.
export const meterBytes = (bytes: number): string => bytes >= 10 * 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 / 1024)} MB`

// Network Utilization: two decimals under 1%, as XP showed a quiet adapter ('0.04 %').
export const utilisation = (value: number | undefined): string => {
    if (value === undefined) return '0 %'
    if (value === 0) return '0 %'
    return value < 1 ? `${value.toFixed(2)} %` : `${Math.round(value)} %`
}

// Link Speed: '1 Gbps', '100 Mbps'.
export const linkSpeed = (bps: number): string => bps >= 1e9 ? `${bps / 1e9} Gbps` : `${bps / 1e6} Mbps`

/*
    The vertical scale of a network graph: XP grows it in steps so a quiet adapter is still visible — 1 %, then
    5, 10, 25, 50 and 100 %.
*/
const NETWORK_SCALES = [1, 5, 10, 25, 50, 100]
export const networkScale = (values: number[]): number => {
    const peak = Math.max(0, ...values)
    return NETWORK_SCALES.find(s => peak <= s) ?? 100
}
