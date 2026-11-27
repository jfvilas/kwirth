import React, { useEffect, useRef, useState } from 'react'
import { ChannelNotStarted, IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { Box, Stack } from '@mui/material'
import { ITasklistData } from './TasklistData'
import { TasklistIcon } from './TasklistSetup'
import { TaskManagerWindow } from './window/TaskManagerWindow'
import { injectLunaStyle } from './luna/LunaStyle'
import { loadLunaFont } from './luna/LunaFont'

export const TasklistTabContent: React.FC<IContentProps> = ({ channelObject }) => {
    const data = channelObject?.data as ITasklistData | undefined
    const session = data?.started ? data.session : undefined
    // The session lives in channelObject.data and says when it changed — a snapshot, a click. This only turns
    // that into a React repaint.
    const [, setRevision] = useState(0)
    useEffect(() => session?.subscribe(() => setRevision(r => r + 1)), [session])

    useEffect(() => {
        injectLunaStyle()
        void loadLunaFont().then(() => setRevision(r => r + 1))
    }, [])

    /*
        The space left down to the bottom of the page (the project's height pattern): the top is measured against
        the PAGE, never the viewport, or a scrolled page would make the window grow for ever.
    */
    const containerRef = useRef<HTMLDivElement>(null)
    const [size, setSize] = useState({ width: 0, height: 0 })
    useEffect(() => {
        const measure = () => {
            const box = containerRef.current?.getBoundingClientRect()
            if (!box) return
            const top = box.top + window.scrollY
            setSize({ width: Math.floor(box.width), height: Math.max(200, Math.floor(window.innerHeight - top - 4)) })
        }
        const observer = new ResizeObserver(measure)
        observer.observe(document.body)
        if (containerRef.current) observer.observe(containerRef.current)
        measure()
        return () => observer.disconnect()
        // the tab going full screen moves the window's top without resizing the body: measure again
    }, [session, channelObject.isFullscreen])

    if (!session) {
        return (
            <Stack sx={{ height: '60vh', alignItems: 'center', justifyContent: 'center', px: 4 }}>
                <ChannelNotStarted icon={<Box sx={{ display: 'flex', color: 'primary.main' }}>{TasklistIcon}</Box>} name='Task Manager'
                    hint='Task Manager not started. Start the channel to see the processes, performance and network of this cluster.' channelObject={channelObject} />
            </Stack>
        )
    }

    return (
        <div ref={containerRef} style={{ width: '100%', height: size.height }} data-testid='tasklist-window-host'>
            {size.width > 0 && <TaskManagerWindow session={session} width={size.width} height={size.height} />}
        </div>
    )
}
