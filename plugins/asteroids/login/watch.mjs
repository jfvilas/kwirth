/**
 * Watch of the login extension: rebuilds dist/kwirth-login-asteroids.tgz when login.json,
 * package.json or background.png change.
 *
 * The plugin's watch launches it too, so that a single command rebuilds everything (front, back,
 * docs and login).
 */
import { existsSync } from 'fs'
import { watch } from 'fs'
import { spawn } from 'child_process'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))

const WATCHED = ['login.json', 'package.json', 'background.png']

/*
    One rebuild at a time and at most one queued: saving two files in a row, or an editor that writes
    in two steps, would trigger several `tar` processes at once on the same .tgz. The build packages
    to a temporary file and renames it, so even if they overlapped nothing would get corrupted, but
    there is no reason to do it.
*/
let building = false
let pending = false

const build = () => {
    if (building) { pending = true; return }
    building = true
    const child = spawn(process.execPath, ['build.mjs'], { cwd: __dir, stdio: 'inherit' })
    child.on('exit', (code) => {
        building = false
        if (code !== 0) console.error(`[watch:login] build failed (exit ${code})`)
        if (pending) { pending = false; build() }
    })
}

build()   // initial build

let timer
watch(__dir, (_event, filename) => {
    if (!filename || !WATCHED.includes(String(filename))) return
    clearTimeout(timer)
    timer = setTimeout(build, 250)
})

if (!existsSync(`${__dir}/background.png`)) {
    console.warn('[watch:login] there is no background.png — the login will have no background')
}

console.log('[watch:login] Watching login.json, package.json and background.png.')
