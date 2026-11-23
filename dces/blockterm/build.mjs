import esbuild from 'esbuild'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

/*
    A DCE bundles NOTHING of Kwirth's: its imports of common and common-back resolve against the
    globals the core publishes — 'window.__kwirth__' in the front end, 'global.__kwirth_back__' in the
    back end. That is what keeps the registry a single one: the DCE and its consumers see the same
    common-back, so the same getDce().

    React resolves against the core's too: TerminalView's hooks only work against the React that renders
    them, which is the core's (and the consumer's, that resolves it the same way).
*/
const kwirthFrontGlobalsPlugin = {
    name: 'kwirth-globals',
    setup(build) {
        const globals = {
            '@kwirthmagnify/kwirth-common': 'window.__kwirth__.kwirthCommon',
            '@kwirthmagnify/kwirth-common-front': 'window.__kwirth__.kwirthCommonFront',
            'react': 'window.__kwirth__.React',
        }
        for (const pkg of Object.keys(globals)) {
            build.onResolve({ filter: new RegExp(`^${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }, () => ({ path: pkg, namespace: 'kwirth-globals' }))
        }
        build.onLoad({ filter: /.*/, namespace: 'kwirth-globals' }, (args) => ({
            contents: `const _m = ${globals[args.path]}; module.exports = Object.assign({}, _m, { default: _m, __esModule: true });`,
            loader: 'js',
        }))
    },
}

const kwirthBackGlobalsPlugin = {
    name: 'kwirth-back-globals',
    setup(build) {
        const backGlobals = {
            '@kwirthmagnify/kwirth-common': 'global.__kwirth_back__.kwirthCommon',
            '@kwirthmagnify/kwirth-common-back': 'global.__kwirth_back__.kwirthCommonBack',
        }
        build.onResolve({ filter: /^@kwirthmagnify\/kwirth-common(-back)?$/ }, (args) => {
            if (backGlobals[args.path]) return { path: args.path, namespace: 'kwirth-back-globals' }
        })
        build.onLoad({ filter: /.*/, namespace: 'kwirth-back-globals' }, (args) => ({
            contents: 'module.exports = ' + backGlobals[args.path],
            loader: 'js',
        }))
    },
}

// esbuild erases the types without looking at them: without this step the build would pass broken TS.
const TSC = 'node_modules/typescript/lib/tsc.js'
if (fs.existsSync(TSC)) {
    try {
        execFileSync(process.execPath, [TSC, '--noEmit'], { stdio: 'inherit' })
        console.log('Typecheck passed')
    }
    catch {
        console.error('Typecheck failed — build aborted')
        process.exit(1)
    }
}
else {
    console.log('Skipping typecheck: typescript is not installed (run npm install)')
}

fs.mkdirSync('dist', { recursive: true })

await esbuild.build({
    entryPoints: ['src/front/index.ts'],
    bundle: true,
    format: 'iife',
    outfile: 'dist/front.js',
    plugins: [kwirthFrontGlobalsPlugin],
    loader: { '.ts': 'ts', '.tsx': 'tsx', '.woff': 'dataurl' },
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
    minify: false,
})
console.log('Built dist/front.js')

/*
    The package entry for CONSUMERS, which Kwirth never loads: their unit tests import the package without the
    DCE mapping, so they need the real engine as an ES module (React left to them), and their typecheck needs
    the declarations. In the browser the same imports are mapped to the instance and this file is never read.
*/
await esbuild.build({
    entryPoints: ['src/front/BlockTerm.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile: 'dist/index.mjs',
    external: ['react', '@kwirthmagnify/kwirth-common'],
    loader: { '.ts': 'ts', '.tsx': 'tsx', '.woff': 'dataurl' },
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
    minify: false,
})
console.log('Built dist/index.mjs')

fs.rmSync(path.join('dist', 'types'), { recursive: true, force: true })
if (fs.existsSync(TSC)) {
    execFileSync(process.execPath, [TSC, '--declaration', '--emitDeclarationOnly', '--noEmit', 'false', '--outDir', path.join('dist', 'types')], { stdio: 'inherit' })
    console.log('Wrote dist/types')
}


const meta = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
const distMeta = {
    type: 'commonjs',
    extensionType: 'dce',
    id: meta.id,
    name: meta.name,
    displayName: meta.displayName,
    version: meta.version,
    description: meta.description,
    ...(meta.website ? { website: meta.website } : {}),
    ...(meta.publishConfig ? { publishConfig: meta.publishConfig } : {}),
    // Always true for a DCE: consumers keep the previous instance until the server restarts.
    requiresRestart: true,
    requiresExtension: meta.requiresExtension ?? [],
    tags: meta.tags ?? [],
    // What a consumer's typecheck and unit tests read (see dist/index.mjs above). Kwirth reads front.js.
    types: 'types/front/BlockTerm.d.ts',
    exports: {
        '.': {
            types: './types/front/BlockTerm.d.ts',
            import: './index.mjs'
        }
    },
    peerDependencies: {
        'react': meta.devDependencies['react']
    },
    homepage: meta.website,
    license: meta.license,
    repository: { type: 'git', url: 'git+https://github.com/jfvilas/kwirth.git', directory: 'dces/blockterm' },
    keywords: ['kwirth', 'kubernetes', 'dce', 'terminal', '3270', '5250', 'emulator'],
}
fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify(distMeta, null, 2))
console.log('Wrote dist/package.json')

// The package page on npm is this README: publishing without it leaves a page that says nothing.
fs.copyFileSync('README.md', path.join('dist', 'README.md'))
// The 3270 font is embedded in front.js and index.mjs: its licence travels with them.
fs.copyFileSync(path.join('src', 'front', 'fonts', 'LICENSE-3270font.txt'), path.join('dist', 'LICENSE-3270font.txt'))
console.log('Copied README.md and LICENSE-3270font.txt to dist/')

