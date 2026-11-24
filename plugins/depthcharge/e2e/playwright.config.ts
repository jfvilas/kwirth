import { defineConfig } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// URL and credentials come from a LOCAL file (.creds.json, gitignored): never on the command line, never committed.
try {
    const c = JSON.parse(readFileSync(join(__dirname, '.creds.json'), 'utf-8'))
    const put = (k: string, v: unknown): void => { if (v !== undefined && v !== null && process.env[k] === undefined) process.env[k] = String(v) }
    put('DEPTHCHARGE_E2E_URL', c.url)
    put('DEPTHCHARGE_E2E_USER', c.user)
    put('DEPTHCHARGE_E2E_PASS', c.pass)
    put('DEPTHCHARGE_E2E_CLUSTER', c.cluster)
}
catch { /* no file: env and defaults */ }

// Playwright against the running dev environment. The build never imports it.
export default defineConfig({
    testDir: './tests',
    timeout: 180_000,   // the front's dev server recompiles and the login alone can take ~1 min
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [['list']],
    use: {
        baseURL: process.env.DEPTHCHARGE_E2E_URL ?? 'http://localhost:3000',
        headless: true,
        screenshot: 'off',
        trace: 'off',
        video: 'off',
        ignoreHTTPSErrors: true,
        actionTimeout: 15_000,
        viewport: { width: 1400, height: 900 }
    }
})
