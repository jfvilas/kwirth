import { E5250Attribute, Painter5250 } from '@jfvilas/kwirth-dce-blockterm'
import { leader } from './JobIdentity'
import { paintKeys, paintMessage, paintRight, paintTitle, rowsOf } from './WrkLayout'

// One parameter of a CL command prompt: its keyword, what the prompt calls it, its field and what it takes.
export interface IPromptParam {
    keyword: string
    label: string
    width: number
    choices: string            // shown to the right: 'Name', '*CNTRLD, *IMMED'…
    initial: string
}

export interface IPromptDef {
    command: string
    title: string
    params: IPromptParam[]
}

export const ENDJOB_PROMPT: IPromptDef = {
    command: 'ENDJOB',
    title: 'End Job (ENDJOB)',
    params: [
        { keyword: 'JOB', label: 'Job name', width: 28, choices: 'Name', initial: '' },
        { keyword: 'OPTION', label: 'How to end', width: 8, choices: '*CNTRLD, *IMMED', initial: '*CNTRLD' },
        { keyword: 'DELAY', label: 'Controlled end delay time', width: 6, choices: 'Seconds', initial: '30' }
    ]
}

export const WRKJOB_PROMPT: IPromptDef = {
    command: 'WRKJOB',
    title: 'Work with Job (WRKJOB)',
    params: [
        { keyword: 'JOB', label: 'Job name', width: 28, choices: 'Name', initial: '' }
    ]
}

export const PROMPTS: IPromptDef[] = [ENDJOB_PROMPT, WRKJOB_PROMPT]

const LABEL_WIDTH = 34
const FIELD_COL = 1 + LABEL_WIDTH + 1

/*
    The prompt of a CL command (F4, or option 4 for ENDJOB): one line per parameter, its value in an underlined
    field, what it takes on the right. Returns the field of each keyword.
*/
export const paintPrompt = (p: Painter5250, def: IPromptDef, values: Record<string, string>, subsystem: string, message: string): Record<string, number> => {
    const rows = rowsOf(p.screen)
    paintTitle(p, def.title, '', 0)
    p.text(2, 1, 'Type choices, press Enter.', E5250Attribute.BLUE, true)
    const fields: Record<string, number> = {}
    let row = 4
    for (const param of def.params) {
        p.text(row, 1, leader(param.label, LABEL_WIDTH, false), E5250Attribute.GREEN)
        fields[param.keyword] = p.input(row, FIELD_COL, param.width, values[param.keyword] ?? param.initial, { monocase: true })
        p.text(row, FIELD_COL + param.width + 2, param.choices, E5250Attribute.BLUE, true)
        row++
        // the job's subsystem, under its name, when the prompt comes from the list
        if (param.keyword === 'JOB' && subsystem) {
            p.text(row, 3, leader('Subsystem', LABEL_WIDTH - 2), E5250Attribute.GREEN)
            p.text(row, FIELD_COL, subsystem, E5250Attribute.GREEN, true)
            row++
        }
    }
    paintRight(p, rows.more, 'Bottom')
    paintKeys(p, rows, ['F3=Exit', 'F12=Cancel'], [])
    paintMessage(p, rows, message)
    return fields
}
