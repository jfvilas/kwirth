import { IAsteroidsInstanceConfig, TAsteroidsTheme } from './AsteroidsTypes'

export interface IAsteroidsConfig {
    theme: TAsteroidsTheme
    /** Shows the touch buttons below the canvas (useful on mobile). */
    touchControls: boolean
    /** Pauses the game automatically when the tab loses focus. */
    pauseOnBlur: boolean
}

export class AsteroidsConfig implements IAsteroidsConfig {
    theme: TAsteroidsTheme = 'classic'
    touchControls = false
    pauseOnBlur = true
}

export class AsteroidsInstanceConfig implements IAsteroidsInstanceConfig {
    aspectRatio = 1.6
    senderId?: string
    senderConfigName?: string
}
