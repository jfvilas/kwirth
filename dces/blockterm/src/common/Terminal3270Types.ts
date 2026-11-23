/*
    The IBM 3270 this plugin emulates: a 3278 or 3279 with extended attributes, of any of the sizes in
    I3270Geometry (model 2 24x80, model 3 32x80, model 5 27x132).

    It lives in common/, with no DOM, for two reasons: the tests drive it without a browser, and the same
    model is what a tn3270 server would encode one day (backlog V2). That is also why the enum VALUES are the
    real data-stream codes: an encoder writes them as they are.
*/

// The size of the screen: rows and columns of the buffer, as the model sets them.
export interface I3270Geometry {
    rows: number
    cols: number
}

export const MODEL3_GEOMETRY: I3270Geometry = { rows: 32, cols: 80 }

// Extended colour attribute values (SFE/SA type 0x42).
export enum E3270Color {
    DEFAULT = 0x00,
    BLUE = 0xF1,
    RED = 0xF2,
    PINK = 0xF3,
    GREEN = 0xF4,
    TURQUOISE = 0xF5,
    YELLOW = 0xF6,
    WHITE = 0xF7
}

// Extended highlighting attribute values (SFE/SA type 0x41).
export enum E3270Highlight {
    DEFAULT = 0x00,
    BLINK = 0xF1,
    REVERSE = 0xF2,
    UNDERSCORE = 0xF4
}

// The display bits of a field attribute.
export enum E3270Intensity {
    NORMAL = 'normal',
    HIGH = 'high',
    HIDDEN = 'hidden'      // non-display: passwords
}

// Attention identifiers: the keys that send the screen to the host. Values are the AID bytes.
export enum E3270Aid {
    ENTER = 0x7D,
    PF1 = 0xF1, PF2 = 0xF2, PF3 = 0xF3, PF4 = 0xF4, PF5 = 0xF5, PF6 = 0xF6,
    PF7 = 0xF7, PF8 = 0xF8, PF9 = 0xF9, PF10 = 0x7A, PF11 = 0x7B, PF12 = 0x7C,
    PF13 = 0xC1, PF14 = 0xC2, PF15 = 0xC3, PF16 = 0xC4, PF17 = 0xC5, PF18 = 0xC6,
    PF19 = 0xC7, PF20 = 0xC8, PF21 = 0xC9, PF22 = 0x4A, PF23 = 0x4B, PF24 = 0x4C,
    PA1 = 0x6C, PA2 = 0x6E, PA3 = 0x6B,
    CLEAR = 0x6D
}

export const PF_AIDS: E3270Aid[] = [
    E3270Aid.PF1, E3270Aid.PF2, E3270Aid.PF3, E3270Aid.PF4, E3270Aid.PF5, E3270Aid.PF6,
    E3270Aid.PF7, E3270Aid.PF8, E3270Aid.PF9, E3270Aid.PF10, E3270Aid.PF11, E3270Aid.PF12,
    E3270Aid.PF13, E3270Aid.PF14, E3270Aid.PF15, E3270Aid.PF16, E3270Aid.PF17, E3270Aid.PF18,
    E3270Aid.PF19, E3270Aid.PF20, E3270Aid.PF21, E3270Aid.PF22, E3270Aid.PF23, E3270Aid.PF24
]

// Why the keyboard is locked, as the OIA shows it ('X SYSTEM', 'X Protected'…).
export enum E3270Lock {
    NONE = 'none',
    SYSTEM = 'system',         // an AID was sent and the host has not answered: only the host unlocks it
    PROTECTED = 'protected',   // typed on a protected position: Reset unlocks it
    NUMERIC = 'numeric',       // a non-numeric character in a numeric field
    OVERFLOW = 'overflow'      // insert mode with the field full
}

// What the operator did on the keyboard, once the PC key has been translated (front/terminal/KeyMapper).
export enum E3270Key {
    CHAR = 'char',
    AID = 'aid',
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
    INSERT = 'insert',
    RESET = 'reset',
    MOVE_CURSOR = 'movecursor'     // the cursor put somewhere by hand (a click), as emulators allow
}

export interface I3270KeyAction {
    key: E3270Key
    char?: string          // CHAR
    aid?: E3270Aid         // AID
    address?: number       // MOVE_CURSOR
}

// The field attribute byte (plus its extended attributes), which occupies one buffer position.
export interface I3270FieldAttribute {
    protected: boolean
    numeric: boolean
    intensity: E3270Intensity
    mdt: boolean           // modified data tag: set when the operator types into the field
    color: E3270Color
    highlight: E3270Highlight
}

// One buffer position: a character, or the attribute byte that starts a field.
export interface I3270Cell {
    char: string                       // '' is a null, shown as a blank and not sent back to the host
    attribute?: I3270FieldAttribute    // present = this position is a field attribute, displayed as a blank
    color: E3270Color                  // character attribute (SA); DEFAULT = the field's
    highlight: E3270Highlight
}

export interface I3270ModifiedField {
    address: number                    // the attribute's position
    value: string                      // nulls suppressed, as a Read Modified sends it
}

// What an AID sends to the host: the Read Modified.
export interface I3270Input {
    aid: E3270Aid
    cursor: number
    fields: I3270ModifiedField[]       // empty for CLEAR and the PA keys (short read)
}
