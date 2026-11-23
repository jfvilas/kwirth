import React from 'react'
import { IContentProps } from '@kwirthmagnify/kwirth-common-front'
import { Box, List, ListItem, ListItemText, Typography } from '@mui/material'
import { Terminal } from '@mui/icons-material'
import { IWrkactjobData } from './WrkactjobData'

export const WrkactjobTabContent: React.FC<IContentProps> = ({ channelObject }) => {
    const data = channelObject?.data as IWrkactjobData
    const messages = data?.messages ?? []

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 2, gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Terminal color='primary' />
                <Typography variant='h6'>WRKACTJOB</Typography>
            </Box>
            {messages.length === 0
                ? <Typography color='text.secondary' variant='body2'>No messages yet. Start the channel to receive data.</Typography>
                : <List dense sx={{ overflow: 'auto', flex: 1 }}>
                    {messages.map((msg, i) => (
                        <ListItem key={i} disablePadding>
                            <ListItemText primary={msg} primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }} />
                        </ListItem>
                    ))}
                  </List>
            }
        </Box>
    )
}
