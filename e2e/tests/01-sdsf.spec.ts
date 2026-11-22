import { test, expect, Page } from '@playwright/test'
import {
    aid, clickCell, command, createFixture, deleteFixture, enter, fixturePods, lineCommand, NAMESPACE, oiaText, openSdsf,
    row, screenText, terminal, waitUnlocked
} from './helpers'

/*
    E2E of SDSF, the PRD acceptance criteria against the running dev environment.

    ⛔ Non-destructive: it creates its own namespace (sdsf-e2e) with a Deployment of two pods and deletes it at the
    end. The only pods it cancels are its own, and it lists with PREFIX and DEST so nothing of the cluster beyond
    them is read or shown — which also keeps the README captures free of anything real.

    One page for the whole run (serial + beforeAll): opening the SPA is the slow part.

    The README captures (docs/screenshots/*.png) are taken along the way, of the terminal only.
*/
test.describe.configure({ mode: 'serial' })

const SHOTS = '../docs/screenshots'   // relative to plugins/sdsf/e2e (Playwright's cwd)

let page: Page

// The 32x80 block and its OIA, without the black margins the tab adds around it.
const shot = async (name: string): Promise<void> => {
    await page.waitForTimeout(300)
    await terminal(page).locator(':scope > div').screenshot({ path: `${SHOTS}/${name}.png` })
}

// The rows of the DA that list the fixture's pods (JOBNAME starts with DEMO-).
const demoRows = async (): Promise<number[]> => {
    const rows: number[] = []
    for (let r = 6; r < 30; r++) if (/^ {5}DEMO-/.test(await row(page, r))) rows.push(r)
    return rows
}

test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000)
    createFixture()
    page = await browser.newPage()
    await openSdsf(page)
})

test.afterAll(async () => {
    await page?.goto('about:blank').catch(() => { })
    await page?.close()
    deleteFixture()
})

test('stopped, it says so and offers to start it', async () => {
    const notStarted = page.getByTestId('channel-not-started')
    await expect(notStarted).toContainText('SDSF not started')
    await notStarted.getByRole('button', { name: 'Start' }).click()
    await expect(terminal(page)).toBeVisible({ timeout: 20000 })
})

test('the screen is a 3278-3: 32 rows of 80 columns plus the OIA, in the 3270 font', async () => {
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px Kwirth3270')), { timeout: 20000 }).toBe(true)
    const rows = (await screenText(page)).split('\n')
    expect(rows).toHaveLength(32)
    for (const r of rows) expect(r).toHaveLength(80)
    expect(await oiaText(page)).toMatch(/^4A\s.*\d\d\/\d\d\d$/)
})

test('it opens on the primary option menu, cursor on the command line', async () => {
    expect(await row(page, 2)).toMatch(/SDSF PRIMARY OPTION MENU/)
    expect(await row(page, 5)).toMatch(/^ DA {4}Active pods/)
    expect(await oiaText(page)).toMatch(/04\/021$/)
    await shot('menu')
})

test('the keyboard stays in the tab: F5 is PF5, not a reload', async () => {
    await terminal(page).focus()
    await page.keyboard.press('F5')
    await waitUnlocked(page)
    await expect(terminal(page)).toBeVisible()
    expect(await row(page, 2)).toMatch(/SDSF PRIMARY OPTION MENU/)
})

test('DA with PREFIX and DEST lists exactly the fixture pods', async () => {
    await command(page, 'prefix demo*')
    await command(page, `dest ${NAMESPACE}`)
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
    expect(await row(page, 4)).toMatch(/PREFIX=DEMO\*  DEST=sdsf-e2e/)
    expect(await row(page, 5)).toMatch(/^ NP  JOBNAME  StepName ProcStep JobID +Owner +C Pos DP  Real Paging +SIO/)
    const rows = await demoRows()
    expect(rows).toHaveLength(2)
    for (const r of rows) expect(await row(page, r)).toMatch(/DEMO-.* APP +STC\d{5} DEFAULT +B IN /)
    /*
        For the capture, the metrics provider's figures rather than its '-': CPU% needs two readings, which can
        take a couple of its intervals on fresh pods. Not an assertion — a cluster without the provider is valid.
    */
    for (let i = 0; i < 12 && /CPU\/L\/Z +-/.test(await row(page, 2)); i++) {
        await page.waitForTimeout(5000)
        await enter(page)
    }
    await shot('da')
})

test('Intro is Newline: from the command line to the NP of the first row, sending nothing', async () => {
    await clickCell(page, 3, 20)
    await page.keyboard.press('Enter')
    expect(await oiaText(page)).toMatch(/07\/002$/)
    expect(await oiaText(page)).not.toContain('X SYSTEM')
})

test('PF11 shows the full pod name and the namespace', async () => {
    await aid(page, 'F11')
    await aid(page, 'F11')
    const pods = fixturePods()
    const text = await screenText(page)
    for (const p of pods) expect(text).toContain(p)
    expect(text).toContain(NAMESPACE)
    await aid(page, 'F10')
    await aid(page, 'F10')
    expect(await row(page, 5)).toMatch(/JOBNAME  StepName/)
})

test('S browses the log of the main container; FIND finds in it; PF3 comes back', async () => {
    const [first] = await demoRows()
    await lineCommand(page, first, 's')
    await enter(page)
    expect(await row(page, 2)).toMatch(/^ SDSF OUTPUT DISPLAY DEMO-.* DSID   101/)
    expect(await row(page, 4)).toMatch(/TOP OF DATA/)
    expect(await screenText(page)).toMatch(/sdsf-e2e tick \d+/)
    await command(page, 'f tick')
    expect(await row(page, 2)).toMatch(/CHARS 'tick' FOUND/)
    await command(page, 'top')
    await shot('browse')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/^ SDSF DA /)
})

test('? lists the containers as data sets; S on the sidecar browses its log', async () => {
    const [first] = await demoRows()
    await lineCommand(page, first, '?')
    await enter(page)
    expect(await row(page, 2)).toMatch(/SDSF JOB DATA SET DISPLAY - JOB DEMO-/)
    expect(await row(page, 5)).toMatch(/PREPARE +INIT +PREPARE +2 /)
    expect(await row(page, 6)).toMatch(/APP +APP +101 /)
    expect(await row(page, 7)).toMatch(/SIDECAR +APP +102 /)
    await shot('containers')
    await lineCommand(page, 7, 's')
    await enter(page)
    expect(await screenText(page)).toContain('sidecar alive')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/JOB DATA SET DISPLAY/)
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/^ SDSF DA /)
})

test('D browses the pod described, with its events', async () => {
    const [first] = await demoRows()
    await lineCommand(page, first, 'd')
    await enter(page)
    expect(await row(page, 2)).toMatch(/^ SDSF DESCRIBE DEMO-/)
    const text = await screenText(page)
    expect(text).toMatch(new RegExp(`Namespace: +${NAMESPACE}`))
    expect(text).toMatch(/Controlled By: +ReplicaSet\/demo-/)
    await aid(page, 'F3')
})

test('LOG shows the fixture\'s events as the SYSLOG, newest at the bottom; PF3 back to DA', async () => {
    // DEST is still sdsf-e2e: only the fixture's events
    await command(page, 'log')
    expect(await row(page, 2)).toMatch(/^ SDSF SYSLOG .* SDSF-E2E  LINE \d+/)
    const text = await screenText(page)
    expect(text).toMatch(/^ N \S+ +\d{5} \d\d:\d\d:\d\d\.\d\d STC\d{5} \d{8}  \w+ pod\/sdsf-e2e\/demo-/m)
    expect(text).toMatch(/BOTTOM OF DATA/)
    expect(text).not.toMatch(/pod\/(?!sdsf-e2e)/)
    await shot('syslog')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/^ SDSF DA /)
})

test('C asks first: 2 leaves the pod alone', async () => {
    const before = fixturePods()
    const [first] = await demoRows()
    await lineCommand(page, first, 'c')
    await enter(page)
    expect(await screenText(page)).toMatch(/Confirm Action/)
    await shot('confirm')
    await page.keyboard.type('2')
    await enter(page)
    expect(await row(page, 2)).toMatch(/ACTION CANCELLED$/)
    expect(fixturePods().sort()).toEqual(before.sort())
})

test('C with 1 cancels the pod: COMMAND ISSUED, and the ReplicaSet brings a new one', async () => {
    const [first] = await demoRows()
    const jobLine = await row(page, first)
    const before = fixturePods()
    await lineCommand(page, first, 'c')
    await enter(page)
    await page.keyboard.type('1')
    await enter(page)
    expect(await row(page, 2)).toMatch(/COMMAND ISSUED$/)
    // the ReplicaSet replaces it: two running pods again, one of them new
    await expect.poll(() => {
        const now = fixturePods()
        return now.length === 2 && now.some(p => !before.includes(p))
    }, { timeout: 60000 }).toBe(true)
    await expect.poll(async () => { await enter(page); return (await demoRows()).length }, { timeout: 60000 }).toBe(2)
    expect(jobLine).toBeTruthy()
})

test('full screen: the terminal takes the whole window, and the OIA follows the cursor', async () => {
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(800)
    const box = await terminal(page).boundingBox()
    const viewport = page.viewportSize()!
    expect(box?.width).toBe(viewport.width)
    expect(box?.height).toBe(viewport.height)
    await clickCell(page, 10, 30)
    expect(await oiaText(page)).toMatch(/11\/031$/)
    await page.keyboard.press('ArrowRight')
    expect(await oiaText(page)).toMatch(/11\/032$/)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/fullscreen.png` })
    await page.keyboard.press('Control+Shift+Enter')
    await page.waitForTimeout(800)
})

test('PF3 back to the menu, END to TSO READY, SDSF back in', async () => {
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/SDSF PRIMARY OPTION MENU/)
    await command(page, 'end')
    expect((await row(page, 0)).trim()).toBe('READY')
    await page.keyboard.type('sdsf')
    await enter(page)
    expect(await row(page, 2)).toMatch(/SDSF PRIMARY OPTION MENU/)
})
