/**
 * Only the TYPES of the original InputProvider.
 *
 * The InputProvider class from wuspy/asteroids has been removed on purpose:
 * it hooked the keyboard listeners onto `window`, which inside Kwirth
 * would steal the keys from the application and from the other tabs. The channel
 * keyboard is handled in ../../AsteroidsInput.ts, on the tab element.
 *
 * The types are kept because AsteroidsGame.tick() and GameLog use them.
 */

export const DEFAULT_DEADZONE = 0.3;

export type GamepadButtonName =
    | "A"
    | "B"
    | "X"
    | "Y"
    | "LT"
    | "LB"
    | "RT"
    | "RB"
    | "Start"
    | "Back"
    | "Home"
    | "LS"
    | "RS"
    | "DpadUp"
    | "DpadLeft"
    | "DpadDown"
    | "DpadRight";

export type GamepadAxisName =
    | "LsHorizontal"
    | "LsVertical"
    | "RsHorizontal"
    | "RsVertical";

export type InputState<Controls extends readonly string[]> = { [Key in Controls[number]]: number };

export const enum InputMappingType {
    Digital,
    Analog,
}

export type DigitalInputMapping<Controls extends readonly string[]> = {
    type: InputMappingType.Digital;
    control: Controls[number];
} | {
    type: InputMappingType.Analog;
    control: Controls[number];
    value: number;
};

export type AnalogInputMapping<Controls extends readonly string[]> = {
    type: InputMappingType.Digital;
    control: Controls[number];
    threshold: number;
} | {
    type: InputMappingType.Analog;
    control: Controls[number];
    invert?: boolean;
};

export interface InputMapping<Controls extends readonly string[]> {
    keys?: { [Key in string]: DigitalInputMapping<Controls> };
    buttons?: Partial<{ [Key in GamepadButtonName]: DigitalInputMapping<Controls> }>;
    axes?: Partial<{ [Key in GamepadAxisName]: AnalogInputMapping<Controls> }>;
}

const gamepadButtonPressed = (b: GamepadButton | number) => typeof (b) === "object" ? b.pressed : b === 1.0;

// These map to the W3C standard gamepad specification
// https://w3c.github.io/gamepad/#remapping

const GAMEPAD_BUTTON_INDEX: { [Key in GamepadButtonName]: number } = {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    Back: 8,
    Start: 9,
    LS: 10,
    RS: 11,
    DpadUp: 12,
    DpadDown: 13,
    DpadLeft: 14,
    DpadRight: 15,
    Home: 16,
};

const GAMEPAD_AXIS_INDEX: { [Key in GamepadAxisName]: number } = {
    LsHorizontal: 0,
    LsVertical: 1,
    RsHorizontal: 2,
    RsVertical: 3,
};

export interface InputProviderEvents<Controls extends readonly string[]> {
    gamepadConnected: (gamepad: Gamepad) => void;
    gamepadDisconnected: (gamepad: Gamepad) => void;
    mappingChanged: (mapping: Readonly<InputMapping<Controls>>) => void;
    poll: (state: Readonly<InputState<Controls>>, lastState: Readonly<InputState<Controls>>) => void;
}

export const createEmptyInput = <Controls extends readonly string[]>(controls: Controls): InputState<Controls> =>
    controls.reduce((o, name) => ({ ...o, [name]: 0 }), {}) as InputState<Controls>;
