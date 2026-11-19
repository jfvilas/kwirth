import { IGameCommand } from './core/AbyssPatrolGame'

/**
 * Channel keyboard.
 *
 * The listeners go on the tab element, never on `window`: inside Kwirth that would steal the keys from
 * the application and from any other open tab. The element only gets keys while it has focus.
 *
 * Moving is a held state; dropping and starting are edges, collected between ticks and handed over
 * once by take(), so a quick tap between two frames is never lost.
 */
const LEFT = new Set(['ArrowLeft', 'KeyA'])
const RIGHT = new Set(['ArrowRight', 'KeyD'])
const DROP_LEFT = new Set(['KeyZ', 'KeyQ'])
const DROP_RIGHT = new Set(['KeyX', 'KeyE'])
const START = new Set(['Enter', 'Space'])
const HANDLED = new Set([...LEFT, ...RIGHT, ...DROP_LEFT, ...DROP_RIGHT, ...START])

export class AbyssPatrolInput {
    private left = false
    private right = false
    private dropLeft = false
    private dropRight = false
    private start = false
    private element?: HTMLElement

    attach(element: HTMLElement): void {
        if (this.element) this.detach()
        this.element = element
        element.addEventListener('keydown', this.onKeyDown)
        element.addEventListener('keyup', this.onKeyUp)
        element.addEventListener('blur', this.onBlur)
    }

    detach(): void {
        if (!this.element) return
        this.element.removeEventListener('keydown', this.onKeyDown)
        this.element.removeEventListener('keyup', this.onKeyUp)
        this.element.removeEventListener('blur', this.onBlur)
        this.element = undefined
        this.reset()
    }

    reset(): void {
        this.left = this.right = this.dropLeft = this.dropRight = this.start = false
    }

    /** Snapshot for one tick; the edges are consumed. */
    take(): IGameCommand {
        const command: IGameCommand = {
            move: (this.right ? 1 : 0) - (this.left ? 1 : 0),
            dropLeft: this.dropLeft,
            dropRight: this.dropRight,
            start: this.start,
        }
        this.dropLeft = this.dropRight = this.start = false
        return command
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        if (!HANDLED.has(event.code)) return
        event.preventDefault()
        if (LEFT.has(event.code)) this.left = true
        if (RIGHT.has(event.code)) this.right = true
        if (event.repeat) return
        if (DROP_LEFT.has(event.code)) this.dropLeft = true
        if (DROP_RIGHT.has(event.code)) this.dropRight = true
        if (START.has(event.code)) this.start = true
    }

    private onKeyUp = (event: KeyboardEvent): void => {
        if (LEFT.has(event.code)) this.left = false
        if (RIGHT.has(event.code)) this.right = false
    }

    private onBlur = (): void => this.reset()
}
