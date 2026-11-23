import React, { useRef } from 'react'
import { Terminal3270 } from '../common/Terminal3270'
import { glassRow3270, oiaOf } from '../common/Display3270'
import { E3270Key, I3270KeyAction } from '../common/Terminal3270Types'
import { EDisplay } from '../common/DisplayTypes'
import { KeyMapper } from './KeyMapper'
import { oiaColorOf, paletteOf } from './Palette'
import { Glass, IGlassKeys } from './Glass'

export interface ITerminalViewProps {
    terminal: Terminal3270
    revision: number                                   // bumped by the owner whenever the buffer changed
    onKey: (action: I3270KeyAction) => void
    fullscreen: boolean
    display: EDisplay                                  // a 3279 in colour or a 3278 in green phosphor
    testId?: string                                    // the consumer's data-testid, for its e2e
}

/*
    A 3270 on the glass: the buffer worked out into runs (Display3270) and the PC keyboard turned into 3270 keys
    (KeyMapper) for its owner, who applies them to the terminal and talks to the host.
*/
export const TerminalView: React.FC<ITerminalViewProps> = ({ terminal, revision, onKey, fullscreen, display, testId }) => {
    const mapperRef = useRef(new KeyMapper())
    const screen = terminal.screen
    const mono = display === EDisplay.GREEN
    void revision

    const send = (action: I3270KeyAction | undefined): boolean => {
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
            row={r => glassRow3270(screen, r, true, mono)}
            oia={oiaOf(terminal)}
            palette={paletteOf(display)}
            oiaColor={oiaColorOf(display)}
            keys={keys}
            onCell={(r, c) => onKey({ key: E3270Key.MOVE_CURSOR, address: screen.address(r, c) })}
            fullscreen={fullscreen}
            testId={testId}
        />
    )
}
