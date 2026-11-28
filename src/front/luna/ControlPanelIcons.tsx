import React from 'react'

/*
    The Control Panel's icons, drawn here as plain shapes (none of Microsoft's): one per kind of thing, shared by the
    applets that are of that kind. 32x32, in XP's palette.
*/
const BLUE = '#2f6be0'
const DARK = '#1d438f'
const LINE = '#3b5a8f'
const PAPER = '#fff'
const FOLDER = '#f5cf55'
const FOLDER_DARK = '#c79a1e'
const GREEN = '#3c9a3c'
const GREY = '#b8c0cc'

const monitor = (screen = BLUE) => <>
    <rect x='3' y='4' width='26' height='18' rx='1.5' fill='#dfe8f6' stroke={LINE} />
    <rect x='5.5' y='6.5' width='21' height='13' fill={screen} />
    <rect x='12' y='22' width='8' height='3' fill='#8a96ab' />
    <rect x='8' y='25' width='16' height='3' rx='1' fill='#c3cbd8' stroke='#5d6a82' strokeWidth='.6' />
</>

const folder = (badge?: JSX.Element) => <>
    <path d='M2 9h10l2 2h16v16H2z' fill={FOLDER} stroke={FOLDER_DARK} />
    <path d='M2 13h28v14H2z' fill='#fbe08a' stroke={FOLDER_DARK} />
    {badge}
</>

const globe = (badge?: JSX.Element) => <>
    <circle cx='16' cy='16' r='12' fill='#4aa3e8' stroke={DARK} />
    <path d='M9 10c3 1 4 4 2 6s1 5 3 6M20 6c-2 3 0 5 3 5s3 4 1 6' fill='none' stroke={GREEN} strokeWidth='3' strokeLinecap='round' />
    {badge}
</>

const clock = (x = 16, y = 16, r = 12) => <>
    <circle cx={x} cy={y} r={r} fill={PAPER} stroke={LINE} strokeWidth='1.5' />
    <path d={`M${x} ${y - r * .6}V${y}l${r * .45} ${r * .3}`} fill='none' stroke={DARK} strokeWidth='2' strokeLinecap='round' />
</>

export const APPLET_GLYPHS = {
    accessibility: <>
        <circle cx='16' cy='16' r='13' fill={GREEN} stroke='#1f5a1f' />
        <circle cx='16' cy='8.5' r='2.4' fill={PAPER} />
        <path d='M9 13h14M16 13v6l-4 6M16 19l4 6' fill='none' stroke={PAPER} strokeWidth='2.4' strokeLinecap='round' />
    </>,
    hardware: <>
        <rect x='6' y='8' width='20' height='16' rx='1.5' fill='#4d5a6e' stroke='#222' />
        {[10, 14, 18, 22].map(x => <rect key={x} x={x - .8} y='4' width='1.6' height='4' fill={GREY} />)}
        {[10, 14, 18, 22].map(x => <rect key={x + 'b'} x={x - .8} y='24' width='1.6' height='4' fill={GREY} />)}
        <rect x='10' y='12' width='12' height='8' fill='#6f7d94' />
    </>,
    programs: <>
        <rect x='3' y='9' width='18' height='18' fill='#c99a4c' stroke='#7a5520' />
        <circle cx='21' cy='12' r='9' fill='#e6ecf5' stroke={LINE} />
        <circle cx='21' cy='12' r='2.5' fill={PAPER} stroke={LINE} />
    </>,
    tools: <>
        <circle cx='14' cy='14' r='9' fill={GREY} stroke='#5d6a82' strokeWidth='1.5' />
        <circle cx='14' cy='14' r='3.5' fill={PAPER} stroke='#5d6a82' />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(a => <rect key={a} x='12.5' y='2.5' width='3' height='4' fill={GREY} stroke='#5d6a82' strokeWidth='.6' transform={`rotate(${a} 14 14)`} />)}
        <path d='M19 20l9 9' stroke='#8a5a2b' strokeWidth='3.5' strokeLinecap='round' />
    </>,
    updates: globe(<path d='M22 18v10M18 24l4 4 4-4' fill='none' stroke='#e0441e' strokeWidth='2.5' strokeLinecap='round' />),
    clock: <>{clock()}</>,
    display: monitor('#5d92f0'),
    folder: folder(),
    fonts: folder(<text x='16' y='25' fontSize='11' fontWeight='700' fontFamily='serif' textAnchor='middle' fill={DARK}>A</text>),
    gamepad: <>
        <path d='M6 12h20c3 0 4 3 4 7 0 5-3 7-5 5l-3-3H10l-3 3c-2 2-5 0-5-5 0-4 1-7 4-7z' fill={GREY} stroke='#5d6a82' />
        <path d='M9 15v6M6 18h6' stroke={DARK} strokeWidth='2' />
        <circle cx='22' cy='16' r='1.6' fill='#e0441e' /><circle cx='25' cy='19' r='1.6' fill={GREEN} />
    </>,
    internet: globe(),
    keyboard: <>
        <rect x='2' y='9' width='28' height='14' rx='2' fill='#e6ecf5' stroke={LINE} />
        {[0, 1, 2].map(r => [0, 1, 2, 3, 4, 5].map(c => <rect key={`${r}-${c}`} x={4.5 + c * 4} y={11.5 + r * 3.4} width='3' height='2.4' fill={PAPER} stroke='#8a96ab' strokeWidth='.5' />))}
    </>,
    mouse: <>
        <rect x='9' y='5' width='14' height='22' rx='7' fill={PAPER} stroke={LINE} strokeWidth='1.4' />
        <path d='M16 5v8M9 13h14' stroke={LINE} />
        <path d='M16 5c0-3 4-3 4-5' fill='none' stroke='#5d6a82' />
    </>,
    network: <>
        <g transform='translate(-2 -2) scale(.6)'>{monitor()}</g>
        <g transform='translate(14 12) scale(.6)'>{monitor()}</g>
        <path d='M9 15v9h12' fill='none' stroke={GREEN} strokeWidth='2' />
    </>,
    phone: <>
        <rect x='9' y='3' width='14' height='26' rx='2.5' fill='#5d6a82' stroke='#222' />
        <rect x='11.5' y='6' width='9' height='8' fill='#c8e6b8' />
        {[0, 1, 2].map(r => [0, 1, 2].map(c => <rect key={`${r}-${c}`} x={11.5 + c * 3.3} y={17 + r * 3.4} width='2.4' height='2.2' fill={PAPER} />))}
    </>,
    power: <>
        <rect x='8' y='6' width='16' height='22' rx='2' fill='#e8c33a' stroke='#8a6b00' />
        <rect x='12' y='3' width='8' height='3' fill='#8a6b00' />
        <path d='M17 10l-5 8h4l-2 7 6-9h-4z' fill='#fff' stroke='#8a6b00' strokeWidth='.6' />
    </>,
    printer: <>
        <rect x='8' y='3' width='16' height='10' fill={PAPER} stroke='#5d6a82' />
        <rect x='3' y='12' width='26' height='11' rx='2' fill={GREY} stroke='#5d6a82' />
        <rect x='8' y='20' width='16' height='9' fill={PAPER} stroke='#5d6a82' />
        <circle cx='25' cy='16' r='1.2' fill={GREEN} />
    </>,
    regional: globe(<><circle cx='24' cy='24' r='6' fill={PAPER} stroke={LINE} /><path d='M21 24h6M24 21c-2 2-2 4 0 6M24 21c2 2 2 4 0 6' fill='none' stroke={LINE} /></>),
    camera: <>
        <rect x='3' y='10' width='26' height='17' rx='2.5' fill='#5d6a82' stroke='#222' />
        <rect x='10' y='6' width='9' height='5' fill='#5d6a82' stroke='#222' />
        <circle cx='16' cy='18.5' r='6' fill='#8fb4e8' stroke='#222' /><circle cx='16' cy='18.5' r='2.5' fill={DARK} />
    </>,
    tasks: folder(<g>{clock(22, 21, 7)}</g>),
    security: <>
        <path d='M16 2l12 4v8c0 8-6 13-12 16C10 27 4 22 4 14V6z' fill='#e0441e' stroke='#7a1a07' />
        <path d='M16 2v28C10 27 4 22 4 14V6z' fill={BLUE} />
        <path d='M4 14h24' stroke={PAPER} strokeWidth='1.5' />
    </>,
    sound: <>
        <path d='M4 12h6l8-6v20l-8-6H4z' fill={GREY} stroke='#5d6a82' />
        <path d='M22 11c2 3 2 7 0 10M25 8c4 5 4 11 0 16' fill='none' stroke={BLUE} strokeWidth='2' strokeLinecap='round' />
    </>,
    speech: <>
        <path d='M4 5h24v15H14l-6 6v-6H4z' fill={PAPER} stroke={LINE} strokeWidth='1.4' />
        <path d='M9 10h14M9 14h10' stroke={BLUE} strokeWidth='2' strokeLinecap='round' />
    </>,
    system: monitor('#3c9a3c'),
    taskbar: <>
        <rect x='3' y='5' width='26' height='22' fill='#4aa3e8' stroke={LINE} />
        <rect x='3' y='22' width='26' height='5' fill={BLUE} />
        <rect x='3' y='22' width='8' height='5' rx='2' fill={GREEN} />
        <rect x='6' y='9' width='10' height='11' fill={PAPER} stroke={LINE} strokeWidth='.7' />
    </>,
    users: <>
        <circle cx='20' cy='10' r='5' fill='#f2c79a' stroke='#8a5a2b' strokeWidth='.8' />
        <path d='M12 28c0-6 3.5-9 8-9s8 3 8 9z' fill={GREEN} stroke='#1f5a1f' strokeWidth='.8' />
        <circle cx='11' cy='12' r='5' fill='#f7d4ad' stroke='#8a5a2b' strokeWidth='.8' />
        <path d='M3 30c0-6 3.5-9 8-9s8 3 8 9z' fill={BLUE} stroke={DARK} strokeWidth='.8' />
    </>,
    firewall: <>
        <rect x='3' y='8' width='26' height='20' fill='#c0503a' stroke='#6e2414' />
        {[12, 17, 22].map(y => <path key={y} d={`M3 ${y}h26`} stroke='#e8d3c8' />)}
        {[0, 1, 2, 3].map(r => <path key={r} d={`M${r % 2 ? 9 : 15} ${8 + r * 5}v5M${r % 2 ? 21 : 27} ${8 + r * 5}v5`} stroke='#e8d3c8' />)}
        <path d='M20 2c4 4-1 6 3 9 2-3 4-1 4 2' fill='#f0a030' stroke='#b85a00' />
    </>,
    wireless: <>
        <rect x='6' y='18' width='20' height='9' rx='2' fill={GREY} stroke='#5d6a82' />
        <path d='M16 18V8' stroke='#5d6a82' strokeWidth='2' />
        <path d='M11 8a7 7 0 0 1 10 0M8 5a11 11 0 0 1 16 0' fill='none' stroke={GREEN} strokeWidth='2' strokeLinecap='round' />
        <circle cx='22' cy='22.5' r='1.2' fill={GREEN} />
    </>
}

export type TAppletGlyph = keyof typeof APPLET_GLYPHS

export const AppletIcon: React.FC<{ glyph: TAppletGlyph }> = ({ glyph }) =>
    <svg viewBox='0 0 32 32' className='tl-cp-icon'>{APPLET_GLYPHS[glyph]}</svg>
