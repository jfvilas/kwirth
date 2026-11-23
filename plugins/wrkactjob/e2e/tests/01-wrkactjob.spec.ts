import { test, expect, Page } from '@playwright/test'
import {
    aid, clickCell, cluster, command, createFixture, deleteFixture, enter, geometry, listRow, NAMESPACE, oiaText, openWrkactjob, option,
    podsOf, reset, row, screenText, startChannel, stopChannel, terminal, waitUnlocked
} from './helpers'

/*
    E2E of WRKACTJOB, the PRD acceptance criteria against the running dev environment.

    ⛔ Non-destructive: it creates its own namespace (wrkactjob-e2e) — two healthy pods, one that keeps failing, a
    batch Job — and deletes it at the end. The only pod it ends is its own, and it always lists with
    WRKACTJOB SBS(wrkactjob-e2e), so nothing of the cluster beyond the fixture is read or shown — which also keeps
    the README captures free of anything real.

    One page for the whole run (serial + beforeAll): opening the SPA is the slow part.
*/
test.describe.configure({ mode: 'serial' })

const SHOTS = '../docs/screenshots'   // relative to plugins/wrkactjob/e2e (Playwright's cwd)

let page: Page

// The terminal block and its OIA, without the black margins the tab adds around it.
const shot = async (name: string): Promise<void> => {
    await page.waitForTimeout(300)
    await terminal(page).locator(':scope > div').screenshot({ path: `${SHOTS}/${name}.png` })
}

const lastRow = async (): Promise<string> => row(page, (await geometry(page)).rows - 1)

// The fixture's subsystem only.
const listFixture = (): Promise<void> => command(page, `wrkactjob sbs(${NAMESPACE})`)

test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000)
    createFixture()
    page = await browser.newPage()
    await openWrkactjob(page)
})

test.afterAll(async () => {
    await page?.goto('about:blank').catch(() => { })
    await page?.close()
    deleteFixture()
})

test('stopped, it says so; Start asks for the terminal, a 3179-2 in colour unless told otherwise', async () => {
    const notStarted = page.getByTestId('channel-not-started')
    await expect(notStarted).toContainText('WRKACTJOB not started')
    await notStarted.getByRole('button', { name: 'Start' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByRole('radio', { name: '3179-2 (24x80)' })).toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Colour' })).toBeChecked()
    for (const other of ['3477-FC (27x132)', 'Green monochrome (5251)']) await expect(dialog.getByRole('radio', { name: other })).not.toBeChecked()
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(terminal(page)).toBeVisible({ timeout: 20000 })
    await waitUnlocked(page)
})

test('the screen is a 5250: 24 rows of 80 columns plus the OIA, in the terminal font; it opens on WRKACTJOB', async () => {
    await expect.poll(() => page.evaluate(() => document.fonts.check('16px Kwirth3270')), { timeout: 20000 }).toBe(true)
    const rows = (await screenText(page)).split('\n')
    expect(rows).toHaveLength(24)
    for (const r of rows) expect(r).toHaveLength(80)
    expect(await oiaText(page)).toMatch(/^MA\s.*\d\d\/\d\d\d$/)
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
    expect(await row(page, 7)).toMatch(/Opt  Subsystem\/Job  User\s+Type\s+CPU %\s+Function\s+Status/)
})

test('WRKACTJOB SBS() shows the subsystem and its jobs, with their types; the failing one waits in MSGW', async () => {
    await listFixture()
    expect(await row(page, 8)).toMatch(/^ {6}WRKACTJOB-\s+SBS\s.*DEQW/)
    const demo = podsOf('demo')
    expect(demo).toHaveLength(2)
    for (const name of demo) expect(await listRow(page, name.slice(0, 10))).toBeGreaterThan(8)
    expect(await row(page, await listRow(page, 'batch-'))).toMatch(/BCH .*PGM-BUSYBOX/)
    expect(await row(page, await listRow(page, 'demo-'))).toMatch(/ASJ .*PGM-BUSYBOX/)
    // the failing pod goes to MSGW once Kubernetes reports it: refresh until it does
    await expect.poll(async () => {
        await aid(page, 'F5')
        return row(page, await listRow(page, 'broken-'))
    }, { timeout: 45000, intervals: [2000] }).toMatch(/MSGW\s*$/)
    // a system statistic, as on IBM i: every active job, not only the subsystem's
    const active = Number(/Active jobs:\s+(\d+)/.exec(await row(page, 2))?.[1])
    expect(active).toBeGreaterThanOrEqual(4)
    expect(await row(page, 18)).toMatch(/Bottom\s*$/)
    await shot('wrkactjob')
})

test('option 9 is not valid: the message on the error line, the keyboard locked until Reset', async () => {
    await option(page, await listRow(page, 'demo-'), '9')
    expect(await lastRow()).toMatch(/Option 9 not valid\./)
    expect(await oiaText(page)).toMatch(/X II/)
    await shot('error')
    await reset(page)
    expect(await oiaText(page)).not.toMatch(/X II/)
    await page.keyboard.press('Alt+End')
    await enter(page)
})

test('an option on the subsystem, and 7 on a job not in MSGW, are refused', async () => {
    await option(page, 8, '4')
    expect(await lastRow()).toMatch(/Option 4 not valid for a subsystem\./)
    await reset(page)
    await page.keyboard.press('Alt+End')
    await option(page, await listRow(page, 'demo-'), '7')
    expect(await lastRow()).toMatch(/No messages to display for job DEMO-/)
    await reset(page)
    await page.keyboard.press('Alt+End')
    await enter(page)
})

test('F11 shows the elapsed data, then the full names, then the status again', async () => {
    await aid(page, 'F11')
    expect(await row(page, 7)).toMatch(/Type\s+Pool\s+Pty\s+CPU\s+AuxIO/)
    await aid(page, 'F11')
    expect(await row(page, 7)).toMatch(/Namespace\s+Pod/)
    expect(await screenText(page)).toContain(podsOf('demo')[0])
    await shot('names')
    await aid(page, 'F11')
    expect(await row(page, 7)).toMatch(/User\s+Type\s+CPU %/)
})

test('7 on the failing job shows why it waits', async () => {
    await option(page, await listRow(page, 'broken-'), '7')
    expect(await row(page, 0)).toMatch(/Display Messages/)
    expect(await screenText(page)).toMatch(/Container worker: (CrashLoopBackOff|Error)/)
    await shot('message')
    await enter(page)
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
})

test('8 lists the containers as spooled files; 5 browses the log; Find and Bottom; F3 back', async () => {
    await option(page, await listRow(page, 'demo-'), '8')
    expect(await row(page, 0)).toMatch(/Work with Job Spooled Files/)
    expect(await row(page, 8)).toMatch(/PREPARE\s+1\s+RDY/)
    expect(await row(page, 9)).toMatch(/APP\s+2\s+OPN/)
    expect(await row(page, 10)).toMatch(/SIDECAR\s+3\s+OPN/)
    await shot('spooled-files')
    await option(page, 9, '5')
    expect(await row(page, 0)).toMatch(/Display Spooled File/)
    expect(await row(page, 1)).toMatch(/File\s+\. \. \. \. \. :\s+app/)
    expect(await row(page, 5)).toMatch(/wrkactjob-e2e tick 1\s*$/)
    await shot('dspsplf')
    await clickCell(page, 3, 21)
    await page.keyboard.type('tick 3')
    await enter(page)
    expect(await row(page, 5)).toMatch(/wrkactjob-e2e tick 3\s*$/)
    await clickCell(page, 2, 21)
    await page.keyboard.type('b')
    await enter(page)
    expect(await row(page, 21)).toMatch(/Bottom\s*$/)
    await aid(page, 'F3')
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
})

test('5 works with the job: status, definition and its job log', async () => {
    await option(page, await listRow(page, 'demo-'), '5')
    expect(await row(page, 0)).toMatch(/Work with Job/)
    expect(await row(page, 2)).toMatch(/Job:\s+DEMO-.*User:\s+DEFAULT\s+Number:\s+\d{6}/)
    await shot('wrkjob')
    await page.keyboard.type('1')
    await enter(page)
    expect(await screenText(page)).toMatch(/Subsystem\s+\. .* :\s+wrkactjob-e2e/)
    await aid(page, 'F12')
    await page.keyboard.type('2')
    await enter(page)
    expect(await screenText(page)).toMatch(/Started by\s+\. .* :\s+ReplicaSet demo-/)
    expect(await screenText(page)).toMatch(/app: busybox:1\.36/)
    await aid(page, 'F12')
    await page.keyboard.type('10')
    await enter(page)
    expect(await row(page, 0)).toMatch(/Display Job Log/)
    expect(await screenText(page)).toMatch(/Normal\s+(Scheduled|Pulled|Created|Started)/)
    await aid(page, 'F3')
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
})

test('4 opens the ENDJOB prompt; *IMMED ends the pod, and the ReplicaSet brings a new one', async () => {
    const [victim] = podsOf('demo')
    await option(page, await listRow(page, victim.slice(0, 10)), '4')
    expect(await row(page, 0)).toMatch(/End Job \(ENDJOB\)/)
    expect(await row(page, 4)).toContain(victim.toUpperCase())
    expect(await row(page, 5)).toMatch(/Subsystem\s+\. .* :\s+wrkactjob-e2e/)
    await shot('endjob')
    await clickCell(page, 6, 36)
    await page.keyboard.press('End')
    await page.keyboard.type('*immed')
    await enter(page)
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
    expect(await lastRow()).toMatch(/End of job \d{6}\/DEFAULT\/DEMO-.* requested\./)
    await expect.poll(() => cluster('-n', NAMESPACE, 'get', 'pods', '-l', 'app=demo', '-o', 'jsonpath={.items[*].metadata.name}').split(/\s+/).includes(victim),
        { timeout: 30000 }).toBe(false)
    await expect.poll(() => podsOf('demo').length, { timeout: 45000 }).toBe(2)
})

test('ENDJOB on the command line, with F4, prompts it with what was typed; F12 leaves it', async () => {
    const [pod] = podsOf('demo')
    await command(page, `endjob job(${pod}) delay(120)`, 'F4')
    expect(await row(page, 0)).toMatch(/End Job \(ENDJOB\)/)
    expect(await row(page, 4)).toContain(pod.toUpperCase())
    expect(await row(page, 6)).toMatch(/Controlled end delay time .*120/)
    await aid(page, 'F12')
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
    expect(podsOf('demo')).toContain(pod)
})

test('an unknown command is not found in *LIBL', async () => {
    await command(page, 'dspmsg qsysopr')
    expect(await lastRow()).toMatch(/Parameter QSYSOPR not valid for command DSPMSG\./)
    await reset(page)
    await command(page, 'dspmsg')
    expect(await lastRow()).toMatch(/Command DSPMSG in library \*LIBL not found\./)
    await reset(page)
    await page.keyboard.press('Alt+End')
})

test('F3 to the Main Menu; 90 signs off; Enter signs on again; 1 back to WRKACTJOB', async () => {
    await aid(page, 'F3')
    expect(await row(page, 0)).toMatch(/MAIN\s+IBM i Main Menu/)
    await shot('menu')
    await page.keyboard.type('90')
    await enter(page)
    expect(await screenText(page)).toMatch(/Your job has ended\./)
    await enter(page)
    expect(await row(page, 0)).toMatch(/IBM i Main Menu/)
    await page.keyboard.type('1')
    await enter(page)
    expect(await row(page, 0)).toMatch(/Work with Active Jobs/)
})

test('switching tabs and back keeps the session', async () => {
    await listFixture()
    await aid(page, 'F11')
    const before = await screenText(page)
    await page.locator('[data-testid="HomeIcon"]').first().click()
    await page.waitForTimeout(800)
    await page.getByText(/CLUSTER-\d+/).first().click()
    await expect(terminal(page)).toBeVisible()
    expect((await screenText(page)).split('\n')[7]).toBe(before.split('\n')[7])
    await aid(page, 'F11')
    await aid(page, 'F11')
})

test('a 3477-FC in green: 27 rows of 132, two greens, the elapsed data beside the status', async () => {
    await stopChannel(page)
    await startChannel(page, '3477-FC (27x132)', 'Green monochrome (5251)')
    expect(await geometry(page)).toEqual({ rows: 27, cols: 132 })
    await listFixture()
    expect(await row(page, 7)).toMatch(/Status\s+Pool\s+Pty\s+CPU\s+AuxIO/)
    const colours = await terminal(page).locator('[data-grid] span').evaluateAll(spans => [...new Set(spans.map(s => getComputedStyle(s).color))])
    // two phosphor greens on black (the cursor and reverse runs paint black on green)
    expect(colours.filter(c => c !== 'rgb(0, 0, 0)').length).toBeLessThanOrEqual(2)
    await shot('wide-green')
})
