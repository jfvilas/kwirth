import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

/*
    The icon that identifies this plugin.

    It lives HERE and not in the kwirth barrel because it is ITS OWN: the barrel is for the common icons, and it cannot
    grow with the icon of every plugin in existence — it travels in the front-end bundle, which everybody
    downloads. `SvgIcon` comes from `@mui/material`, which the build already resolves against the core's global, so
    this adds no dependencies.

    ⚠️ The SAME drawing is declared as raw SVG in the `icon` field of package.json. That is the one the
    CORE paints (managers, marketplace) via `resolveExtensionIcon`, which sanitises it with an allow list; this
    is the one the plugin itself uses. If one is changed, the other has to be changed too.

    The path is from Material Icons (Apache-2.0).
*/

export const RocketLaunch = (props: SvgIconProps) => (
    <SvgIcon {...props}><path d="M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81zM9 18c0 .83-.34 1.58-.88 2.12C6.94 21.3 2 22 2 22s.7-4.94 1.88-6.12C4.42 15.34 5.17 15 6 15c1.66 0 3 1.34 3 3m4-9c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2" /></SvgIcon>
)
