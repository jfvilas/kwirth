import { test, expect, Page } from '@playwright/test'
import { openAsteroids, startChannel } from './helpers'

/*
    Image capture for the guide (docs/guide/images/*.png). It runs against the live dev environment.
    It is NOT an assertion test: it navigates the app and takes screenshots of specific views.

    It is named zz- so that it runs last: it leaves the channel started and plays a game to the end,
    so other specs had better not inherit that state.

    trace/screenshot/video 'off' and a goto('about:blank') at the end: the SPA leaves a WebSocket
    open and, with the trace on, the teardown hangs.
*/
test.use({ trace: 'off', screenshot: 'off', video: 'off', viewport: { width: 1400, height: 900 } })

const IMG = '../docs/guide/images'   // relative to plugins/asteroids/e2e (playwright cwd)

/** Margin so that the MUI animations finish before taking the shot. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(900)

test('capture: asteroids guide images', async ({ page }) => {
    // DARK theme (like the guide): the core reads localStorage 'kwirth.mode' at startup.
    await page.addInitScript(() => { try { localStorage.setItem('kwirth.mode', 'dark') } catch { /* noop */ } })

    await openAsteroids(page)

    // 1. Channel stopped: the message explaining that it has to be started, and NO topbar.
    await expect(page.getByText('Asteroids not started')).toBeVisible({ timeout: 20000 })
    await settle(page)
    await page.screenshot({ path: `${IMG}/channel-stopped.png` })

    // 2. Configuration dialog: it opens when Start is pressed.
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByText('Start', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await settle(page)
    await dialog.screenshot({ path: `${IMG}/setup-dialog.png` })

    // Confirm to really start it.
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await page.waitForTimeout(2500)
    await expect(page.locator('canvas')).toHaveCount(1)

    // 3. Game running: canvas + chips topbar.
    await page.locator('canvas').click()
    /*
        Enter HELD DOWN, not press(): press() does down+up in about 10ms and the game reads the input once
        per frame (~16ms), so the keypress falls between two frames and the game stays at
        READY. It is the same reason why hyperspace is also held down further below.
    */
    await page.keyboard.down('Enter')
    await page.waitForTimeout(150)
    await page.keyboard.up('Enter')
    await page.waitForTimeout(2500)   // let asteroids come onto the screen
    await page.screenshot({ path: `${IMG}/game-running.png` })

    /*
        4. High scores table. All three lives have to be lost, and leaving the ship still does not work: it can
        survive whole minutes if the asteroids do not pass over it. The crash is forced by
        thrusting non-stop (the ship crosses the field) and jumping into hyperspace every second, which
        reappears at a RANDOM point and often on top of a rock. It is polled in a loop because how long
        it takes depends on the game.
    */
    const panel = page.getByText('High scores')
    await page.keyboard.down('ArrowUp')                       // continuous thrust
    const deadline = Date.now() + 150000
    while (Date.now() < deadline) {
        if (await panel.isVisible().catch(() => false)) break
        /*
            The jump is HELD down, not typed with press(): press() does down+up in about 10ms
            and the game reads the input once per frame (~16ms), so the keypress can fall
            entirely between two frames and get lost. With 120ms it is surely seen.
        */
        await page.keyboard.down('ShiftLeft')                 // hyperspace
        await page.waitForTimeout(120)
        await page.keyboard.up('ShiftLeft')
        await page.waitForTimeout(600)                        // > HYPERSPACE_COOLDOWN (0,5s)
    }
    await page.keyboard.up('ArrowUp')
    await expect(panel).toBeVisible({ timeout: 30000 })
    await settle(page)
    await page.screenshot({ path: `${IMG}/high-scores.png` })

    await page.goto('about:blank')
})
