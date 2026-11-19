// The build loads .svg files as text (loader '.svg': 'text' in build.mjs / watch.mjs).
declare module '*.svg' {
    const content: string
    export default content
}
