/*
    How the terminal shows its colours: a colour display (3279) paints the seven colours, a monochrome one
    (3278) only two intensities of green phosphor. The engine brings every cell down to those two levels
    when it is mono (Display3270), and the front end paints them with the palette of the display.
*/
export enum EDisplay {
    COLOR = 'color',
    GREEN = 'green'
}
