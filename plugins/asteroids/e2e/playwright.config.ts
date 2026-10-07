import { defineConfig } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'

// Carga URL/credenciales de un fichero LOCAL (.creds.json, gitignorado) para no pasarlas por linea de
// comandos (asi el comando es estable y allowlistable) ni commitearlas. Si no existe, env/defaults.
try {
    const c = JSON.parse(readFileSync(join(__dirname, '.creds.json'), 'utf-8'))
    // Solo se asignan valores DEFINIDOS: `process.env.X = undefined` se convierte en la cadena
    // "undefined" y romperia los `?? 'inCluster'` de los helpers cuando falta una clave.
    const put = (k: string, v: unknown): void => { if (v !== undefined && v !== null && process.env[k] === undefined) process.env[k] = String(v) }
    put('ASTEROIDS_E2E_URL', c.url)
    put('ASTEROIDS_E2E_USER', c.user)
    put('ASTEROIDS_E2E_PASS', c.pass)
    put('ASTEROIDS_E2E_CLUSTER', c.cluster)
}
catch { /* sin fichero → env/defaults */ }

// E2E AISLADO del plugin Asteroids. Maneja la app ya levantada por HTTP; el build no lo importa nunca.
export default defineConfig({
    testDir: './tests',
    timeout: 180_000,   // el dev server recompila y el login puede tardar ~1 min; con 90s hay rojos falsos
    fullyParallel: false,
    workers: 1,
    retries: 1,         // dev en vivo: el login puede fallar de forma transitoria
    reporter: [['list']],
    use: {
        baseURL: process.env.ASTEROIDS_E2E_URL ?? 'http://localhost:3000',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        ignoreHTTPSErrors: true,
        actionTimeout: 15_000,
        viewport: { width: 1280, height: 900 }
    }
})
