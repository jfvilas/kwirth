import esbuild from 'esbuild'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const kwirthGlobalsPlugin = {
    name: 'kwirth-globals',
    setup(build) {
        const globals = {
            'react': 'window.__kwirth__.React',
            '@mui/material': 'window.__kwirth__.MUI.material',
            '@mui/icons-material': 'window.__kwirth__.MUI.icons',
            '@kwirthmagnify/kwirth-common': 'window.__kwirth__.kwirthCommon',
            '@kwirthmagnify/kwirth-common-front': 'window.__kwirth__.kwirthCommonFront',
            /*
                🔴 Everything the core publishes on window.__kwirth__ goes HERE, used or not: a
                package that is NOT on this map gets BUNDLED. vllm shipped a 1 MB front.js without
                noticing, because importing recharts dragged in d3 and 382 lodash modules; with it
                mapped, the same bundle is 59 KB. If you use another library from the runtime barrel
                (codemirror, the file manager…), add it here too.
            */
            'recharts': 'window.__kwirth__.recharts',
            'react-dom': 'window.__kwirth__.ReactDOM',
            '@kwirthmagnify/kwirth-common-ai/front': 'window.__kwirth__.kwirthCommonAiFront',
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
            build.onResolve({ filter: new RegExp(`^${pkg.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}$`) }, () => ({ path: pkg, namespace: 'kwirth-globals' }))
        }
        build.onLoad({ filter: /.*/, namespace: 'kwirth-globals' }, (args) => ({
            contents: `const _m = ${globals[args.path]}; let _d = (_m != null && 'default' in Object(_m)) ? _m.default : _m; if (typeof _d !== 'function' && _d != null && typeof _d.default !== 'undefined') _d = _d.default; module.exports = Object.assign({}, (typeof _m === 'object' && _m !== null) ? _m : {}, {default: _d, __esModule: true});`,
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
// watch.mjs deliberately leaves it out, so that saving stays instantaneous.
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
    plugins: [kwirthGlobalsPlugin],
    // Sprites travel inside front.js as SVG text (src/front/sprites).
    loader: { '.tsx': 'tsx', '.ts': 'ts', '.svg': 'text' },
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020',
    minify: false,
})
console.log('Built dist/front.js')

await esbuild.build({
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
console.log('Built dist/back.js')

const meta = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
// the npm scope is the publisher's: this repository publishes under @jfvilas, not under @kwirthmagnify
const npmName = `${meta.publisher}/kwirth-plugin-${meta.id}`
const distMeta = {
    id: meta.id,
    name: npmName,
    displayName: meta.displayName,
    extensionType: 'plugin',
    version: meta.version,
    description: meta.description,
    icon: meta.icon,
    ...(meta.website ? { website: meta.website } : {}),
    ...(meta.repository ? { repository: meta.repository } : {}),
    requiresRestart: meta.requiresRestart ?? false,
    requiresExtension: meta.requiresExtension ?? [],
}
fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify(distMeta, null, 2))
console.log('Wrote dist/package.json')

// npm publishes from dist/, so the README has to be there to reach the tarball and npmjs.org
fs.copyFileSync('README.md', path.join('dist', 'README.md'))
console.log('Copied dist/README.md')

console.log("Done. Run 'npm publish --access=public' on your 'dist' folder in order to publish your package to npmjs.")
console.log(`Package will be accessible (and installable on Kwirth) via this URL: https://registry.npmjs.org/${npmName}/-/kwirth-plugin-${meta.id}-${meta.version}.tgz`)
