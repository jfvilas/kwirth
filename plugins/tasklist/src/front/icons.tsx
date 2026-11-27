import React from 'react'
import { SvgIcon, SvgIconProps } from '@mui/material'

/*
    The channel's icon in Kwirth (tabs, the channel list): a monitor with three bars on it, the Task Manager's own
    window icon drawn in one colour. Its own SVG, as the project does for an icon only one plugin uses; the same
    drawing is the 'icon' of package.json.
*/
export const TaskManager = (props: SvgIconProps) => (
    <SvgIcon {...props}>
        <path d='M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v10h16V5zM9 19h6v2H9zM6 11h2v3H6zm4-3h2v6h-2zm4-2h2v8h-2z' fillRule='evenodd' />
    </SvgIcon>
)
