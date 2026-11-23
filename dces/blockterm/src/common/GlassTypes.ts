import { E3270Color } from './Terminal3270Types'

/*
    What the glass paints, whatever the terminal behind it: a 3270 and a 5250 are worked out (Display3270,
    Display5250) into these runs, and the front end has one painter for both.

    The colour is one of the seven IBM display colours, which both terminals share; E3270Color names them
    because it came first, and the palettes are keyed by it.
*/
export interface IGlassRun {
    text: string
    color: E3270Color          // never DEFAULT: always resolved
    reverse: boolean
    underscore: boolean
    blink: boolean
    separator: boolean         // 5250 column separators: a thin bar before every character
    cursor: boolean            // this run is the single position under the cursor
}

// The status line under the screen.
export interface IGlassOia {
    ready: string              // '4A' on a 3270, 'MA' on a 5250; its first character shows in reverse
    lock: string               // 'X SYSTEM', 'X II 0005'… or '' when the keyboard is free
    insert: boolean
    position: string           // 'rr/ccc', 1-based, as PCOMM shows it
}
