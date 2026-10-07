// Generates docs/webamp.tgz from docs/guide/ for the Kwirth docs marketplace (extensionType: docs).
import { cpSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { create as tarCreate } from 'tar'
import { createRequire } from 'module'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = createRequire(import.meta.url)('./package.json')

const guideDir = join(__dirname, 'docs', 'guide')
const outTgz = join(__dirname, 'docs', 'webamp.tgz')

if (!existsSync(guideDir)) { console.error('docs/guide/ not found'); process.exit(1) }

const tmpDir = join(tmpdir(), `kwirth-docs-webamp-${Date.now()}`)
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
        id: 'webamp',
        // the npm scope is the plugin's publisher, so the guide is published next to it
        name: `${pkg.publisher}/kwirth-docs-webamp`,
        displayName: 'Webamp — Guide',
        version: pkg.version,
        description: 'User and administrator guide for the Webamp plugin',
        repository: pkg.repository
    }, null, 2))

    // npm shows this as the package page: what it is, and where Kwirth is
    writeFileSync(join(tmpDir, 'README.md'), [
        '# Webamp — Guide',
        '',
        'User and administrator guide of the **Webamp** channel plugin for [Kwirth](https://kwirthmagnify.dev),',
        'the Kubernetes observability and operations platform ([source](https://github.com/kwirthmagnify/kwirth)).',
        '',
        `Install it from Kwirth's docs manager, next to the plugin (\`${pkg.publisher}/kwirth-plugin-webamp\`):`,
        'both are listed in the jfvilas marketplace, `https://raw.githubusercontent.com/jfvilas/kwirth/master/manifest.json`.',
        'Kwirth then opens it from the help button of the channel.',
        '',
        'Source: https://github.com/jfvilas/kwirth (folder `plugins/webamp/docs/guide`).',
        ''
    ].join('\n'))

    await tarCreate({ gzip: true, file: outTgz, cwd: tmpDir }, ['.'])
    console.log(`webamp docs tgz: ${outTgz} (v${pkg.version})`)
}
finally {
    rmSync(tmpDir, { recursive: true, force: true })
}
