import { test, expect, Page } from '@playwright/test'
import { openPacman, startChannel, stopChannel, assertFrontCompiles, pacmanFrame, tabMenu, toggleFullscreen } from './helpers'

/*
    E2E of the Pac-Man channel.

    ⛔ NO test here may press SAVE in the high-score panel: saving writes the cluster's table and, with a
    sender in the setup, sends REAL notifications to REAL people. The score contract is covered by the
    harness; here the setup is always left on "Do not notify".

    Shared page per file (serial + beforeAll).
*/

test.describe.configure({ mode: 'serial' })
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

// The plugin's own icon (icons.tsx and the 'icon' of package.json)
const PACMAN_PATH = 'M20.32 8.56'
// The viewBox of the IRIA Play logo the fullscreen bar used to carry: it must not come back
const IRIA_PLAY_VIEWBOX = '246 92 833 156'

let page: Page

test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await openPacman(page)
})

test.afterAll(async () => {
    await page?.goto('about:blank').catch(() => { })
    await page?.context().close().catch(() => { })
})

test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page) {
        await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
    }
})

const chip = (text: RegExp) => page.locator('.MuiChip-root').filter({ hasText: text })
const game = () => pacmanFrame(page).locator('canvas#canvas')

// ── Channel stopped ───────────────────────────────────────────────────────

test('the front compiles (no CRA overlay)', async () => {
    await assertFrontCompiles(page)
})

test('stopped, it explains that it must be started, with no game and no HUD', async () => {
    await expect(page.getByText('Pac-Man not started')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(/Start the channel .* to play/i)).toBeVisible()
    await expect(page.locator('iframe[title="Pac-Man"]')).toHaveCount(0)
    await expect(chip(/^Score \d+$/)).toHaveCount(0)
})

// ── Channel started ───────────────────────────────────────────────────────

test('starting shows the game and the whole HUD', async () => {
    await startChannel(page)
    await expect(page.locator('iframe[title="Pac-Man"]')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText('Pac-Man not started')).toBeHidden()
    await expect(chip(/^Score \d+$/)).toBeVisible()
    await expect(chip(/^Lives /)).toBeVisible()
    await expect(chip(/^Level \d+$/)).toBeVisible()
    await expect(chip(/^Best \d+$/)).toBeVisible()
    await expect(game()).toBeVisible({ timeout: 15000 })
})

test('the iframe keeps the arcade 224:288 aspect ratio and fits the window', async () => {
    const box = await page.locator('iframe[title="Pac-Man"]').boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(Math.abs(box!.width / box!.height - 224 / 288)).toBeLessThan(0.02)
    expect(box!.height).toBeLessThanOrEqual(viewport!.height + 1)
})

test('playing a game reaches the HUD: the bridge reports the lives', async () => {
    await expect(chip(/^Lives 0$/)).toBeVisible()
    await game().click()
    // CHOOSE A GAME → PAC-MAN, then PLAY
    for (const key of ['ArrowDown', 'Enter', 'ArrowDown', 'Enter']) {
        await game().press(key)
        await page.waitForTimeout(700)
    }
    await expect(chip(/^Lives [1-9]$/)).toBeVisible({ timeout: 15000 })
})

test('pausing from the menu shows it, and resuming takes it away', async () => {
    await tabMenu(page, 'Pause')
    await expect(chip(/^paused$/)).toBeVisible({ timeout: 5000 })
    await tabMenu(page, 'Resume')
    await expect(chip(/^paused$/)).toBeHidden({ timeout: 5000 })
})

test('leaving the game pauses it by itself, and clicking it again resumes it', async () => {
    await game().click()
    await expect(chip(/^paused$/)).toBeHidden()
    // the focus goes to the page, outside the game and outside its tab
    await page.locator('header').first().click({ position: { x: 600, y: 10 } })
    await expect(chip(/^paused$/)).toBeVisible({ timeout: 5000 })
    await game().click()
    await expect(chip(/^paused$/)).toBeHidden({ timeout: 5000 })
})

test('fullscreen works with the focus inside the game, with the plugin icon and no third-party branding', async () => {
    await game().click()
    await toggleFullscreen(page)
    const bar = page.locator('header.MuiAppBar-root').filter({ has: page.getByRole('heading', { name: 'Pac-Man' }) })
    await expect(bar).toBeVisible()
    await expect(bar.locator(`svg path[d^="${PACMAN_PATH}"]`)).toHaveCount(1)
    await expect(page.locator(`svg[viewBox="${IRIA_PLAY_VIEWBOX}"]`)).toHaveCount(0)
    await game().click()
    await toggleFullscreen(page)
    await expect(bar).toBeHidden()
})

// ── Back to stopped ───────────────────────────────────────────────────────

test('stopping the channel returns to the message and removes the iframe', async () => {
    await stopChannel(page)
    await expect(page.getByText('Pac-Man not started')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('iframe[title="Pac-Man"]')).toHaveCount(0)
    await expect(chip(/^Score \d+$/)).toHaveCount(0)
})

test('the front still compiles at the end of the run', async () => {
    await assertFrontCompiles(page)
})
