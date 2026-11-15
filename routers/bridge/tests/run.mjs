// Unit test runner: bundles each tests/*.test.ts with esbuild (TS → ESM, packages left external) into
// tests/.out/ and runs them with node's own test runner. No test framework to install.
import esbuild from 'esbuild'
import { readdirSync, rmSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'

const OUT = 'tests/.out'
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true })
const entries = readdirSync('tests').filter(f => f.endsWith('.test.ts')).map(f => path.join('tests', f))
await esbuild.build({
    entryPoints: entries,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outdir: OUT,
    outExtension: { '.js': '.mjs' },
    packages: 'external',
    define: { __BRIDGE_VERSION__: '"test"' },
    loader: { '.ts': 'ts' },
})
const files = readdirSync(OUT).filter(f => f.endsWith('.test.mjs')).map(f => path.join(OUT, f))
execFileSync(process.execPath, ['--test', '--test-concurrency=1', ...files], { stdio: 'inherit' })
