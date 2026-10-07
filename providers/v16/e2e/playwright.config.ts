import { defineConfig } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// Loads URL and credentials from a LOCAL file (.creds.json, gitignored), so they are neither passed on the
// command line nor committed. No file, defaults.
try {
    const c = JSON.parse(readFileSync(join(__dirname, '.creds.json'), 'utf-8'))
    const put = (k: string, v: unknown): void => { if (v !== undefined && v !== null && process.env[k] === undefined) process.env[k] = String(v) }
    put('V16_E2E_URL', c.url)
    put('V16_E2E_USER', c.user)
    put('V16_E2E_PASS', c.pass)
}
catch { /* no file → env/defaults */ }

export default defineConfig({
    testDir: './tests',
    timeout: 180_000,   // the front's dev server recompiles; the login alone can take ~1 min
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: process.env.V16_E2E_URL ?? 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'off',
        ignoreHTTPSErrors: true,
        actionTimeout: 15_000,
        viewport: { width: 1400, height: 900 }
    }
})
