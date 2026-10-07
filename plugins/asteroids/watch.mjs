import esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

const kwirthGlobalsPlugin = {
    name: 'kwirth-globals',
    setup(build) {
        const globals = {
            'react': 'window.__kwirth__.React',
            '@mui/material': 'window.__kwirth__.MUI.material',
            '@mui/icons-material': 'window.__kwirth__.MUI.icons',
            '@kwirthmagnify/kwirth-common': 'window.__kwirth__.kwirthCommon',
            '@kwirthmagnify/kwirth-common-front': 'window.__kwirth__.kwirthCommonFront',
            '@codemirror/view': 'window.__kwirth__.codeMirrorView',
            '@codemirror/state': 'window.__kwirth__.codeMirrorState',
            '@codemirror/commands': 'window.__kwirth__.codeMirrorCommands',
            '@codemirror/search': 'window.__kwirth__.codeMirrorSearch',
            '@codemirror/language': 'window.__kwirth__.codeMirrorLanguage',
            '@codemirror/lang-yaml': 'window.__kwirth__.codeMirrorLangYaml',
            '@codemirror/theme-one-dark': 'window.__kwirth__.codeMirrorThemeOneDark',
            '@uiw/react-codemirror': 'window.__kwirth__.uiwReactCodeMirror',
            '@jfvilas/react-file-manager': 'window.__kwirth__.jfvilasReactFileManager',

            '@kwirthmagnify/kwirth-common-front': 'window.__kwirth__.kwirthCommonFront',
            '@codemirror/view': 'window.__kwirth__.codeMirrorView',
            '@codemirror/state': 'window.__kwirth__.codeMirrorState',
            '@codemirror/commands': 'window.__kwirth__.codeMirrorCommands',
            '@codemirror/search': 'window.__kwirth__.codeMirrorSearch',
            '@codemirror/language': 'window.__kwirth__.codeMirrorLanguage',
            '@codemirror/lang-yaml': 'window.__kwirth__.codeMirrorLangYaml',
            '@codemirror/theme-one-dark': 'window.__kwirth__.codeMirrorThemeOneDark',
            '@uiw/react-codemirror': 'window.__kwirth__.uiwReactCodeMirror',
            '@jfvilas/react-file-manager': 'window.__kwirth__.jfvilasReactFileManager',

        }
        for (const pkg of Object.keys(globals)) {
            build.onResolve({ filter: new RegExp(`^${pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }, () => ({
                path: pkg,
                namespace: 'kwirth-globals',
            }))
        }
        build.onLoad({ filter: /.*/, namespace: 'kwirth-globals' }, (args) => ({
            contents: `const _m = ${globals[args.path]}; const _d = (_m && _m.__esModule) ? _m.default : _m; module.exports = Object.assign({}, (typeof _m === 'object' && _m !== null) ? _m : {}, {default: _d, __esModule: true});`,
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
            '@kwirthmagnify/kwirth-common-ai': 'global.__kwirth_back__.kwirthCommonAi',
            '@kwirthmagnify/kwirth-common-ai/back': 'global.__kwirth_back__.kwirthCommonAiBack',
        }
        build.onResolve({ filter: /^@kwirthmagnify\/kwirth-common(-ai(\/back)?|-back)?$/ }, (args) => {
            if (backGlobals[args.path]) return { path: args.path, namespace: 'kwirth-back-globals' }
        })
        build.onLoad({ filter: /.*/, namespace: 'kwirth-back-globals' }, (args) => ({
            contents: 'module.exports = ' + backGlobals[args.path],
            loader: 'js',
        }))
    },
}

fs.mkdirSync('dist', { recursive: true })

const meta = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify({ id: meta.id, name: meta.name, version: meta.version, description: meta.description, icon: meta.icon, ...(meta.website ? { website: meta.website } : {}) , requiresRestart: meta.requiresRestart ?? false, requiresExtension: meta.requiresExtension ?? [] }, null, 2))

const frontCtx = await esbuild.context({
    entryPoints: ['src/front/index.ts'],
    bundle: true,
    format: 'iife',
    outfile: 'dist/front.js',
    plugins: [kwirthGlobalsPlugin],
    loader: { '.tsx': 'tsx', '.ts': 'ts' },
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
    define: { 'process.env.NODE_ENV': '"development"' },
    minify: false,
})

const backCtx = await esbuild.context({
    entryPoints: ['src/back/index.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: 'dist/back.js',
    plugins: [kwirthBackGlobalsPlugin],
    external: ['express'],
    loader: { '.ts': 'ts' },
    minify: false,
})

await frontCtx.watch()
await backCtx.watch()

/*
    Docs: rebuilds docs/asteroids.tgz when the guide changes, just like front/back with src/. The core
    installs it via loadDevDocs AT STARTUP, so a change in the guide shows after restarting the core;
    what the watch gives you is a tgz that is already fresh when that happens.

    The rebuild has a small grouping delay: saving several pages in a row (or an editor that writes
    in two steps) would otherwise trigger one packaging per write.
*/
let docsTimer
const rebuildDocs = () => {
    clearTimeout(docsTimer)
    docsTimer = setTimeout(() => {
        const p = spawn(process.execPath, ['build-docs-tgz.mjs'], { stdio: 'inherit' })
        p.on('exit', (c) => console.log(`[watch] docs/asteroids.tgz rebuilt (exit ${c})`))
    }, 250)
}
rebuildDocs()   // initial build
if (fs.existsSync('docs/guide')) fs.watch('docs/guide', { recursive: true }, rebuildDocs)

/*
    Login: it has its own watch.mjs (it watches login.json, package.json and background.png and
    rebuilds its .tgz). It is launched as a child process so that a single `node watch.mjs` command
    rebuilds the WHOLE plugin: front, back, docs and login.
*/
if (fs.existsSync(path.join('login', 'watch.mjs'))) {
    const child = spawn(process.execPath, ['watch.mjs'], { cwd: 'login', stdio: 'inherit' })
    child.on('exit', (code) => console.log(`[watch] the login watcher ended (exit ${code})`))
}

console.log('[watch] Watching src/ — front.js and back.js rebuild on every change.')
console.log('[watch] Watching docs/guide/ — docs/asteroids.tgz rebuilds on every change.')
console.log('[watch] Watching login/ — login/dist/kwirth-login-asteroids.tgz rebuilds on every change.')
console.log('[watch] kwirth backend hot-reloads back.js automatically.')
console.log('[watch] kwirth frontend polls for front.js changes every 2s.')
