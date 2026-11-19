import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

/*
    The icon that identifies this plugin. It lives HERE, not in the kwirth icon barrel: a plugin only gets
    from `@mui/icons-material` what the core's barrel exports at runtime, and an icon missing there arrives as
    undefined and takes the whole tab down. `SvgIcon` comes from `@mui/material`, already a core global.

    A solid pixelated submarine on a 24x24 grid, always in its own blue (not the theme colour).

    ⚠️ The SAME drawing and colour are declared as raw SVG in the `icon` field of package.json, which is the one
    the core paints (managers, marketplace). If one changes, change the other.
*/
export const ICON_BLUE = '#4585CA'
const SUBMARINE_PIXELS = 'M4 12h16v1H4zM2 13h20v4H2zM4 17h16v1H4zM9 8h6v4H9zM11 4h2v4h-2zM13 4h3v2h-3z'

export const Submarine = (props: SvgIconProps) => (
    <SvgIcon htmlColor={ICON_BLUE} {...props}>
        <path d={SUBMARINE_PIXELS} fill='currentColor' shapeRendering='crispEdges' />
    </SvgIcon>
)

export const AbyssPatrolIcon = <Submarine />
