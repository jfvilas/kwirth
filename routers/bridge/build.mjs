import esbuild from 'esbuild'
import { execFileSync } from 'child_process'
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
    // 'ws' goes inside (the core does not lend it, and the link needs headers on its client); its native
    // accelerators are optional and it runs without them
    external: ['bufferutil', 'utf-8-validate'],
    // the version it tells its peer in the hello
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

// esbuild strips types without checking them: tsc runs first and aborts a broken build
const TSC = 'node_modules/typescript/lib/tsc.js'
if (fs.existsSync(TSC)) execFileSync(process.execPath, [TSC, '--noEmit'], { stdio: 'inherit' })

await esbuild.build(backOptions)
writeDistMeta()
// the package carries its README (npmjs shows it, and whoever installs the tgz has it)
fs.copyFileSync('README.md', path.join('dist', 'README.md'))
console.log("Done. 'npm pack' in dist/ gives the package to install in the Routers manager.")
