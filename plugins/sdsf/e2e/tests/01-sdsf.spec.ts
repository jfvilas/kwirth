import { test, expect, Page } from '@playwright/test'
import {
    aid, clickCell, command, createFixture, CSR, deleteFixture, enter, fixturePods, geometry, lineCommand, NAMESPACE, oiaText, openSdsf,
    row, screenText, startChannel, stopChannel, terminal, waitUnlocked, cluster
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

test('stopped, it says so; Start asks for the terminal, a 3278-3 in colour unless told otherwise', async () => {
    const notStarted = page.getByTestId('channel-not-started')
    await expect(notStarted).toContainText('SDSF not started')
    await notStarted.getByRole('button', { name: 'Start' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await expect(dialog.getByRole('radio', { name: '3278-3 (32x80)' })).toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Colour (3279)' })).toBeChecked()
    for (const other of ['3278-2 (24x80)', '3278-5 (27x132)', 'Green phosphor (3278)']) await expect(dialog.getByRole('radio', { name: other })).not.toBeChecked()
    await expect(dialog.getByRole('checkbox', { name: 'Set as default' })).not.toBeChecked()
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(dialog).toBeHidden()
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

test('ST lists the fixture\'s Job and CronJob in JES terms; S on the Job browses its pod; O and H split them', async () => {
    // still DEST=sdsf-e2e; batch* leaves the Deployment's pods out
    await command(page, 'prefix batch*')
    await command(page, 'st')
    expect(await row(page, 2)).toMatch(/^ SDSF STATUS DISPLAY ALL CLASSES +LINE 1-2 \(2\)$/)
    expect(await row(page, 6)).toMatch(/^ {5}BATCH-JO JOB\d{5} DEFAULT +1 PRINT +J COMPLETE 1\/1/)
    expect(await row(page, 7)).toMatch(/^ {5}BATCH-CR JOB\d{5} DEFAULT +1 HOLD +C SUSPENDED/)
    await shot('st')
    await lineCommand(page, 6, 's')
    await enter(page)
    expect(await screenText(page)).toContain('sdsf-e2e job done')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/SDSF STATUS DISPLAY/)
    await command(page, 'o')
    expect(await row(page, 2)).toMatch(/^ SDSF OUTPUT ALL CLASSES ALL FORMS +LINE 1-1 \(1\)$/)
    await command(page, 'h')
    expect(await row(page, 2)).toMatch(/^ SDSF HELD OUTPUT DISPLAY ALL CLASSES +LINE 1-1 \(1\)$/)
    expect(await row(page, 6)).toMatch(/BATCH-CR/)
    await command(page, 'prefix demo*')
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
})

test('I: the input queue, the CronJob waiting for its time', async () => {
    await command(page, 'prefix later*')
    await command(page, 'i')
    expect(await row(page, 2)).toMatch(/^ SDSF INPUT QUEUE DISPLAY ALL CLASSES +LINE 1-1 \(1\)$/)
    expect(await row(page, 6)).toMatch(/^ {5}LATER-CR JOB\d{5} DEFAULT +1 INPUT +C SCHEDULED/)
    await command(page, 'prefix demo*')
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
})

test('DA parameters: the Job\'s ended pod only with ALL; OJOB, OSTC and a wrong one; bare DA back to the default', async () => {
    await command(page, 'prefix batch*')
    await command(page, 'da')
    expect(await screenText(page)).not.toMatch(/^ {5}BATCH-JO/m)
    await command(page, 'da all')
    expect(await row(page, 6)).toMatch(/^ {5}BATCH-JO WORK +JOB\d{5} DEFAULT +. END /)
    await command(page, 'da ojob')
    expect(await screenText(page)).not.toMatch(/^ {5}BATCH-JO/m)
    await command(page, 'prefix demo*')
    await command(page, 'da ostc')
    expect(await demoRows()).toHaveLength(2)
    await command(page, 'da ojob')
    expect(await demoRows()).toHaveLength(0)
    await command(page, 'da ojob oin')
    expect(await row(page, 2)).toMatch(/PARAMETER INVALID$/)
    // the command line still holds 'da ojob oin': a click one column off would leave its 'd' behind
    await clickCell(page, 3, 76)
    expect(await oiaText(page)).toMatch(/04\/077$/)
    await clickCell(page, 3, 20)
    expect(await oiaText(page)).toMatch(/04\/021$/)
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
})

test('INIT lists the nodes as initiators; D describes one; ? shows its pods; Z asks first and 2 leaves it alone', async () => {
    const nodes = cluster('get', 'nodes', '-o', 'jsonpath={.items[*].metadata.name}').split(/\s+/).filter(Boolean).sort()
    await command(page, 'prefix *')
    await command(page, 'init')
    expect(await row(page, 2)).toMatch(new RegExp(`^ SDSF INITIATOR DISPLAY  ALL CLASSES +LINE 1-${nodes.length} \\(${nodes.length}\\)$`))
    expect(await row(page, 5)).toMatch(/^ NP  ID +Status +Classes +Pods +CPU% +Real +CPUs +MemGB +Version/)
    // k3d-kwirth-agent-0 and k3d-kwirth-server-0: the IDs are what is left once what they share goes
    const ids = new Set<string>()
    for (let i = 0; i < nodes.length; i++) {
        const line = await row(page, 6 + i)
        expect(line).toMatch(/^ {5}\S+ +ACTIVE /)
        ids.add(line.slice(5, 13).trim())
    }
    expect(ids.size, 'one ID per node').toBe(nodes.length)
    await shot('init')
    await lineCommand(page, 6, 'd')
    await enter(page)
    expect(await screenText(page)).toMatch(new RegExp(`Name: +${nodes[0]}`))
    // past the labels and annotations of a k3d node: FIND it, as the operator would
    await command(page, "f 'Non-terminated Pods'")
    expect(await screenText(page)).toContain('Non-terminated Pods:')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/SDSF INITIATOR DISPLAY/)
    // the fixture's pods run on some node: ? on each until the DA of one shows them
    let found = false
    for (let i = 0; i < nodes.length && !found; i++) {
        await lineCommand(page, 6 + i, '?')
        await enter(page)
        expect(await row(page, 4)).toMatch(new RegExp(`NODE=${nodes[i]}`))
        found = (await screenText(page)).includes('NODE=') && (await demoRows()).length > 0
        await aid(page, 'F3')
        expect(await row(page, 2)).toMatch(/SDSF INITIATOR DISPLAY/)
    }
    expect(found, 'the DA of one of the nodes shows the fixture pods').toBe(true)
    await lineCommand(page, 6, 'z')
    await enter(page)
    expect(await screenText(page)).toMatch(/Confirm Action/)
    expect(await screenText(page)).toMatch(/Line number: 1 +\S+/)
    await page.keyboard.type('2')
    await enter(page)
    expect(await row(page, 2)).toMatch(/ACTION CANCELLED$/)
    expect(cluster('get', 'node', nodes[0], '-o', 'jsonpath={.spec.unschedulable}')).toBe('')
    await command(page, 'prefix demo*')
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
})

test('JC lists the PriorityClasses; the fixture\'s class has its two demo pods; ? shows them on the DA, PF3 back; D describes it', async () => {
    const classes = cluster('get', 'priorityclass', '-o', 'jsonpath={.items[*].metadata.name}').split(/\s+/).filter(Boolean)
    await command(page, 'prefix *')
    await command(page, 'jc')
    expect(await row(page, 2)).toMatch(new RegExp(`^ SDSF JOB CLASS DISPLAY ALL CLASSES +LINE 1-${classes.length} \\(${classes.length}\\)$`))
    expect(await row(page, 5)).toMatch(/^ NP  JobClass +Prio Default Preempt +Pods Age +ClassName/)
    // highest priority first: the system classes above the fixture's 100
    const text = await screenText(page)
    expect(text).toMatch(/^ {5}SYSTEM-N +2000001000 NO +LOWER /m)
    const mine = /^ {5}SDSF-E2E +100 NO +NEVER +2 .* sdsf-e2e-batch/m
    expect(text).toMatch(mine)
    const line = 6 + (await Promise.all(Array.from({ length: classes.length }, (_, i) => row(page, 6 + i)))).findIndex(r => mine.test(r))
    await shot('jc')
    await lineCommand(page, line, '?')
    await enter(page)
    expect(await row(page, 4)).toMatch(/CLASS=sdsf-e2e-batch/)
    expect(await demoRows()).toHaveLength(2)
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/SDSF JOB CLASS DISPLAY/)
    await lineCommand(page, line, 'd')
    await enter(page)
    const described = await screenText(page)
    expect(described).toMatch(/DESCRIBE SDSF-E2E JC/)
    expect(described).toMatch(/PreemptionPolicy: Never/)
    expect(described).toMatch(/Non-terminated Pods: +\(2 in total\)/)
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/SDSF JOB CLASS DISPLAY/)
})

test('SR lists the pending CSRs as system requests; the fixture\'s one is there; D describes it; no reply yet', async () => {
    await command(page, 'prefix sdsf-e2e*')
    await command(page, 'sr')
    expect(await row(page, 2)).toMatch(/^ SDSF SYSTEM REQUESTS DISPLAY ALL +LINE 1-1 \(1\)$/)
    expect(await row(page, 5)).toMatch(/^ NP  ReplyId  Type Age +Name +Requestor/)
    expect(await row(page, 6)).toMatch(/^ {5}\d{2} +CSR +\S+ +sdsf-e2e-request +\S/)
    await shot('sr')
    await aid(page, 'F11')
    expect(await row(page, 6)).toMatch(/example\.com\/sdsf-e2e +client auth/)
    await aid(page, 'F10')
    await lineCommand(page, 6, 'd')
    await enter(page)
    const described = await screenText(page)
    expect(described).toMatch(/DESCRIBE SDSF-E2E SR/)
    expect(described).toMatch(/Status: +Pending/)
    expect(described).toMatch(/BEGIN CERTIFICATE REQUEST/)
    await aid(page, 'F3')
    await lineCommand(page, 6, 'r')
    await enter(page)
    expect(await row(page, 2)).toMatch(/INVALID LINE COMMAND$/)
    expect(cluster('get', 'csr', CSR, '-o', 'jsonpath={.status.conditions}')).toBe('')
    await command(page, 'prefix demo*')
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
})

test('C asks first in the Confirm Action window, by line number and JOBNAME; 2 leaves the pod alone', async () => {
    const before = fixturePods()
    const [first] = await demoRows()
    await lineCommand(page, first, 'c')
    await enter(page)
    const text = await screenText(page)
    expect(text).toMatch(/Confirm Action/)
    expect(text).toMatch(/1 {2}1\. {2}Process action character/)
    expect(text).toMatch(/3\. {2}Process action character and/)
    expect(text).toMatch(new RegExp(`Line number: ${first - 5} +DEMO-`))
    expect(await row(page, first)).toMatch(/^ C /)
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
    // the selection comes with 1 already in it: Enter processes
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

test('ULOG: the actions of the session, the discarded ones too, newest at the bottom', async () => {
    await command(page, 'ulog')
    expect(await row(page, 2)).toMatch(/^ SDSF ULOG CONSOLE /)
    const text = await screenText(page)
    expect(text).toMatch(/Z {3}node \S+ +DISCARDED/)
    expect(text).toMatch(/C {3}sdsf-e2e\/demo-\S+ +DISCARDED/)
    expect(text).toMatch(/C {3}sdsf-e2e\/demo-\S+ +COMMAND ISSUED/)
    await shot('ulog')
    await aid(page, 'F3')
    expect(await row(page, 2)).toMatch(/^ SDSF DA /)
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

// ── The other terminals: a new session each, chosen in the setup ─────────────────────────────────────

// The grid inside the tab, whole: nothing cut on either side.
const assertGridFits = async (): Promise<void> => {
    const tab = await terminal(page).boundingBox()
    const grid = await terminal(page).locator('[data-grid]').boundingBox()
    expect(tab && grid).toBeTruthy()
    expect(grid!.x).toBeGreaterThanOrEqual(tab!.x)
    expect(grid!.x + grid!.width).toBeLessThanOrEqual(tab!.x + tab!.width + 0.5)
}

// The colour a cell is painted in, as the browser computed it.
const colourAt = async (r: number, text: string): Promise<string> =>
    terminal(page).locator('[data-grid] > div').nth(r).locator('span', { hasText: text }).first().evaluate(e => getComputedStyle(e).color)

test('3278-2 in green phosphor: 24 rows of 80, two greens, the DA with its rows', async () => {
    await stopChannel(page)
    await startChannel(page, '3278-2 (24x80)', 'Green phosphor (3278)')
    expect(await geometry(page)).toEqual({ rows: 24, cols: 80 })
    await assertGridFits()
    expect(await row(page, 2)).toMatch(/SDSF PRIMARY OPTION MENU/)
    expect(await row(page, 22)).toMatch(/F1=HELP/)
    expect(await colourAt(2, 'SDSF PRIMARY OPTION MENU')).toBe('rgb(125, 255, 138)')
    expect(await colourAt(5, 'Active pods')).toBe('rgb(47, 191, 63)')
    await command(page, 'prefix demo*')
    await command(page, `dest ${NAMESPACE}`)
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
    await shot('model2-green')
})

test('3278-5 in colour: 27 rows of 132, the DA shows CPU% and Status on its first page', async () => {
    await stopChannel(page)
    await startChannel(page, '3278-5 (27x132)', 'Colour (3279)')
    expect(await geometry(page)).toEqual({ rows: 27, cols: 132 })
    await assertGridFits()
    expect(await row(page, 3)).toMatch(/SCROLL ===> PAGE$/)
    await command(page, 'prefix demo*')
    await command(page, `dest ${NAMESPACE}`)
    await command(page, 'da')
    expect(await row(page, 2)).toMatch(/^ SDSF DA .* LINE 1-2 \(2\)$/)
    expect(await row(page, 5)).toMatch(/SIO +CPU% Status/)
    await clickCell(page, 3, 128)
    expect(await oiaText(page)).toMatch(/04\/129$/)
    await shot('model5')
})
