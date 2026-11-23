import React, { useRef } from 'react'
import { Terminal5250 } from '../common/Terminal5250'
import { displayRow5250, oiaOf5250 } from '../common/Display5250'
import { E5250Key, I5250KeyAction } from '../common/Terminal5250Types'
import { EDisplay } from '../common/DisplayTypes'
import { KeyMapper5250 } from './KeyMapper5250'
import { oiaColorOf, paletteOf } from './Palette'
import { Glass, IGlassKeys } from './Glass'

export interface ITerminalView5250Props {
    terminal: Terminal5250
    revision: number                                   // bumped by the owner whenever the buffer changed
    onKey: (action: I5250KeyAction) => void
    fullscreen: boolean
    display: EDisplay                                  // a colour 3477 or a monochrome 5251 in green phosphor
    testId?: string                                    // the consumer's data-testid, for its e2e
}

/*
    A 5250 on the glass: the buffer worked out into runs (Display5250) and the PC keyboard turned into 5250 keys
    (KeyMapper5250) for its owner, who applies them to the terminal and talks to the host.
*/
export const TerminalView5250: React.FC<ITerminalView5250Props> = ({ terminal, revision, onKey, fullscreen, display, testId }) => {
    const mapperRef = useRef(new KeyMapper5250())
    const screen = terminal.screen
    const mono = display === EDisplay.GREEN
    void revision

    const send = (action: I5250KeyAction | undefined): boolean => {
        if (!action) return false
        onKey(action)
        return true
    }
    const keys: IGlassKeys = {
        down: e => send(mapperRef.current.down(e)),
        up: e => send(mapperRef.current.up(e)),
        cancel: () => mapperRef.current.cancel()
    }

    return (
        <Glass
            rows={screen.rows}
            cols={screen.cols}
            row={r => displayRow5250(screen, r, true, mono)}
            oia={oiaOf5250(terminal)}
            palette={paletteOf(display)}
            oiaColor={oiaColorOf(display)}
            keys={keys}
            onCell={(r, c) => onKey({ key: E5250Key.MOVE_CURSOR, address: screen.address(r, c) })}
            fullscreen={fullscreen}
            testId={testId}
        />
    )
}
