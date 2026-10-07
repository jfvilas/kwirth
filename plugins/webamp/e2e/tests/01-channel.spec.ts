import { test, expect } from '@playwright/test'
import { openWebamp, startChannel, stopChannel, assertFrontCompiles, webampFrame, toggleFullscreen } from './helpers'

// The music note the plugin uses as its icon (icons.tsx and the 'icon' of package.json)
const MUSIC_NOTE_PATH = 'M12 3v10.55'
// The viewBox of the IRIA Play logo the fullscreen bar used to carry: it must not come back
const IRIA_PLAY_VIEWBOX = '246 92 833 156'

test.describe('Webamp channel', () => {
    test('starts and shows the player', async ({ page }) => {
        await openWebamp(page)
        await assertFrontCompiles(page)

        // Before starting, the empty state is visible.
        await expect(page.getByText('Webamp not started')).toBeVisible()

        await startChannel(page)

        // After starting, the Webamp iframe should be present.
        const frame = webampFrame(page)
        // The help panel inside the iframe mentions dragging songs.
        await expect(frame.getByText('Drag here')).toBeVisible({ timeout: 10000 })

        await stopChannel(page)

        // After stopping, the empty state returns.
        await expect(page.getByText('Webamp not started')).toBeVisible()
    })

    test('at fullscreen, the bar shows the plugin icon and name, and no third-party branding', async ({ page }) => {
        await openWebamp(page)
        await startChannel(page)
        await expect(webampFrame(page).getByText('Drag here')).toBeVisible({ timeout: 10000 })

        // The focus is put INSIDE the player on purpose: the iframe keeps the keyboard, and the shortcut
        // only works because it hands Ctrl+Alt+F11 over to the page.
        await webampFrame(page).getByText('Drag here').click()
        await toggleFullscreen(page)
        const bar = page.locator('header.MuiAppBar-root').filter({ has: page.getByRole('heading', { name: 'Webamp' }) })
        await expect(bar).toBeVisible()
        await expect(bar.locator(`svg path[d^="${MUSIC_NOTE_PATH}"]`)).toHaveCount(1)
        await expect(page.locator(`svg[viewBox="${IRIA_PLAY_VIEWBOX}"]`)).toHaveCount(0)
        // the player keeps running inside it
        await expect(webampFrame(page).getByText('Drag here')).toBeVisible()

        // and getting out works the same way, with the focus still in the player
        await webampFrame(page).getByText('Drag here').click()
        await toggleFullscreen(page)
        await expect(bar).toBeHidden()
        await stopChannel(page)
    })
})
