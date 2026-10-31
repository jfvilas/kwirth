import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

/*
    The icon that identifies this plugin: a comic thought balloon — a wide, low cloud and two bubbles trailing
    down to the right from its lower right side.

    It lives HERE and not in the kwirth barrel because it is this plugin's own: the barrel is for the common
    icons and cannot grow with the icon of every plugin. `SvgIcon` comes from `@mui/material`, which the build
    resolves against the core's global, so this adds no dependencies.

    ⚠️ The SAME drawing is declared as raw SVG in the `icon` field of package.json. That one is what the CORE
    paints (managers, marketplace) through `resolveExtensionIcon`, sanitised with an allow list that keeps
    path, circle, fill and stroke; this one is what the plugin itself uses. If one changes, the other must too.
*/

export const ChapeteThought = (props: SvgIconProps) => (
    <SvgIcon {...props} viewBox='0 0 24 24'>
        <path d='M6 14A3 3 0 0 1 5.2 8.2A3.6 3.6 0 0 1 11.6 5.6A3.5 3.5 0 0 1 18.2 7.6A3.05 3.05 0 0 1 17.6 13.6A12 12 0 0 1 6 14Z'
            fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' />
        <circle cx='18.6' cy='17.4' r='1.6' fill='currentColor' />
        <circle cx='21.3' cy='20.7' r='1.05' fill='currentColor' />
    </SvgIcon>
)
