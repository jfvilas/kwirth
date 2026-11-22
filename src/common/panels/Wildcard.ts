/*
    SDSF filter patterns, as PREFIX and OWNER take them: '*' is any string (empty included) and '%' exactly one
    character. Case does not matter, and a pattern without wildcards matches the whole name, not a part of it —
    PREFIX API is the job API, PREFIX API* every job starting with API.
*/
export const sdsfPatternMatches = (pattern: string, value: string): boolean => {
    if (!pattern || pattern === '*') return true
    const source = [...pattern].map(c => c === '*' ? '.*' : c === '%' ? '.' : c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('')
    return new RegExp('^' + source + '$', 'i').test(value)
}
