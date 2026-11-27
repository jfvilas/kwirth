import React from 'react'

/*
    The Task Manager's own icons, drawn here (PRD D2): none of Microsoft's, and no Windows logo anywhere.
*/

// The window's: a small monitor with three green bars on it.
export const WindowIcon = (): JSX.Element => (
    <svg viewBox='0 0 16 16' className='tl-title-icon'>
        <rect x='1' y='1.5' width='14' height='10' rx='1' fill='#dfe8f6' stroke='#26457c' />
        <rect x='2.5' y='3' width='11' height='7' fill='#0b1b0b' />
        <rect x='4' y='7' width='2' height='2.5' fill='#1ee81e' />
        <rect x='7' y='5' width='2' height='4.5' fill='#1ee81e' />
        <rect x='10' y='4' width='2' height='5.5' fill='#1ee81e' />
        <rect x='5' y='12' width='6' height='1.5' fill='#7d8aa3' />
        <rect x='3.5' y='13.5' width='9' height='1.5' rx='.5' fill='#b4bfd1' stroke='#5d6a82' strokeWidth='.5' />
    </svg>
)

// An application (a Deployment): a little window of its own.
export const ApplicationIcon = (): JSX.Element => (
    <svg viewBox='0 0 16 16'>
        <rect x='1.5' y='2.5' width='13' height='11' rx='1' fill='#fff' stroke='#3c5a8c' />
        <rect x='1.5' y='2.5' width='13' height='3' rx='1' fill='#2f6be0' />
        <rect x='3' y='7' width='5' height='1' fill='#9aaac5' />
        <rect x='3' y='9' width='8' height='1' fill='#9aaac5' />
        <rect x='3' y='11' width='6' height='1' fill='#9aaac5' />
    </svg>
)

// A process (a pod), for its Properties.
export const ProcessIcon = (): JSX.Element => (
    <svg viewBox='0 0 32 32' style={{ width: 32, height: 32 }}>
        <rect x='3' y='5' width='26' height='22' rx='2' fill='#fff' stroke='#3c5a8c' strokeWidth='1.5' />
        <rect x='3' y='5' width='26' height='5' rx='2' fill='#2f6be0' />
        <rect x='7' y='14' width='4' height='4' fill='#3c9a3c' />
        <rect x='14' y='14' width='4' height='4' fill='#3c9a3c' />
        <rect x='21' y='14' width='4' height='4' fill='#3c9a3c' />
        <rect x='7' y='20' width='18' height='2' fill='#9aaac5' />
    </svg>
)

export const WarningIcon = (): JSX.Element => (
    <svg viewBox='0 0 32 32'>
        <path d='M16 2.5 L30.5 28.5 H1.5 Z' fill='#fcd226' stroke='#8a6b00' strokeWidth='1.2' strokeLinejoin='round' />
        <rect x='14.4' y='10' width='3.2' height='11' rx='1.2' fill='#000' />
        <circle cx='16' cy='24.5' r='1.9' fill='#000' />
    </svg>
)

export const ErrorIcon = (): JSX.Element => (
    <svg viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='14' fill='#e0301e' stroke='#8c1206' strokeWidth='1.2' />
        <path d='M10 10 L22 22 M22 10 L10 22' stroke='#fff' strokeWidth='3.4' strokeLinecap='round' />
    </svg>
)

export const InfoIcon = (): JSX.Element => (
    <svg viewBox='0 0 32 32'>
        <circle cx='16' cy='16' r='14' fill='#fff' stroke='#2a5ec8' strokeWidth='2' />
        <circle cx='16' cy='9.5' r='2.2' fill='#2a5ec8' />
        <rect x='14' y='13.5' width='4' height='11' rx='1' fill='#2a5ec8' />
    </svg>
)

// The big one on the Create New Task dialog.
export const RunIcon = (): JSX.Element => (
    <svg viewBox='0 0 32 32'>
        <rect x='3' y='6' width='22' height='18' rx='2' fill='#fff' stroke='#3c5a8c' strokeWidth='1.5' />
        <rect x='3' y='6' width='22' height='4' rx='2' fill='#2f6be0' />
        <path d='M17 18 L29 18 L25 14 M29 18 L25 22' stroke='#3c9a3c' strokeWidth='2.4' fill='none' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
)

export const CheckMark = (): JSX.Element => (
    <svg viewBox='0 0 9 9'>
        <path d='M1 4.5 L3.5 7 L8 1.5' stroke='#21a121' strokeWidth='2' fill='none' />
    </svg>
)

export const MenuCheck = (): JSX.Element => (
    <svg viewBox='0 0 10 10' className='tl-menu-check'>
        <path d='M1.5 5 L4 7.5 L8.5 2' stroke='currentColor' strokeWidth='1.8' fill='none' />
    </svg>
)

export const MenuRadio = (): JSX.Element => (
    <svg viewBox='0 0 10 10' className='tl-menu-check'>
        <circle cx='5' cy='5' r='2.5' fill='currentColor' />
    </svg>
)

export const MinimizeGlyph = (): JSX.Element => (
    <svg viewBox='0 0 13 13'><rect x='3' y='9' width='6' height='2' fill='#fff' /></svg>
)

export const MaximizeGlyph = (): JSX.Element => (
    <svg viewBox='0 0 13 13'><rect x='2.5' y='2.5' width='8' height='8' fill='none' stroke='#fff' strokeWidth='1' /><rect x='2' y='2' width='9' height='2' fill='#fff' /></svg>
)

export const RestoreGlyph = (): JSX.Element => (
    <svg viewBox='0 0 13 13'>
        <rect x='4.5' y='1.5' width='7' height='6' fill='none' stroke='#fff' /><rect x='4' y='1' width='8' height='2' fill='#fff' />
        <rect x='1.5' y='5.5' width='7' height='6' fill='#1f5bd8' stroke='#fff' /><rect x='1' y='5' width='8' height='2' fill='#fff' />
    </svg>
)

export const CloseGlyph = (): JSX.Element => (
    <svg viewBox='0 0 13 13'><path d='M3 3 L10 10 M10 3 L3 10' stroke='#fff' strokeWidth='2' /></svg>
)
