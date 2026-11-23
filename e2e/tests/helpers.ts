import { Page, Locator, expect } from '@playwright/test'
import { execFileSync } from 'child_process'

export const USER = process.env.SDSF_E2E_USER ?? 'admin'
export const PASS = process.env.SDSF_E2E_PASS ?? ''
export const CLUSTER = process.env.SDSF_E2E_CLUSTER ?? 'inCluster'
export const CHANNEL = 'sdsf'

// The namespace this e2e owns: created at the start, deleted at the end. Nothing else in the cluster is touched.
export const NAMESPACE = 'sdsf-e2e'

const FIXTURE = `
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
---
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
          command: ['sh', '-c', 'i=0; while true; do i=$((i+1)); echo "sdsf-e2e tick $i"; sleep 2; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
        - name: sidecar
          image: busybox:1.36
          command: ['sh', '-c', 'while true; do echo "sidecar alive"; sleep 5; done']
          resources:
            requests: { cpu: 5m, memory: 8Mi }
---
apiVersion: batch/v1
kind: Job
metadata:
  name: batch-job
  namespace: ${NAMESPACE}
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: work
          image: busybox:1.36
          command: ['sh', '-c', 'echo "sdsf-e2e job done"']
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: batch-cron
  namespace: ${NAMESPACE}
spec:
  schedule: '0 3 * * *'
  suspend: true
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: Never
          containers:
            - name: work
              image: busybox:1.36
              command: ['sh', '-c', 'echo never']
`

const kubectl = (args: string[], input?: string): string =>
    execFileSync('kubectl', args, { input, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })

export const createFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=true', '--timeout=60s'])
    kubectl(['apply', '-f', '-'], FIXTURE)
    kubectl(['-n', NAMESPACE, 'rollout', 'status', 'deployment/demo', '--timeout=90s'])
    kubectl(['-n', NAMESPACE, 'wait', '--for=condition=complete', 'job/batch-job', '--timeout=90s'])
}

export const deleteFixture = (): void => {
    kubectl(['delete', 'namespace', NAMESPACE, '--ignore-not-found', '--wait=false'])
}

export const fixturePods = (): string[] =>
    kubectl(['-n', NAMESPACE, 'get', 'pods', '-l', 'app=demo', '--field-selector=status.phase=Running', '-o', 'jsonpath={.items[*].metadata.name}'])
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

/** Cluster → View=cluster → channel sdsf → ADD. Left added and NOT started. */
export async function openSdsf(page: Page): Promise<void> {
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

export const terminal = (page: Page): Locator => page.getByTestId('sdsf-terminal')
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
    await expect.poll(() => oiaText(page), { timeout: 60000 }).not.toContain('X SYSTEM')
    await page.waitForTimeout(150)
}

// An AID key (Right Ctrl = Enter, F1..F12 = PF keys), then wait for the answer.
export async function aid(page: Page, key: string): Promise<void> {
    await page.keyboard.press(key)
    await waitUnlocked(page)
}

export const enter = (page: Page): Promise<void> => aid(page, 'ControlRight')

// Puts the cursor on a cell with a click, as an operator does on x3270.
export async function clickCell(page: Page, r: number, c: number): Promise<void> {
    const box = await grid(page).boundingBox()
    if (!box) throw new Error('the terminal grid is not on screen')
    await page.mouse.click(box.x + (c + 0.5) * box.width / 80, box.y + (r + 0.5) * box.height / 32)
}

// Types a primary command on a clean command line (End = Erase EOF) and presses Enter (or another AID).
export async function command(page: Page, text: string, key = 'ControlRight'): Promise<void> {
    await clickCell(page, 3, 20)
    await page.keyboard.press('End')
    if (text) await page.keyboard.type(text)
    await aid(page, key)
}

// Types a line command in the NP column of a screen row.
export async function lineCommand(page: Page, screenRow: number, text: string): Promise<void> {
    await clickCell(page, screenRow, 1)
    await page.keyboard.press('End')
    await page.keyboard.type(text)
}
