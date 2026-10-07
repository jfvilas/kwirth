// Generates docs/asteroids.tgz from docs/guide/ for the Kwirth docs marketplace (extensionType: docs).
// Published to npmjs by running `npm publish` inside docs/npm/ (see below why not the .tgz).
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { create as tarCreate } from 'tar'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('./package.json')

const guideDir = join(__dirname, 'docs', 'guide')
const outTgz = join(__dirname, 'docs', 'asteroids.tgz')

if (!existsSync(guideDir)) { console.error('docs/guide/ not found'); process.exit(1) }

const tmpDir = join(tmpdir(), `kwirth-docs-asteroids-${Date.now()}`)
mkdirSync(tmpDir, { recursive: true })
try {
    cpSync(guideDir, tmpDir, { recursive: true })

    // The core serves docsify offline (own bundle): rewrite CDN URLs to local paths.
    const htmlPath = join(tmpDir, 'index.html')
    if (existsSync(htmlPath)) {
        let html = readFileSync(htmlPath, 'utf-8')
        html = html
            .replace(/\/\/cdn\.jsdelivr\.net\/npm\/docsify@4\/lib\/themes\/vue\.css/g, '../../docsify/vue.css')
            .replace(/\/\/cdn\.jsdelivr\.net\/npm\/docsify@4[^"']*/g, '../../docsify/docsify.min.js')
            .replace(/\/\/cdn\.jsdelivr\.net\/npm\/docsify\/lib\/plugins\/search\.min\.js/g, '../../docsify/search.min.js')
            .replace(/\/\/cdn\.jsdelivr\.net\/npm\/docsify-copy-code[^"']*/g, '../../docsify/docsify-copy-code.min.js')
            .replace(/\/\/cdn\.jsdelivr\.net\/npm\/docsify-sidebar-collapse[^"']*/g, '../../docsify/docsify-sidebar-collapse.min.js')
            .replace(/relativePath\s*:\s*true/g, 'relativePath: false')
        writeFileSync(htmlPath, html)
    }

    writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
        extensionType: 'docs',
        targetType: 'plugin',
        id: 'asteroids',
        // the npm scope is the plugin's publisher, so the guide is published next to it
        name: `${pkg.publisher}/kwirth-docs-asteroids`,
        displayName: 'Asteroids — Guide',
        version: pkg.version,
        description: 'User and administrator guide for the Asteroids plugin',
        license: pkg.license,
        repository: pkg.repository
    }, null, 2))

    // npm shows this as the package page: what it is, and where Kwirth is
    writeFileSync(join(tmpDir, 'README.md'), [
        '# Asteroids — Guide',
        '',
        'User and administrator guide of the **Asteroids** channel plugin for [Kwirth](https://kwirthmagnify.dev),',
        'the Kubernetes observability and operations platform ([source](https://github.com/kwirthmagnify/kwirth)).',
        '',
        `Install it from Kwirth's docs manager, next to the plugin (\`${pkg.publisher}/kwirth-plugin-asteroids\`):`,
        'both are listed in the jfvilas marketplace, `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`.',
        'Kwirth then opens it from the help buttons of the channel.',
        '',
        'Source: https://github.com/jfvilas/kwirth (folder `plugins/asteroids/docs/guide`).',
        ''
    ].join('\n'))

    await tarCreate({ gzip: true, file: outTgz, cwd: tmpDir }, readdirSync(tmpDir).map(f => `./${f}`))

    /*
        npmjs refuses this .tgz as it is (415 "invalid path": it carries directory entries, which a tarball
        made by `npm pack` never does). So the same content is left in docs/npm/ and published from there —
        `npm publish` run inside it packs it the npm way. The core installs both shapes: it strips the
        `package/` prefix when package.json is not at the root.
    */
    const npmDir = join(__dirname, 'docs', 'npm')
    rmSync(npmDir, { recursive: true, force: true })
    cpSync(tmpDir, npmDir, { recursive: true })
    console.log(`asteroids docs tgz: ${outTgz} (v${pkg.version})`)
}
finally {
    rmSync(tmpDir, { recursive: true, force: true })
}
