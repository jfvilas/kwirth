// The build loads .ttf files as data: URLs (loader 'dataurl' in build.mjs, watch.mjs and tests/run.mjs).
declare module '*.ttf' {
    const src: string
    export default src
}
