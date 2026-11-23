import { Page, Locator, expect } from '@playwright/test'
import { execFileSync } from 'child_process'

export const USER = process.env.WRK_E2E_USER ?? 'admin'
export const PASS = process.env.WRK_E2E_PASS ?? ''
export const CLUSTER = process.env.WRK_E2E_CLUSTER ?? 'inCluster'
export const CHANNEL = 'wrkactjob'

// The namespace this e2e owns: created at the start, deleted at the end. Nothing else in the cluster is touched.
export const NAMESPACE = 'wrkactjob-e2e'

const FIXTURE = `
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
---
# Two healthy jobs (ASJ): an init container that ends, a container that writes a tick every 2 s and a sidecar.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo
  namespace: ${NAMESPACE}
spec:
  replicas: 2
  selector:
    matchLabels: { app: demo }
  template:
    metadata:
      labels: { app: demo }
    spec:
      terminationGracePeriodSeconds: 2
      initContainers:
        - name: prepare
          image: busybox:1.36
          command: ['sh', '-c', 'echo prepared']
      containers:
        - name: app
          image: busybox:1.36
          command: ['sh', '-c', 'i=0; while true; do i=$((i+1)); echo "wrkactjob-e2e tick $i"; sleep 2; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
        - name: sidecar
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do echo "sidecar alive"; sleep 5; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
---
# A job that keeps failing: MSGW, and 7 tells why.
apiVersion: apps/v1
kind: Deployment
metadata:
  name: broken
  namespace: ${NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels: { app: broken }
  template:
    metadata:
      labels: { app: broken }
    spec:
      terminationGracePeriodSeconds: 1
      containers:
        - name: worker
          image: busybox:1.36
          command: ['sh', '-c', 'echo "wrkactjob-e2e cannot start"; exit 1']
---
# A batch job (BCH) that stays active for the length of the run.
apiVersion: batch/v1
kind: Job
metadata:
  name: batch
  namespace: ${NAMESPACE}
spec:
  backoffLimit: 0
  activeDeadlineSeconds: 900
  template:
    spec:
      restartPolicy: Never
      terminationGracePeriodSeconds: 1
      containers:
        - name: work
          image: busybox:1.36
          command: ['sh', '-c', 'echo "wrkactjob-e2e batch started"; sleep 900']
`

const kubectl = (args: string[], input?: string): string =>
    execFileSync('kubectl', args, { input, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })

// A read of the cluster, to check what WRKACTJOB shows against it (never to change anything).
export const cluster = (...args: string[]): string => kubectl(args)

export const createFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=true', '--timeout=60s'])
    kubectl(['apply', '-f', '-'], FIXTURE)
    kubectl(['-n', NAMESPACE, 'rollout', 'status', 'deployment/demo', '--timeout=90s'])
    kubectl(['-n', NAMESPACE, 'wait', '--for=condition=Ready', 'pod', '-l', 'job-name=batch', '--timeout=90s'])
}

export const deleteFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=false'])
}

// The fixture's pods with a label, running, by name.
export const podsOf = (app: string): string[] =>
    kubectl(['-n', NAMESPACE, 'get', 'pods', '-l', `app=${app}`, '--field-selector=status.phase=Running', '-o', 'jsonpath={.items[*].metadata.name}'])
        .split(/\s+/).filter(Boolean)

export async function login(page: Page): Promise<void> {
    await page.goto('/')
    const userField = page.getByLabel('User')
    const combo = page.getByRole('combobox').first()
    await Promise.race([
        userField.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { }),
        combo.waitFor({ state: 'visible', timeout: 90000 }).catch(() => { })
    ])
    if (await userField.isVisible().catch(() => false)) {
        await userField.fill(USER)
        await page.getByLabel('Password').fill(PASS)
        await page.getByRole('button', { name: 'OK' }).click()
    }
    await expect(combo).toBeVisible({ timeout: 60000 })
    // the plugins' front bundles load after the login: wait for this one before looking for it in the list
    await page.waitForFunction((id) => Boolean((window as unknown as { __kwirth_plugins__?: Record<string, unknown> }).__kwirth_plugins__?.[id]), CHANNEL, { timeout: 60000 })
    await page.waitForTimeout(1000)
}

async function pickCombo(page: Page, index: number, option: string): Promise<void> {
    await page.getByRole('combobox').nth(index).click()
    await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('option', { name: option, exact: true }).click()
    await page.waitForTimeout(600)
}

/** Cluster → View=cluster → channel wrkactjob → ADD. Left added and NOT started. */
export async function openWrkactjob(page: Page): Promise<void> {
    await login(page)
    await pickCombo(page, 0, CLUSTER)
    await pickCombo(page, 1, 'cluster')
    const count = await page.getByRole('combobox').count()
    await page.getByRole('combobox').nth(count - 1).click()
    await page.getByRole('listbox').waitFor({ state: 'visible', timeout: 5000 })
    await page.getByRole('option').filter({ hasText: new RegExp(`^${CHANNEL}$`) }).first().click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: 'ADD' }).click()
    await page.waitForTimeout(1500)
}

// ── The terminal ───────────────────────────────────────────────────────────────────────────────────

export const terminal = (page: Page): Locator => page.getByTestId('wrkactjob-terminal')
const grid = (page: Page): Locator => terminal(page).locator('[data-grid]')
// the OIA is the last line under the grid
const oia = (page: Page): Locator => grid(page).locator('xpath=../div[last()]')

export const row = async (page: Page, r: number): Promise<string> =>
    (await grid(page).locator(':scope > div').nth(r).textContent()) ?? ''

export const screenText = async (page: Page): Promise<string> =>
    (await grid(page).locator(':scope > div').allTextContents()).join('\n')

export const oiaText = async (page: Page): Promise<string> => (await oia(page).textContent()) ?? ''

// Block mode: after an AID the keyboard stays in X SYSTEM until the answer is painted.
export async function waitUnlocked(page: Page): Promise<void> {
    await expect.poll(() => oiaText(page), { timeout: 30000 }).not.toContain('X SYSTEM')
    await page.waitForTimeout(150)
}

// An AID key, then wait for the answer.
export async function aid(page: Page, key: string): Promise<void> {
    await page.keyboard.press(key)
    await waitUnlocked(page)
}

// Right Ctrl, pressed alone, is Enter (on release).
export async function enter(page: Page): Promise<void> {
    await page.keyboard.down('ControlRight')
    await page.keyboard.up('ControlRight')
    await waitUnlocked(page)
}

// Left Ctrl, pressed alone, is Reset: it frees the keyboard after an error.
export async function reset(page: Page): Promise<void> {
    await page.keyboard.down('ControlLeft')
    await page.keyboard.up('ControlLeft')
    await page.waitForTimeout(150)
}

export async function geometry(page: Page): Promise<{ rows: number; cols: number }> {
    const rows = await grid(page).locator(':scope > div').allTextContents()
    return { rows: rows.length, cols: rows[0]?.length ?? 0 }
}

// Puts the cursor on a cell with a click, as an operator does on PCOMM.
export async function clickCell(page: Page, r: number, c: number): Promise<void> {
    const box = (await grid(page).boundingBox())!
    const { rows, cols } = await geometry(page)
    await page.mouse.click(box.x + (c + 0.5) * box.width / cols, box.y + (r + 0.5) * box.height / rows)
}

export async function answerSetup(page: Page, model: string, display: string): Promise<void> {
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 10000 })
    await dialog.getByRole('radio', { name: model }).check()
    await dialog.getByRole('radio', { name: display }).check()
    await dialog.getByRole('button', { name: 'OK', exact: true }).click()
    await expect(dialog).toBeHidden()
}

async function tabMenu(page: Page, item: string): Promise<void> {
    await page.locator('[data-testid="SettingsIcon"]').first().click({ force: true })
    await page.getByRole('menuitem', { name: item, exact: true }).click()
}

export async function stopChannel(page: Page): Promise<void> {
    await tabMenu(page, 'Stop')
    await expect(page.getByTestId('channel-not-started')).toBeVisible({ timeout: 10000 })
}

export async function startChannel(page: Page, model: string, display: string): Promise<void> {
    await tabMenu(page, 'Start')
    await answerSetup(page, model, display)
    await expect(terminal(page)).toBeVisible({ timeout: 20000 })
    await waitUnlocked(page)
}

// A command on a clean command line (End = Erase EOF), then Enter (or another AID).
export async function command(page: Page, text: string, key?: string): Promise<void> {
    const { rows } = await geometry(page)
    await clickCell(page, rows - 4, 6)
    await page.keyboard.press('End')
    await page.keyboard.type(text)
    if (key) await aid(page, key)
    else await enter(page)
}

// The list row whose Subsystem/Job column (6 to 18) holds a name starting with `start`.
export async function listRow(page: Page, start: string): Promise<number> {
    const rows = (await screenText(page)).split('\n')
    return rows.findIndex((t, r) => r >= 8 && t.slice(6, 19).trim().startsWith(start.toUpperCase()))
}

// An option typed on a row of a list, then Enter.
export async function option(page: Page, r: number, value: string): Promise<void> {
    await clickCell(page, r, 2)
    await page.keyboard.type(value)
    await enter(page)
}
