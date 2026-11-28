import { E3270Color, E3270Intensity, I3270Geometry, Painter } from '@jfvilas/kwirth-dce-blockterm'
import { EMessageLevel, paintActionBar, paintCommandLine, paintPfKeys, paintShortMessage, ROW_TITLE, rowPfKeys } from './SdsfLayout'
import { ISdsfContainer, ISdsfPod } from '../SdsfTypes'
import { qosLetterOf } from './DaColumns'

/*
    The ? panel, SDSF's JOB DATA SET DISPLAY (reference capture panels10): one row per data set of the job,
    which here are the pod's containers. S on a row browses that container's log. As on the DA, the job is the
    workload, StepName the pod and ProcStep the container (the data set's own).

      row 2     SDSF JOB DATA SET DISPLAY - JOB API       (STC43981)              LINE 1-3 (3)
      row 3     COMMAND INPUT ===>                                          SCROLL ===> PAGE
      row 4     NP   DDNAME   StepName ProcStep DSID Owner    C State      Rst Image
      5..       one container per row
*/
export const ROW_CONTAINER_HEADERS = 4
export const ROW_FIRST_CONTAINER = 5
export const containerRows = (g: I3270Geometry): number => rowPfKeys(g) - ROW_FIRST_CONTAINER

// The data set id: init containers first, as the JES data sets; the job's own output from 101, as in JES.
export const dsidOf = (pod: ISdsfPod, container: ISdsfContainer): number => {
    const list = pod.containers.filter(c => c.init === container.init)
    return (container.init ? 2 : 101) + list.indexOf(container)
}

const STATE_COLOR = (c: ISdsfContainer): E3270Color =>
    c.state === 'running' && c.ready ? E3270Color.GREEN
        : c.state === 'terminated' && (c.reason === 'Completed' || c.init) ? E3270Color.GREEN
        : c.state === 'waiting' && !c.reason ? E3270Color.YELLOW
        : E3270Color.RED

export interface IContainersState {
    pod: ISdsfPod
    command: string
    scroll: string
    message: string
    messageLevel: EMessageLevel
}

export interface IContainerFields {
    command: number
    scroll: number
    np: { attribute: number; container: ISdsfContainer }[]
}

export const paintContainers = (p: Painter, state: IContainersState): IContainerFields => {
    const screen = p.screen
    const pod = state.pod
    const total = pod.containers.length
    paintActionBar(p)
    p.text(ROW_TITLE, 1, `SDSF JOB DATA SET DISPLAY - JOB ${pod.workload.toUpperCase().slice(0, 8).padEnd(8)}  (${pod.jobId})`, { color: E3270Color.WHITE })
    const lines = `LINE ${total ? 1 : 0}-${Math.min(total, containerRows(screen))} (${total})`
    p.text(ROW_TITLE, screen.cols - lines.length, lines, { color: E3270Color.WHITE })
    paintShortMessage(p, state.message, state.messageLevel)
    const fields = paintCommandLine(p, state.command, state.scroll)

    p.text(ROW_CONTAINER_HEADERS, 1, 'NP ', { color: E3270Color.BLUE })
    p.text(ROW_CONTAINER_HEADERS, 5, 'DDNAME   StepName ProcStep DSID Owner    C State      Rst Image', { color: E3270Color.TURQUOISE })

    const stepName = pod.step.toUpperCase().slice(0, 8)
    const np: IContainerFields['np'] = []
    pod.containers.slice(0, containerRows(screen)).forEach((c, i) => {
        const row = ROW_FIRST_CONTAINER + i
        np.push({ attribute: p.input(row, 1, 3, '', { intensity: E3270Intensity.HIGH }), container: c })
        const qos = qosLetterOf(pod.qos)
        const left = [
            c.name.toUpperCase().slice(0, 8).padEnd(8),
            stepName.padEnd(8),
            c.name.toUpperCase().slice(0, 8).padEnd(8),
            String(dsidOf(pod, c)).padStart(4),
            pod.owner.toUpperCase().slice(0, 8).padEnd(8),
            qos
        ].join(' ')
        p.text(row, 5, left, { color: E3270Color.BLUE })
        p.text(row, 5 + left.length + 1, (c.reason || c.state || 'unknown').slice(0, 10).padEnd(10), { color: STATE_COLOR(c) })
        p.text(row, 5 + left.length + 12, String(c.restarts).padStart(3), { color: c.restarts > 0 ? E3270Color.YELLOW : E3270Color.GREEN })
        p.text(row, 5 + left.length + 16, c.image.slice(0, screen.cols - (5 + left.length + 16)), { color: E3270Color.TURQUOISE })
    })
    paintPfKeys(p)
    return { command: fields.command, scroll: fields.scroll, np }
}
