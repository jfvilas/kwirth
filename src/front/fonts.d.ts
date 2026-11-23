// The build loads .woff files as data: URLs (loader 'dataurl' in build.mjs and watch.mjs).
declare module '*.woff' {
    const src: string
    export default src
}
