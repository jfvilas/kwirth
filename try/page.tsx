import React from 'react'
import { createRoot } from 'react-dom/client'
import type { IBlockterm } from '../src/front/BlockTerm'
import type { I5250KeyAction, Terminal5250 } from '../src/front/BlockTerm'

/*
    The hand check of the 5250 glass, outside Kwirth: it loads the BUILT dist/front.js — the very file Kwirth
    loads — with the two things Kwirth would give it (React and the factory registry), creates the instance and
    paints a WRKACTJOB-like sample screen with TerminalView5250. Nothing here comes from src at runtime: only
    the types.

    The "host" answers every AID after a moment: option 9 gets the IBM i error on the error line (Reset gives
    the line back), anything else is echoed on the message line.

    ?mono=1 for a 5251 green screen, ?wide=1 for 27x132.
*/
type TRegistry = Record<string, { create: () => unknown }>
const w = window as unknown as Record<string, unknown>
w.__kwirth__ = { React, kwirthCommon: { DCE_FRONT_FACTORIES: '__kwirth_dce_factories__' } }

const params = new URLSearchParams(location.search)

const loadDce = (): Promise<IBlockterm> => new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = '../../dist/front.js'
    script.onload = () => {
        const registry = w.__kwirth_dce_factories__ as TRegistry | undefined
        const factory = registry?.['blockterm']
        if (!factory) return reject(new Error('dist/front.js registered no factory'))
        resolve(factory.create() as IBlockterm)
    }
    script.onerror = () => reject(new Error('cannot load dist/front.js: run npm run build first'))
    document.head.appendChild(script)
})

const SAMPLE: [string, string, string, string, string, string][] = [
    //  name              user        type   cpu    function             status
    ['KUBE-SYSTEM', '', 'SBS', '.0', '', 'DEQW'],
    ['  COREDNS-7C', 'COREDNS', 'ASJ', '.1', 'PGM-coredns', 'RUN'],
    ['  KUBE-PROXY', 'KUBE-PROX', 'SYS', '.0', 'PGM-kube-proxy', 'DEQW'],
    ['  METRICS-SE', 'METRICS-S', 'ASJ', '.3', 'PGM-metrics-server', 'RUN'],
    ['PAYROLL', '', 'SBS', '.0', '', 'DEQW'],
    ['  API-7D9F8B', 'PAYROLL', 'ASJ', '1.2', 'PGM-payroll-api', 'RUN'],
    ['  NIGHTLY-29', 'BATCH', 'BCH', '.0', 'PGM-nightly-close', 'MSGW'],
    ['  REPORTS-6F', 'PAYROLL', 'ASJ', '.0', 'PGM-reports', 'SCDW']
]

const paint = (bt: IBlockterm, terminal: Terminal5250): void => {
    const { E5250Attribute: A } = bt
    const screen = terminal.screen
    const p = new bt.Painter5250(screen)
    const right = screen.cols
    p.text(0, Math.floor((right - 21) / 2), 'Work with Active Jobs', A.WHITE, true)
    p.text(0, right - 10, 'INCLUSTER', A.WHITE, true)
    p.text(1, right - 20, '11/23/26  19:42:07', A.WHITE, true)
    p.text(2, 1, 'CPU %:    12.3     Elapsed time:   00:00:05     Active jobs:   245', A.GREEN, true)
    p.text(4, 1, 'Type options, press Enter.', A.BLUE, true)
    p.text(5, 3, '4=End   5=Work with   7=Display message   8=Work with spooled files', A.BLUE, true)
    p.text(7, 1, 'Opt  Subsystem/Job  User        Type  CPU %  Function            Status', A.WHITE, true)
    SAMPLE.forEach(([name, user, type, cpu, fn, status], i) => {
        const row = 8 + i
        p.input(row, 2, 2)
        p.text(row, 6, `${name.padEnd(13)}  ${user.padEnd(10)}  ${type.padEnd(4)}  ${cpu.padStart(5)}  ${fn.padEnd(18)}`, A.GREEN)
        p.text(row, 69, status, status === 'MSGW' ? A.WHITE : A.GREEN, true)
    })
    p.text(screen.rows - 6, right - 9, 'More...', A.WHITE, true)
    p.text(screen.rows - 5, 1, 'Parameters or command', A.GREEN, true)
    p.text(screen.rows - 4, 1, '===>', A.GREEN, true)
    p.input(screen.rows - 4, 6, right - 8, '', { monocase: true })
    p.text(screen.rows - 3, 1, 'F3=Exit   F5=Refresh   F7=Find   F10=Restart statistics', A.BLUE, true)
    p.text(screen.rows - 2, 1, 'F11=Display elapsed data   F12=Cancel   F23=More options   F24=More keys', A.BLUE, true)
    screen.cursor = screen.inputFields()[0].start
}

const Page: React.FC<{ bt: IBlockterm }> = ({ bt }) => {
    const geometry = params.has('wide') ? bt.GEOMETRY_5250_27X132 : bt.GEOMETRY_5250_24X80
    const display = params.has('mono') ? bt.EDisplay.GREEN : bt.EDisplay.COLOR
    const [terminal] = React.useState(() => {
        const t = new bt.Terminal5250(new bt.Screen5250(geometry))
        paint(bt, t)
        return t
    })
    const [revision, setRevision] = React.useState(0)
    const bump = () => setRevision(r => r + 1)

    const onKey = (action: I5250KeyAction): void => {
        const input = terminal.apply(action)
        bump()
        if (!input) return
        setTimeout(() => {
            const screen = terminal.screen
            const nine = input.fields.find(f => f.value.trim() === '9')
            if (nine) {
                terminal.hostError('Option 9 not valid.', nine.start)
            }
            else {
                terminal.unlock()
                const sent = input.fields.map(f => `${screen.rowOf(f.start) + 1}/${screen.colOf(f.start) + 1}='${f.value}'`).join(' ')
                const last = screen.address(screen.rows - 1, 0)
                for (let c = 0; c < screen.cols; c++) screen.cells[last + c] = { char: '' }
                new bt.Painter5250(screen).text(screen.rows - 1, 1, `AID 0x${input.aid.toString(16).toUpperCase()} ${sent}`.slice(0, screen.cols - 2), bt.E5250Attribute.WHITE)
            }
            bump()
        }, 300)
    }

    return <bt.TerminalView5250 terminal={terminal} revision={revision} onKey={onKey} fullscreen={false} display={display} testId='try-5250' />
}

loadDce()
    .then(bt => createRoot(document.getElementById('root')!).render(<Page bt={bt} />))
    .catch(err => { document.body.textContent = String(err) })
