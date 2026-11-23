import React, { useEffect, useState } from 'react'
import { ChannelNotStarted, IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { Box, Stack } from '@mui/material'
import { ISdsfData } from './SdsfData'
import { SdsfIcon } from './SdsfSetup'
import { TerminalView } from './terminal/TerminalView'

export const SdsfTabContent: React.FC<IContentProps> = ({ channelObject }) => {
    const data = channelObject?.data as ISdsfData | undefined
    const session = data?.started ? data.session : undefined
    // The session lives in channelObject.data and says when its screen changed — after a key, and also when an
    // answer from the back arrives later. This only turns that into a React repaint.
    const [revision, setRevision] = useState(0)
    useEffect(() => session?.subscribe(() => setRevision(r => r + 1)), [session])

    if (!session) {
        return (
            <Stack sx={{ height: '60vh', alignItems: 'center', justifyContent: 'center', px: 4 }}>
                <ChannelNotStarted icon={<Box sx={{ display: 'flex', color: 'primary.main' }}>{SdsfIcon}</Box>} name='SDSF'
                    hint='SDSF not started. Start the channel to open a session on this cluster.' channelObject={channelObject} />
            </Stack>
        )
    }

    // Set by the core: the tab in full screen. The terminal then takes the whole window.
    return <TerminalView terminal={session.terminal} revision={revision} onKey={session.key} fullscreen={channelObject.isFullscreen === true} display={data!.display} />
}
