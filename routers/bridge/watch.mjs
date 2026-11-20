import esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

// The core lends its own libraries to extensions (global.__kwirth_back__): bundling them would make the
// router heavy and give it its own copy of what must be the core's (enums compared by identity, for one).
const kwirthBackGlobalsPlugin = {
    name: 'kwirth-back-globals',
    setup(build) {
        const globals = {
            '@kwirthmagnify/kwirth-common': 'global.__kwirth_back__.kwirthCommon',
            '@kwirthmagnify/kwirth-common-back': 'global.__kwirth_back__.kwirthCommonBack',
            'express': 'global.__kwirth_back__.express',
        }
        build.onResolve({ filter: /^(@kwirthmagnify\/kwirth-common|@kwirthmagnify\/kwirth-common-back|express)$/ }, (args) => ({ path: args.path, namespace: 'kwirth-back-globals' }))
        build.onLoad({ filter: /.*/, namespace: 'kwirth-back-globals' }, (args) => ({ contents: `module.exports = ${globals[args.path]};`, loader: 'js' }))
    },
}

const backOptions = {
    entryPoints: ['src/index.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    outfile: 'dist/back.js',
    plugins: [kwirthBackGlobalsPlugin],
    loader: { '.ts': 'ts' },
    minify: false,
    external: ['bufferutil', 'utf-8-validate'],
    define: { __BRIDGE_VERSION__: JSON.stringify(JSON.parse(fs.readFileSync('package.json', 'utf-8')).version) },
}

// What the core reads when installing: the extensionType says it is a router
const writeDistMeta = () => {
    const meta = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
    fs.mkdirSync('dist', { recursive: true })
    fs.writeFileSync(path.join('dist', 'package.json'), JSON.stringify({
        type: 'commonjs',
        extensionType: 'router',
        id: meta.id,
        name: meta.name,
        displayName: meta.displayName,
        version: meta.version,
        description: meta.description,
        ...(meta.website ? { website: meta.website } : {}),
        requiresRestart: false,
        requiresExtension: meta.requiresExtension ?? [],
        tags: meta.tags ?? [],
    }, null, 2))
}

// Point back/kwirth-dev.json "routers": { "bridge": "<path to this dist>" } at it: the core reloads it on every build
writeDistMeta()
const context = await esbuild.context(backOptions)
await context.watch()
console.log('Watching src/ ...')
