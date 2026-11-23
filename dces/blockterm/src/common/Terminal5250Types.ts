/*
    The IBM 5250 this DCE emulates: a 3179 / 3477 display station, 24x80 or 27x132, in colour or monochrome.

    As with the 3270, no DOM: the tests drive it without a browser, and a tn5250 server would encode this very
    model. That is why the values are the real data-stream codes: the AID bytes, the screen attribute bytes
    (0x20-0x3F) and the shift/edit codes of the Field Format Word.

    The two models differ where the terminals differ:
      - the display attribute is ONE byte whose bits are reverse, high intensity, underscore, blink and column
        separators (on a colour display some combinations mean colours instead);
      - a field is defined by the host's format table (Start of Field with its FFW), not by the attribute byte:
        outside the input fields nothing can be typed;
      - the operator has Field Exit, Field+ and Field-, and an operator error shows a code and locks the
        keyboard until Reset.
*/

import { I3270Geometry } from './Terminal3270Types'

// The geometries of a 5250 display: 3179-2 / 3477 at 24x80, 3477-FC wide mode at 27x132. A geometry is rows
// by columns whatever the terminal, so it is the same I3270Geometry.
export const GEOMETRY_5250_24X80: I3270Geometry = { rows: 24, cols: 80 }
export const GEOMETRY_5250_27X132: I3270Geometry = { rows: 27, cols: 132 }

// The screen attribute byte: 0x20 plus these bits. A position holding one shows as a blank.
export enum E5250AttributeBit {
    REVERSE = 0x01,
    HIGH = 0x02,
    UNDERSCORE = 0x04,
    BLINK = 0x08,
    COLUMN_SEPARATOR = 0x10
}

// The attribute bytes IBM i screens use most, by their colour-display meaning.
export enum E5250Attribute {
    GREEN = 0x20,
    GREEN_REVERSE = 0x21,
    WHITE = 0x22,
    WHITE_REVERSE = 0x23,
    GREEN_UNDERSCORE = 0x24,
    GREEN_UNDERSCORE_REVERSE = 0x25,
    WHITE_UNDERSCORE = 0x26,
    NONDISPLAY = 0x27,
    RED = 0x28,
    RED_REVERSE = 0x29,
    RED_BLINK = 0x2A,
    RED_UNDERSCORE = 0x2C,
    TURQUOISE_SEPARATOR = 0x30,
    YELLOW_SEPARATOR = 0x32,
    TURQUOISE_UNDERSCORE = 0x34,
    YELLOW_UNDERSCORE = 0x36,
    PINK = 0x38,
    PINK_REVERSE = 0x39,
    BLUE = 0x3A,
    BLUE_REVERSE = 0x3B,
    PINK_UNDERSCORE = 0x3C,
    BLUE_UNDERSCORE = 0x3E
}

// Field Format Word, shift/edit specification (bits 5-7 of its first byte).
export enum E5250Shift {
    ALPHA = 0,             // alphanumeric shift: anything
    ALPHA_ONLY = 1,        // letters, comma, period, minus, blank
    NUMERIC_SHIFT = 2,     // anything, numeric keypad first
    NUMERIC_ONLY = 3,      // digits, plus, minus, comma, period, blank
    KATAKANA = 4,
    DIGITS_ONLY = 5,       // digits
    IO = 6,                // magnetic stripe / light pen: not typed on
    SIGNED_NUMERIC = 7     // digits; the last position holds the sign, set by Field+ / Field-
}

// Field Format Word, mandatory fill / right adjust (bits 5-7 of its second byte).
export enum E5250Adjust {
    NONE = 0,
    ZERO_FILL = 5,         // right-adjust on Field Exit, zeros on the left
    BLANK_FILL = 6,        // right-adjust on Field Exit, blanks on the left
    MANDATORY_FILL = 7
}

// What the host says about a field when it starts it (Start of Field: FFW). Only what the operator side uses.
export interface I5250FieldFormat {
    bypass: boolean        // an output field: the cursor skips it and nothing is typed on it
    shift: E5250Shift
    monocase: boolean      // lower case typed becomes upper case, as on an IBM i command line
    adjust: E5250Adjust
    fieldExitRequired: boolean     // past the last position the cursor stays and Field Exit must be pressed
}

// An input field on the screen: its data positions run from `start` for `length`; its attribute byte sits at
// start - 1 and its ending attribute at start + length, as Start of Field writes them.
export interface I5250Field {
    start: number
    length: number
    format: I5250FieldFormat
    mdt: boolean           // modified data tag: the operator typed on it
}

// One screen position: a character, or a screen attribute byte that occupies it (shown as a blank).
export interface I5250Cell {
    char: string           // '' is a null: a blank on the glass, not sent to the host
    attribute?: number     // 0x20-0x3F
}

// Attention identifiers: the keys that send the screen to the host. Values are the AID bytes.
export enum E5250Aid {
    ENTER = 0xF1,
    HELP = 0xF3,
    ROLL_DOWN = 0xF4,      // PageUp: the previous page
    ROLL_UP = 0xF5,        // PageDown: the next page
    PRINT = 0xF6,
    RECORD_BACKSPACE = 0xF8,
    CLEAR = 0xBD,
    F1 = 0x31, F2 = 0x32, F3 = 0x33, F4 = 0x34, F5 = 0x35, F6 = 0x36,
    F7 = 0x37, F8 = 0x38, F9 = 0x39, F10 = 0x3A, F11 = 0x3B, F12 = 0x3C,
    F13 = 0xB1, F14 = 0xB2, F15 = 0xB3, F16 = 0xB4, F17 = 0xB5, F18 = 0xB6,
    F19 = 0xB7, F20 = 0xB8, F21 = 0xB9, F22 = 0xBA, F23 = 0xBB, F24 = 0xBC
}

export const F_AIDS: E5250Aid[] = [
    E5250Aid.F1, E5250Aid.F2, E5250Aid.F3, E5250Aid.F4, E5250Aid.F5, E5250Aid.F6,
    E5250Aid.F7, E5250Aid.F8, E5250Aid.F9, E5250Aid.F10, E5250Aid.F11, E5250Aid.F12,
    E5250Aid.F13, E5250Aid.F14, E5250Aid.F15, E5250Aid.F16, E5250Aid.F17, E5250Aid.F18,
    E5250Aid.F19, E5250Aid.F20, E5250Aid.F21, E5250Aid.F22, E5250Aid.F23, E5250Aid.F24
]

// Why the keyboard is locked.
export enum E5250Lock {
    NONE = 'none',
    SYSTEM = 'system',             // an AID was sent and the host has not answered
    OPERATOR = 'operator',         // an operator error, with its code: Reset unlocks it
    HOST_ERROR = 'hosterror'       // the host wrote an error message on the error line: Reset restores the line
}

// The operator error codes the 5250 shows (in the OIA here) until Reset.
export enum E5250Error {
    PROTECTED = '0005',            // cursor in a protected area of the display
    NUMERIC_ONLY = '0010',         // a character the field's shift does not allow
    NO_ROOM_TO_INSERT = '0012',    // insert mode with the field full
    FIELD_MINUS = '0019'           // Field- outside a numeric field
}

// What the operator did on the keyboard, once the PC key has been translated (front/KeyMapper5250).
export enum E5250Key {
    CHAR = 'char',
    AID = 'aid',
    FIELD_EXIT = 'fieldexit',
    FIELD_PLUS = 'fieldplus',
    FIELD_MINUS = 'fieldminus',
    NEWLINE = 'newline',
    TAB = 'tab',
    BACKTAB = 'backtab',
    HOME = 'home',
    UP = 'up',
    DOWN = 'down',
    LEFT = 'left',
    RIGHT = 'right',
    BACKSPACE = 'backspace',
    DELETE = 'delete',
    ERASE_EOF = 'eraseeof',
    ERASE_INPUT = 'eraseinput',
    INSERT = 'insert',
    RESET = 'reset',
    MOVE_CURSOR = 'movecursor'
}

export interface I5250KeyAction {
    key: E5250Key
    char?: string          // CHAR
    aid?: E5250Aid         // AID
    address?: number       // MOVE_CURSOR
}

export interface I5250ModifiedField {
    start: number          // the field's first data position
    value: string          // nulls suppressed, as a Read MDT Fields sends it
}

// What an AID sends to the host: the Read MDT Fields.
export interface I5250Input {
    aid: E5250Aid
    cursor: number
    fields: I5250ModifiedField[]   // empty for CLEAR
}
