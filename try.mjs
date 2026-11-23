// Builds the hand-check page of the 5250 glass (try/page.tsx) into try/out/ and prints how to open it.
//
//   npm run build && npm run try        then open try/out/index.html (?mono=1, ?wide=1)
//
// The page loads the BUILT dist/front.js, the very file Kwirth loads; React and react-dom are bundled into the
// page itself, as Kwirth would provide them.
import esbuild from 'esbuild'
import fs from 'fs'
import path from 'path'

const OUT = path.join('try', 'out')
fs.mkdirSync(OUT, { recursive: true })

await esbuild.build({
    entryPoints: ['try/page.tsx'],
    bundle: true,
    format: 'iife',
    outfile: path.join(OUT, 'page.js'),
    loader: { '.ts': 'ts', '.tsx': 'tsx' },
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    define: { 'process.env.NODE_ENV': '"production"' },
    target: 'es2020',
})

fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>blockterm — 5250 try</title>
<style>html, body { margin: 0; background: #000; } #root { width: 100vw; }</style>
</head>
<body>
<div id="root"></div>
<script src="page.js"></script>
</body>
</html>
`)

if (!fs.existsSync(path.join('dist', 'front.js'))) console.log('⚠️  dist/front.js missing: run npm run build first')
console.log(`Open file://${path.resolve(OUT, 'index.html')}  (?mono=1 green screen, ?wide=1 27x132)`)
