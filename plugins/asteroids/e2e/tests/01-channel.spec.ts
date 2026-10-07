import { test, expect, Page } from '@playwright/test'
import { openAsteroids, startChannel, stopChannel, assertFrontCompiles } from './helpers'

/*
    E2E of the Asteroids channel.

    ⛔ NO test of this plugin may press SAVE on the high scores panel. Two reasons, and the second
    is the serious one:

    1. The table lives in a cluster ConfigMap and is shared by every user of this Kwirth.
    2. Saving a record TRIGGERS THE SENDER configured in the channel. If one is set -and the channel's
       default config is inherited by every new tab-, each run sends REAL notifications through
       Teams, mail or Jira to real people. It has already happened.

    The scoreboard contract (message, accessKey, sanitising, ordering, trimming, record notification)
    is covered entirely by the harness, which touches neither the cluster nor any sender. The
    scoreboard contract (message shape, accessKey, sanitising, ordering and trimming) is covered by the plugin harness,
    which does not touch the cluster. What is validated here is what the harness cannot see: the channel
    life cycle in the real UI and the canvas size.

    SHARED page per file (serial + beforeAll): the bottleneck is reloading the SPA and
    starting the channel, not Playwright.
*/

test.describe.configure({ mode: 'serial' })

let page: Page

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await openAsteroids(page)
})

test.afterAll(async () => {
    await page?.close()
})

// ── Channel stopped ───────────────────────────────────────────────────────

test('the front end compiles (no CRA overlay)', async () => {
    await assertFrontCompiles(page)
})

test('when stopped, it explains that it has to be started instead of leaving a black canvas', async () => {
    await expect(page.getByText('Asteroids not started')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Start the channel .* to play/i)).toBeVisible()
})

test('when stopped the game canvas is not painted', async () => {
    await expect(page.locator('canvas')).toHaveCount(0)
})

test('when stopped the topbar is NOT painted: a zeroed scoreboard tells nothing', async () => {
    await expect(page.getByText(/^Score \d+$/)).toHaveCount(0)
    await expect(page.getByText(/^Lives \d+$/)).toHaveCount(0)
    await expect(page.getByText(/^Level \d+$/)).toHaveCount(0)
    await expect(page.getByText(/^Best \d+$/)).toHaveCount(0)
})

test('the setup offers choosing a sender to notify the record, and by default it does not notify', async () => {
    /*
        The configuration dialog has no menu entry of its own: it opens when Start is pressed. It is
        cancelled, which closes it WITHOUT starting the channel, so as not to alter the rest of the run.
    */
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByText('Start', { exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByText(/Notify a sender when the record is beaten/i)).toBeVisible()
    /*
        Only the do-NOT-notify option is asserted: how many senders there are depends on the environment, and tying it
        to a specific list would turn this test into a detector of unrelated configuration changes.
    */
    await dialog.getByRole('combobox').nth(1).click()
    await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 5000 })
    await expect(page.getByRole('option', { name: 'Do not notify' })).toBeVisible()
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: /^CANCEL$/i }).click()
    await expect(dialog).toBeHidden()
})

// ── Channel started ───────────────────────────────────────────────────────

test('on start the canvas appears and the message disappears', async () => {
    await startChannel(page)
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(page.getByText('Asteroids not started')).toBeHidden()
})

test('on start the full topbar appears', async () => {
    await expect(page.getByText(/^Score \d+$/)).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/^Lives \d+$/)).toBeVisible()
    await expect(page.getByText(/^Level \d+$/)).toBeVisible()
    await expect(page.getByText(/^Best \d+$/)).toBeVisible()
})

test('a game starts with 3 lives', async () => {
    // End-to-end validation of LIVES=3: the harness pins the constant, this checks it reaches the HUD.
    await expect(page.getByText('Lives 3')).toBeVisible({ timeout: 15000 })
})

test('the level starts at 1 and the score at zero', async () => {
    await expect(page.getByText('Level 1')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Score 0')).toBeVisible()
})

test('the canvas fills the channel width, not a corner', async () => {
    const box = await page.locator('canvas').boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    // Before the size fix the canvas stayed at ~20% of the screen.
    expect(box!.width).toBeGreaterThan(viewport!.width * 0.5)
    expect(box!.height).toBeGreaterThan(200)
})

test('the canvas honours the configured aspect ratio (1.6 by default)', async () => {
    const box = await page.locator('canvas').boundingBox()
    const ratio = box!.width / box!.height
    expect(Math.abs(ratio - 1.6)).toBeLessThan(0.15)
})

test('the canvas fits inside the window: it does not overflow', async () => {
    const box = await page.locator('canvas').boundingBox()
    const viewport = page.viewportSize()
    expect(box!.width).toBeLessThanOrEqual(viewport!.width + 1)
    expect(box!.height).toBeLessThanOrEqual(viewport!.height + 1)
})

test('the canvas readjusts when the window is resized, keeping the ratio', async () => {
    const before = await page.locator('canvas').boundingBox()
    await page.setViewportSize({ width: 900, height: 700 })
    await page.waitForTimeout(800)
    const after = await page.locator('canvas').boundingBox()
    expect(after!.width).not.toBe(before!.width)
    const ratio = after!.width / after!.height
    expect(Math.abs(ratio - 1.6)).toBeLessThan(0.15)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.waitForTimeout(800)
})

test('at fullscreen the bar shows the plugin icon and name, and no third-party branding', async () => {
    // the IRIA Play logo the bar used to carry had this viewBox: it must not come back
    const IRIA_PLAY_VIEWBOX = '246 92 833 156'
    await page.locator('canvas').click()
    await page.keyboard.press('Control+Alt+F11')
    const bar = page.locator('header.MuiAppBar-root').filter({ has: page.getByRole('heading', { name: 'Asteroids' }) })
    await expect(bar).toBeVisible({ timeout: 5000 })
    await expect(bar.locator('svg path[d^="M9.19 6.35"]')).toHaveCount(1)
    await expect(page.locator(`svg[viewBox="${IRIA_PLAY_VIEWBOX}"]`)).toHaveCount(0)
    await page.keyboard.press('Control+Alt+F11')
    await expect(bar).toBeHidden({ timeout: 5000 })
})

// ── Back to stopped ───────────────────────────────────────────────────────

test('stopping the channel goes back to the message and removes canvas and topbar', async () => {
    await stopChannel(page)
    await expect(page.getByText('Asteroids not started')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('canvas')).toHaveCount(0)
    await expect(page.getByText(/^Score \d+$/)).toHaveCount(0)
})

test('the front end still compiles at the end of the run', async () => {
    await assertFrontCompiles(page)
})
