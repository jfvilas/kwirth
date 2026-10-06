import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Chip, CircularProgress, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'
import { IContentProps, MarkdownViewer } from '@kwirthmagnify/kwirth-common-front'
import { Add, ContentCopy, Send, Settings, Warning } from '@kwirthmagnify/kwirth-common-front/icons'
import { EChapeteCommand, EChapeteRole, IChapeteAskRequest, IChapeteCommandMessage, IChapeteInstanceConfig } from '../common/ChapeteTypes'
import { conversationOf, IChapeteData, IChapeteEntry, isThinking } from './ChapeteData'
import { ChapeteSystemDialog } from './ChapeteSystemDialog'

export const ChapeteTabContent: React.FC<IContentProps> = (props: IContentProps) => {
    const data = props.channelObject.data as IChapeteData
    const instanceConfig = props.channelObject.instanceConfig as IChapeteInstanceConfig
    // The channel repaints when a message arrives from the back end; typing, sending or clearing are local
    // actions and need their own render trigger.
    const [, forceRender] = useState(0)
    const [systemOpen, setSystemOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [containerHeight, setContainerHeight] = useState(0)
    const bottomRef = useRef<HTMLDivElement | null>(null)

    const refresh = () => forceRender(n => n + 1)

    useEffect(() => {
        const observer = new ResizeObserver(() => {
            if (!containerRef.current) return
            setContainerHeight(window.innerHeight - containerRef.current.getBoundingClientRect().top)
        })
        observer.observe(document.body)
        return () => observer.disconnect()
    }, [containerRef.current])

    // the last bubble is always in sight: the question just sent, the 'Thinking...' or the answer
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' })
    }, [data.entries.length, data.entries[data.entries.length - 1]?.pendingId])

    const thinking = isThinking(data.entries)

    const sendCommand = (command: EChapeteCommand, extra: Pick<IChapeteCommandMessage, 'ask' | 'system'>) => {
        if (!props.channelObject.instanceId) return
        // The accessKey goes in EVERY command: without it the core discards it before it reaches the plugin.
        const msg: IChapeteCommandMessage = {
            msgtype: 'chapetemessage',
            channel: 'chapete',
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.REQUEST,
            type: EInstanceMessageType.DATA,
            accessKey: props.channelObject.accessString!,
            instance: props.channelObject.instanceId,
            command,
            ...extra
        }
        props.channelObject.webSocket?.send(JSON.stringify(msg))
    }

    const canSend = (): boolean => Boolean(props.channelObject.instanceId) && !thinking && data.draft.trim() !== ''

    const send = () => {
        if (!canSend()) return
        data.entries.push({ role: EChapeteRole.USER, content: data.draft })
        const ask: IChapeteAskRequest = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            messages: conversationOf(data.entries)
        }
        // the bubble that waits: it shows 'Thinking...' until the answer with this id arrives
        data.entries.push({ role: EChapeteRole.ASSISTANT, content: '', pendingId: ask.id })
        data.draft = ''
        sendCommand(EChapeteCommand.ASK, { ask })
        refresh()
    }

    const onKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            send()
        }
    }

    const newChat = () => {
        data.entries = []
        data.signals = []
        refresh()
    }

    const saveSystem = (system: string) => sendCommand(EChapeteCommand.SETSYSTEM, { system })

    const copy = (text: string) => { navigator.clipboard?.writeText(text) }

    const bubble = (entry: IChapeteEntry, index: number) => {
        const user = entry.role === EChapeteRole.USER
        return (
            <Stack key={index} direction='row' justifyContent={user ? 'flex-end' : 'flex-start'} sx={{ mb: 1.5 }}>
                <Paper variant='outlined' data-testid={user ? 'chapete-user' : 'chapete-assistant'}
                    sx={{ maxWidth: '80%', px: 1.5, py: 1, bgcolor: user ? 'action.hover' : 'background.paper', borderColor: entry.error ? 'error.main' : undefined }}>
                    {user &&
                        <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{entry.content}</Typography>
                    }
                    {!user && entry.pendingId !== undefined &&
                        <Stack direction='row' spacing={1} alignItems='center'>
                            <CircularProgress size={14} />
                            <Typography variant='body2' color='text.secondary' sx={{ fontStyle: 'italic' }}>Thinking...</Typography>
                        </Stack>
                    }
                    {!user && entry.pendingId === undefined && entry.error &&
                        <Stack direction='row' spacing={1} alignItems='flex-start'>
                            <Warning fontSize='small' color='error' />
                            <Typography variant='body2' color='error' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {entry.usageLimit ? `Usage limit reached. ${entry.content}` : entry.content}
                            </Typography>
                        </Stack>
                    }
                    {!user && entry.pendingId === undefined && !entry.error &&
                        <Box>
                            <MarkdownViewer content={entry.content} />
                            <Stack direction='row' justifyContent='flex-end'>
                                <Tooltip title='Copy answer'>
                                    <IconButton size='small' aria-label='Copy answer' onClick={() => copy(entry.content)}><ContentCopy fontSize='small' /></IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>
                    }
                </Paper>
            </Stack>
        )
    }

    if (!data.started) {
        return (
            <Stack ref={containerRef} alignItems='center' justifyContent='center' spacing={1} sx={{ width: '100%', height: `${containerHeight}px`, px: 4, textAlign: 'center' }}>
                <Typography variant='h6' color='text.secondary'>Chapete not started</Typography>
                <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 480 }}>Start the channel (tab settings ⚙ → Start), pick an LLM and start chatting.</Typography>
            </Stack>
        )
    }

    return (
        <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: `${containerHeight}px`, p: 1, boxSizing: 'border-box' }}>
            <Stack direction='row' alignItems='center' spacing={1} sx={{ px: 1, pb: 1 }}>
                <Chip label={`LLM: ${instanceConfig?.llmId || '(none)'}`} size='small' variant='outlined' />
                <Chip label={`Temperature: ${instanceConfig?.temperature ?? '-'}`} size='small' variant='outlined' />
                <Box sx={{ flex: 1 }} />
                <Tooltip title='Start a new conversation'>
                    <span>
                        <IconButton size='small' aria-label='New chat' onClick={newChat} disabled={data.entries.length === 0 || thinking}><Add fontSize='small' /></IconButton>
                    </span>
                </Tooltip>
                <Tooltip title='System prompt of the channel'>
                    <IconButton size='small' aria-label='System prompt' onClick={() => setSystemOpen(true)}><Settings fontSize='small' /></IconButton>
                </Tooltip>
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1 }}>
                {data.entries.length === 0 &&
                    <Stack alignItems='center' justifyContent='center' sx={{ height: '100%' }}>
                        <Typography variant='body2' color='text.secondary'>Ask anything. Enter sends, Shift+Enter adds a new line.</Typography>
                    </Stack>
                }
                {data.entries.map((entry, index) => bubble(entry, index))}
                {data.signals.map((s, index) => <Typography key={`s${index}`} variant='caption' color='text.secondary' component='div'>*** {s} ***</Typography>)}
                <div ref={bottomRef} />
            </Box>

            <Stack direction='row' spacing={1} alignItems='flex-end' sx={{ pt: 1 }}>
                <TextField value={data.draft} onChange={(e) => { data.draft = e.target.value; refresh() }} onKeyDown={onKeyDown}
                    placeholder='Message Chapete...' multiline maxRows={8} fullWidth size='small' disabled={thinking}
                    slotProps={{ htmlInput: { 'aria-label': 'Message' } }} />
                <Button variant='contained' startIcon={<Send />} onClick={send} disabled={!canSend()}>SEND</Button>
            </Stack>

            {systemOpen &&
                <ChapeteSystemDialog system={data.system} onSave={saveSystem} onClose={() => setSystemOpen(false)} />
            }
        </Box>
    )
}
