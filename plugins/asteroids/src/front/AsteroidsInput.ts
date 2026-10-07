import { InputState, controls, createEmptyInput } from './core'

/**
 * Channel keyboard.
 *
 * It deliberately does NOT use the original project's InputProvider, which hooks
 * the listeners onto `window`. Inside Kwirth that would steal the keys from the
 * application and from any other open tab. Here the listeners go on the
 * tab element, which only receives events when it has focus.
 */

export type AsteroidsInputState = InputState<typeof controls>

const KEY_MAP: Record<string, keyof AsteroidsInputState | 'turnLeft' | 'turnRight'> = {
    ArrowLeft: 'turnLeft',
    KeyA: 'turnLeft',
    ArrowRight: 'turnRight',
    KeyD: 'turnRight',
    ArrowUp: 'thrust',
    KeyW: 'thrust',
    Space: 'fire',
    ShiftLeft: 'hyperspace',
    ShiftRight: 'hyperspace',
    KeyH: 'hyperspace',
    Enter: 'start',
}

/** Keys we consume: the rest go on their way to Kwirth. */
const HANDLED = new Set(Object.keys(KEY_MAP))

export class AsteroidsInput {
    private readonly state: AsteroidsInputState = createEmptyInput(controls)
    private turnLeft = false
    private turnRight = false
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

    /** Releases all keys. Called when focus is lost and when pausing. */
    reset(): void {
        this.turnLeft = false
        this.turnRight = false
        for (const control of controls) this.state[control] = 0
    }

    get current(): Readonly<AsteroidsInputState> {
        return this.state
    }

    /** For the TabContent touch buttons. */
    setVirtual(control: 'turn' | 'thrust' | 'fire' | 'hyperspace' | 'start', value: number): void {
        this.state[control] = value
    }

    private set(code: string, pressed: boolean): void {
        const mapped = KEY_MAP[code]
        if (!mapped) return
        if (mapped === 'turnLeft') this.turnLeft = pressed
        else if (mapped === 'turnRight') this.turnRight = pressed
        else this.state[mapped] = pressed ? 1 : 0
        this.state.turn = (this.turnRight ? 1 : 0) - (this.turnLeft ? 1 : 0)
    }

    private onKeyDown = (e: Event): void => {
        const event = e as KeyboardEvent
        if (event.repeat) return
        if (!HANDLED.has(event.code)) return
        event.preventDefault()
        event.stopPropagation()
        this.set(event.code, true)
    }

    private onKeyUp = (e: Event): void => {
        const event = e as KeyboardEvent
        if (!HANDLED.has(event.code)) return
        event.preventDefault()
        event.stopPropagation()
        this.set(event.code, false)
    }

    private onBlur = (): void => this.reset()
}
