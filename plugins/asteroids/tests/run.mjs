// Test runner for the asteroids plugin.
//
// Bundles each tests/**/*.test.ts with esbuild (TS→ESM, externalising the kwirth packages) into
// tests/.out/ and runs them with the native `node --test` runner. No new test dependencies:
// node:test + node:assert/strict.
//
//   npm test              → the whole suite
//   COVERAGE=1 npm test   → with coverage (step 2 of CL9)
//
// The tests import directly from ../src, without duplicating code.

import esbuild from 'esbuild'
import { readdirSync, mkdirSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import path from 'path'

const TEST_DIR = 'tests'
const OUT_DIR = 'tests/.out'

const entries = readdirSync(TEST_DIR, { recursive: true })
    .map(String)
    .filter(f => f.endsWith('.test.ts'))
    .map(f => path.join(TEST_DIR, f))

if (entries.length === 0) {
    console.log('No tests (tests/**/*.test.ts).')
    process.exit(0)
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(OUT_DIR, { recursive: true })

await esbuild.build({
    entryPoints: entries,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    outdir: OUT_DIR,
    outbase: TEST_DIR,
    outExtension: { '.js': '.mjs' },
    sourcemap: process.env.COVERAGE ? 'inline' : false,   // COVERAGE=1 -> maps coverage onto src/
    external: ['express', '@kwirthmagnify/kwirth-common-back', '@kwirthmagnify/kwirth-common'],
    loader: { '.ts': 'ts' },
})

const bundled = readdirSync(OUT_DIR, { recursive: true }).map(String).filter(f => f.endsWith('.mjs')).map(f => path.join(OUT_DIR, f))

// Coverage: step 2 of the closing checklist (CL9). It measures the modules the harness LOADS, not all the code: the
// React components and the canvas are covered by the e2e and are not part of this measure.
const covArgs = process.env.COVERAGE
    ? ['--experimental-test-coverage', '--test-coverage-exclude=**/node_modules/**', '--test-coverage-exclude=**/tests/**']
    : []

try {
    execFileSync('node', ['--test', ...covArgs, ...bundled], { stdio: 'inherit' })
}
catch {
    process.exit(1)
}
