import React, { useState } from 'react'
import { ChannelNotStarted, IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { Box, Stack } from '@mui/material'
import { ISdsfData } from './SdsfData'
import { SdsfIcon } from './SdsfSetup'
import { TerminalView } from './terminal/TerminalView'
import { I3270KeyAction } from '../common/terminal/Terminal3270Types'

export const SdsfTabContent: React.FC<IContentProps> = ({ channelObject }) => {
    const data = channelObject?.data as ISdsfData | undefined
    // The session lives in channelObject.data; this only makes React repaint after each key.
    const [, setRevision] = useState(0)

    if (!data?.started || !data.session) {
        return (
            <Stack sx={{ height: '60vh', alignItems: 'center', justifyContent: 'center', px: 4 }}>
                <ChannelNotStarted icon={<Box sx={{ display: 'flex', color: 'primary.main' }}>{SdsfIcon}</Box>} name='SDSF'
                    hint='SDSF not started. Start the channel to open a session on this cluster.' channelObject={channelObject} />
            </Stack>
        )
    }

    const session = data.session
    const onKey = (action: I3270KeyAction): void => {
        if (session.key(action)) {
            data.revision++
            setRevision(data.revision)
        }
    }

    // Set by the core: the tab in full screen. The terminal then takes the whole window.
    const fullscreen = channelObject.isFullscreen === true

    return <TerminalView terminal={session.terminal} revision={data.revision} onKey={onKey} fullscreen={fullscreen} />
}
