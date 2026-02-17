import { EInstanceConfigObject, EInstanceConfigScope, EInstanceConfigView, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EMetricsConfigMode, IInstanceConfig, IInstanceMessage, InstanceConfigScopeEnum } from '@jfvilas/kwirth-common'
import { TChannelConstructor, EChannelRefreshAction, IChannel, IChannelObject, IContentProps } from '../../IChannel'
import { Box, Dialog, DialogContent, DialogTitle, Divider, IconButton, Popover, Stack, Typography } from '@mui/material'
import { Close, Fullscreen, FullscreenExit, Info, Minimize, PauseCircle, PlayCircle, Settings, StopCircle } from '@mui/icons-material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ELogSortOrder, ILogConfig, ILogInstanceConfig } from '../../log/LogConfig'
import { ILogData } from '../../log/LogData'
import { useEffect, useRef, useState } from 'react'
import { createChannelInstance } from '../../../tools/ChannelTools'
import { ENotifyLevel } from '../../../tools/Global'
import { IMetricsConfig, IMetricsInstanceConfig } from '../../metrics/MetricsConfig'
import { IMetricsData } from '../../metrics/MetricsData'
import { EChartType } from '../../metrics/MenuChart'
import { IOpsData } from '../../ops/OpsData'
import { ESwitchKey, IOpsConfig, IOpsInstanceConfig } from '../../ops/OpsConfig'
import { TerminalManager } from '../../ops/Terminal/TerminalManager'
import { MagnifyUserPreferences } from '../MagnifyUserPreferences'
import { IFilemanData } from '../../fileman/FilemanData'
import { IFilemanConfig } from '../../fileman/FilemanConfig'
import { useAsync } from 'react-use'
import { objectClone } from '../Tools'

export interface IContentExternalOptions {
    pauseable: boolean
    stopable: boolean
    autostart: boolean
    configurable: boolean
}
interface IContentExternalProps {
    title: string
    channelId: string
    contentView: EInstanceConfigView
    settings: MagnifyUserPreferences
    frontChannels: Map<string, TChannelConstructor>
    selectedFiles:IFileObject[]
    onNotify: (channel:string|undefined, level: ENotifyLevel, msg: string) => void
    onMinimize: (content:IContentExternalObject) => void
    onClose: (content:IContentExternalObject) => void
    onRefresh: () => void
    content?: IContentExternalObject
    channelObject?: IChannelObject
    container?: string
    options: IContentExternalOptions
    termId: string|undefined
}

export interface IContentExternalObject {
    type: 'external'
    ws: WebSocket | undefined
    settings: MagnifyUserPreferences
    channel: IChannel
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
    windowMaximized: boolean
    options: IContentExternalOptions
    title: string
    termId: string|undefined
    container?: string
}

const ContentExternal: React.FC<IContentExternalProps> = (props:IContentExternalProps) => {
    const content = useRef<IContentExternalObject>()
    const [ percent, setPercent] = useState<number>(70)
    const [ anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
    const [refreshTick, setRefreshTick] = useState(0);
    const forceUpdate = () => setRefreshTick(tick => tick + 1);

    useEffect( () => {
        // if we receive content, we show content (we don't create a new content)
        if (props.content) {
            content.current = props.content
        }
        else if (props.channelObject) {
            content.current = createContent(props.channelId)
            if (!content.current) return
            switch(props.channelId) {
                case 'log':
                    setLogConfig(content.current)
                    break
                case 'metrics':
                    setMetricsConfig(content.current)
                    break
                case 'ops':
                    setOpsConfig(content.current)
                    break
                case 'fileman':
                    setFilemanConfig(content.current)
                    break
            }
        }
        setPercent(content.current?.windowMaximized? 100 : 70)
    },[])

    useEffect(() => {
        // this Effect must be executed after initial useEffect, because it uses content.current
        if (props.channelId==='ops') {
            console.log('setkey')
            const handleNativeKey = async (e: KeyboardEvent) => {
                if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return

                // we handle first start and restore (the id comes from a different source). This is needed because the id is included in the colusure of the keyboard handle)
                let id = props.termId ||
                    props.selectedFiles[0]?.data?.origin?.metadata?.namespace + '/' + 
                    props.selectedFiles[0]?.data?.origin?.metadata?.name + '/' + 
                    props.container

                const terminalEntry = content.current?.channelObject?.data?.terminalManager?.terminals.get(id)
                const socket = terminalEntry?.socket
                if (!socket || socket.readyState !== WebSocket.OPEN) return

                const key = e.key.toLowerCase();
                let toSend: string | null = null;

                // Ctrl + Shift + C = copy
                if (e.ctrlKey && e.shiftKey && key === 'c') {
                    e.preventDefault();
                    const selectedText = terminalEntry.term ? terminalEntry.term.getSelection() : window.getSelection()?.toString();
                    if (selectedText) await navigator.clipboard.writeText(selectedText);
                    return
                }

                // Ctrl + Shift + V = paste
                if (e.ctrlKey && e.shiftKey && key === 'v') {
                    e.preventDefault()
                    try {
                        const text = await navigator.clipboard.readText()
                        if (text) socket.send(text)
                    }
                    catch (err) {
                        console.error("No se pudo acceder al portapapeles:", err)
                    }
                    return
                }

                toSend = getComplexCode(e)
                if (!toSend && e.ctrlKey) toSend = getControlChar(e.key)
                if (!toSend && e.altKey && e.key.length === 1) toSend = '\x1b' + e.key;
                if (!toSend) toSend = ANSI_MAP[e.key] || (e.key.length === 1 ? e.key : null);

                if (toSend) {
                    e.preventDefault()
                    e.stopPropagation()
                    socket.send(toSend)
                }
            }

            // Use 'true' for the capture phase
            window.addEventListener('keydown', handleNativeKey, true)
            
            return () => {
                window.removeEventListener('keydown', handleNativeKey, true)
            }
        }
    }, [props.container, props.selectedFiles, props.channelObject])

    useAsync (async () => {
        // useAsync must be executed after useEffect, because it uses content.current
        if (props.options.autostart) {
            if (content.current && !content.current.channelStarted) {
                while (content.current?.ws?.readyState !== WebSocket.OPEN) {
                    await new Promise((resolve) => setTimeout(resolve, 10))
                }
                if (content.current?.ws?.readyState === WebSocket.OPEN) play()
            }
        }
    }, [])

    const createContent = (channelId:string) => {
        let newChannel = createChannelInstance(props.frontChannels.get(channelId), props.onNotify)
        if (!newChannel) {
            console.log('Invaid channel instance created')
            return undefined
        }
        let newContent:IContentExternalObject = {
            type: 'external',
            ws: undefined,
            channel: newChannel,
            channelObject: {
                clusterName: props.channelObject?.clusterName!,
                instanceId: '',
                view: props.contentView,
                namespace: [...new Set(props.selectedFiles.map(n => n.data.origin.metadata.namespace))].join(','),
                group: props.contentView === EInstanceConfigView.GROUP? props.selectedFiles.map(g => 'Deployment+'+g.data.origin.metadata.name).join(',') : '',
                pod: props.contentView === EInstanceConfigView.POD? props.selectedFiles.map(p => p.data.origin.metadata.name).join(',') : '',
                container: props.contentView === EInstanceConfigView.CONTAINER? props.selectedFiles[0].data.origin.metadata.name + '+' + props.container : '',
                config: undefined,
                data: undefined,
                instanceConfig: undefined,
                channel: newChannel
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false,
            windowMaximized: false,
            settings: props.settings,
            options: objectClone(props.options),
            title: props.title,
            container: props.container,
            // termId: props.selectedFiles[0]?.data?.origin?.metadata?.namespace + '/' + 
            //             props.selectedFiles[0]?.data?.origin?.metadata?.name + '/' + 
            //             props.container
            termId: props.selectedFiles[0]?.data?.origin?.metadata?.namespace + '/' + 
                    props.selectedFiles[0]?.data?.origin?.metadata?.name.split('+')[0] + '/' + 
                    props.container
        }
        console.log('tedm',newContent.termId)

        if (newChannel.requiresMetrics()) newContent.channelObject.metricsList = props.channelObject?.metricsList
        if (newChannel.requiresClusterUrl()) newContent.channelObject.clusterUrl = props.channelObject?.clusterUrl
        if (newChannel.requiresAccessString()) newContent.channelObject.accessString = props.channelObject?.accessString

        newContent.ws = new WebSocket(props.channelObject?.clusterUrl!)
        newContent.ws.onmessage = (event:MessageEvent) => wsOnMessage(event)
        newContent.ws.onerror = (event) => () => { console.log('WebSocket error:'+event, new Date().toISOString()) }
        newContent.ws.onclose = (event:CloseEvent) => { console.log('WebSocket disconnect:'+event.reason, new Date().toISOString()) }
        return newContent
    }

    const wsOnMessage = (wsEvent:MessageEvent) => {
        let instanceMessage:IInstanceMessage
        try {
            instanceMessage = JSON.parse(wsEvent.data)
        }
        catch (err:any) {
            console.log(err.stack)
            console.log(wsEvent.data)
            return
        }

        if (instanceMessage.action === EInstanceMessageAction.PING || instanceMessage.channel === '') return

        if (props.channelObject!.frontChannels!.has(instanceMessage.channel)) {
            let refreshAction = content.current?.channel.processChannelMessage(content.current?.channelObject!, wsEvent)
            if (refreshAction) {
                if (refreshAction.action === EChannelRefreshAction.REFRESH) {
                    props.onRefresh()
                }
                else if (refreshAction.action === EChannelRefreshAction.STOP) {
                    stop()
                }
            }
        }
        else {
            console.log('Received invalid channel in message: ', instanceMessage)
        }
    }

    const setLogConfig = (c:IContentExternalObject) => {
        let logConfig:ILogConfig = {
            startDiagnostics: false,
            follow: true,
            maxMessages: props.settings.logLines,
            maxPerPodMessages: 5000,
            sortOrder: ELogSortOrder.TIME
        }
        let logInstanceConfig:ILogInstanceConfig = {
            previous: false,
            timestamp: false,
            fromStart: false
        }
        let logData:ILogData = {
            messages: [],
            pending: false,
            backgroundNotification: false,
            counters: new Map(),
            buffers: new Map(),
            paused: false,
            started: false
        }
        c.channelObject!.data = logData
        c.channelObject!.config = logConfig
        c.channelObject!.instanceConfig = logInstanceConfig
    }

    const setMetricsConfig = (c:IContentExternalObject) => {
        let metricsData:IMetricsData = {
            assetMetricsValues: [],
            events: [],
            paused: false,
            started: false
        }
        let metricsConfig:IMetricsConfig = {
            depth: 50,
            width: 2,
            lineHeight: 300,
            configurable: false,
            compact: true,
            legend: true,
            merge: false,
            stack: false,
            chart: EChartType.LineChart,
            metricsDefault: {}
        }
        let metricsInstanceConfig:IMetricsInstanceConfig = {
            mode: EMetricsConfigMode.STREAM,
            aggregate: false,
            interval: 15,
            metrics: ['kwirth_container_cpu_percentage','kwirth_container_memory_percentage', 'kwirth_container_transmit_mbps', 'kwirth_container_receive_mbps', 'kwirth_container_write_mbps', 'kwirth_container_read_mbps']
        }

        c.channelObject!.data = metricsData
        c.channelObject!.config = metricsConfig
        c.channelObject!.instanceConfig = metricsInstanceConfig
    }

    const setOpsConfig = (c:IContentExternalObject) => {
        let opsData:IOpsData = {
            scopedObjects: [],
            paused: false,
            started: false,
            websocketRequest: {
                namespace: '',
                pod: '',
                container: ''
            },
            terminalManager: new TerminalManager(),
            selectedTerminal: undefined
        }
        let onlyContName = c.channelObject.container.split('+')[1]
        let onlyPodName = c.channelObject.container.split('+')[0]
        let opsConfig:IOpsConfig = {
            accessKey: ESwitchKey.DISABLED,
            launchShell: true,
            shell: {
                namespace: c.channelObject.namespace,
                pod: onlyPodName,
                container: onlyContName
            }
        }
        let opsInstanceConfig:IOpsInstanceConfig = {
            sessionKeepAlive: false
        }
        c.channelObject!.webSocket = content.current!.ws
        c.channelObject!.data = opsData
        c.channelObject!.config = opsConfig
        c.channelObject!.instanceConfig = opsInstanceConfig
    }

    const setFilemanConfig = (c:IContentExternalObject) => {
        let filemanData:IFilemanData = {
            paused: false,
            started: false,
            files: [],
            currentPath: ''
        }
        let filemanConfig:IFilemanConfig = {
            notify: props.onNotify
        }

        c.channelObject.webSocket = content.current!.ws
        c.channelObject.data = filemanData
        c.channelObject.config = filemanConfig
    }

    const play = () => {
        if (!content.current || !content.current.ws) return

        if (content.current.channelPaused) {
            content.current.channel.continueChannel(content.current.channelObject)
            let instanceConfig:IInstanceConfig = {
                channel: content.current.channel.channelId,
                objects: EInstanceConfigObject.PODS,
                action: EInstanceMessageAction.CONTINUE,
                flow: EInstanceMessageFlow.REQUEST,
                instance: content.current.channelObject.instanceId,
                accessKey: props.channelObject!.accessString!,
                view: props.contentView,
                scope: InstanceConfigScopeEnum.NONE,
                namespace: '',
                group: '',
                pod: '',
                container: '',
                type: EInstanceMessageType.SIGNAL
            }
            content.current.channelPaused = false
            content.current.ws.send(JSON.stringify(instanceConfig))
        }
        else {
            content.current.channel.startChannel(content.current.channelObject)

            let instanceConfig:IInstanceConfig = {
                channel: content.current.channel.channelId,
                objects: EInstanceConfigObject.PODS,
                action: EInstanceMessageAction.START,
                flow: EInstanceMessageFlow.REQUEST,
                instance: '',
                accessKey: props.channelObject!.accessString!,
                scope: EInstanceConfigScope.NONE,
                view: props.contentView,
                namespace: [...new Set(props.selectedFiles.map(n => n.data.origin.metadata.namespace))].join(','),
                group: props.contentView === EInstanceConfigView.GROUP? props.selectedFiles.map(g => g.data.origin.kind+'+'+g.data.origin.metadata.name).join(',') : '',
                pod: props.contentView === EInstanceConfigView.POD? props.selectedFiles.map(p => p.data.origin.metadata.name).join(',') : '',
                container: props.contentView === EInstanceConfigView.CONTAINER? props.selectedFiles[0].data.origin.metadata.name + '+' + props.container : '',
                type: EInstanceMessageType.SIGNAL,
            }
            instanceConfig.scope = content.current.channel.getScope() || ''
            instanceConfig.data = content.current.channelObject.instanceConfig
            content.current.ws.send(JSON.stringify(instanceConfig))
            content.current.channelStarted = true
            content.current.channelPaused = false

        }
        forceUpdate()
    }

    const pause = () => {
        if (!content.current || !content.current.ws) return

        content.current.channel.pauseChannel(content.current?.channelObject!)

        let instanceConfig:IInstanceConfig = {
            channel: content.current.channel.channelId,
            objects: EInstanceConfigObject.PODS,
            action: EInstanceMessageAction.PAUSE,
            flow: EInstanceMessageFlow.REQUEST,
            instance: content.current.channelObject.instanceId,
            accessKey: props.channelObject!.accessString!,
            view: content.current.channelObject.view,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: EInstanceMessageType.SIGNAL
        }

        content.current.channelPaused = true
        instanceConfig.action = EInstanceMessageAction.PAUSE
        content.current.ws.send(JSON.stringify(instanceConfig))
        forceUpdate()
    }

    const stop = () => {
        if (!content.current || !content.current.ws) return

        let instanceConfig: IInstanceConfig = {
            channel: content.current.channel.channelId,
            objects: EInstanceConfigObject.PODS,
            action: EInstanceMessageAction.STOP,
            flow: EInstanceMessageFlow.REQUEST,
            instance: content.current.channelObject.instanceId,
            accessKey: props.channelObject?.accessString!,
            view: content.current.channelObject.view,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: EInstanceMessageType.SIGNAL
        }
        content.current.channel.stopChannel(content.current.channelObject)
        content.current.ws.send(JSON.stringify(instanceConfig))
        content.current.channelStarted = false
        content.current.channelPaused = false
        forceUpdate()
    }

    const minimize = () => {
        props.onMinimize(content.current!)
    }

    const maximizeOrRestore = () => {
        if (content.current!.windowMaximized) {
            content.current!.windowMaximized = false
            setPercent(70)
        }
        else {
            content.current!.windowMaximized = true
            setPercent(100)
        }
    }

    const close = () => {
        if (!content.current || !content.current.ws) return
        content.current.ws.close()
        props.onClose(content.current)
    }

    const showHelp = () => {
        let content = <></>
        switch(props.channelId) {
            case 'log':
                content = <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>Log</Typography>
                    <Divider/>
                    <Typography fontSize={12}>You can configure log depth (number of lines) on the configuration menu.</Typography>
                    <Typography fontSize={12}>Other configuration options, like Start Diagnostics, are not available to Magnify, but you can use them in log channel.</Typography>
                </>
                break
            case 'metrics':
                content = <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>Metrics</Typography>
                    <Divider/>
                    <Typography fontSize={12}>You can change every individual chart type, but it won't be saved. Next time you'll need to reconfigure it again.</Typography>
                    <Typography fontSize={12}>Data visualization refreshment depends on your Kwirth front configuration, your Magnify configuration.</Typography>
                    <Typography fontSize={12}>On the other side, data freshness depends on Kwirth backend configuration. If you ser a visualization refresh lower than your data freshness, you'll get repeated values on different intervals.</Typography>
                </>
                break
            case 'ops':
                content = <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>Ops</Typography>
                    <Divider/>
                    <Typography fontSize={12}>You can use clipboard functions by pressing <b>Ctrl+Shift+C</b> for copying and <b>Ctrl+Shift+V</b> for pasting</Typography>
                    <Typography fontSize={12}>You can minimize this window and the connection will keep open, or you can close this window and the connection to the container will be closed.</Typography>
                </>
                break
            case 'fileman':
                content = <>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, flexGrow: 1 }}>Fileman</Typography>
                    <Divider/>
                    <Typography fontSize={12}>You can refresh filesystem data everytime you suspect what you are viewing is not acccurate. Just click on top-righ icon to refresh content.</Typography>
                    <Typography fontSize={12}>Upload and Download capabilities depend on your kind of Kiwrth deployment. These actions are not available for all architectures. They should be available, at least, on Kubernetes Deployment. Accessing them via Electron may not be working.</Typography>
                </>
                break
        }
        return <Popover
                anchorEl={anchorEl}
                open={true}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{paper: { sx: { width: 400, maxHeight: 500 } }}}
                onClose={() => setAnchorEl(null)}
            >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'left', gap: 1, flexDirection:'column' }}>
                {content}
            </Box>
        </Popover>
    }

    const showContent = () => {
        if (!content.current || !content.current.channel) return
        let ChannelTabContent = content.current.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: content.current.channelObject!,
        }
        return <ChannelTabContent {...channelProps}/>
    }

    return (
        <>
            <Dialog open={true} fullScreen={percent===100} sx={{ '& .MuiDialog-paper': {
                                        width: `${percent}%`,
                                        height: `${percent}%`,
                                        maxWidth: `${percent}vw`,
                                        maxHeight: `${percent}vh`
                                    }}}
            >
                <DialogTitle>
                    <Stack direction={'row'} alignItems={'center'}>
                        <IconButton onClick={play} disabled={!props.options.autostart || content.current?.channelStarted && !content.current?.channelPaused}>
                            <PlayCircle/>
                        </IconButton>
                        <IconButton onClick={pause} disabled={!props.options.pauseable || !content.current?.channelStarted || content.current?.channelPaused}>
                            <PauseCircle/>
                        </IconButton>
                        <IconButton onClick={stop} disabled={!props.options.stopable || !content.current?.channelStarted}>
                            <StopCircle/>
                        </IconButton>
                        <IconButton disabled={!props.options.configurable}>
                            <Settings/>
                        </IconButton>
                        <IconButton onClick={(event) => setAnchorEl(event.currentTarget)}>
                            <Info/>
                        </IconButton>
                        
                        <Typography sx={{flexGrow:1}}></Typography>
                        <Typography>{content.current?.channel.getChannelIcon()}&nbsp;{props.title}</Typography>
                        <Typography sx={{flexGrow:1}}></Typography>
                        <IconButton onClick={minimize}>
                            <Minimize />
                        </IconButton>
                        <IconButton onClick={maximizeOrRestore}>
                            { content.current?.windowMaximized? <FullscreenExit/> : <Fullscreen/> }
                        </IconButton>
                        <IconButton onClick={close}>
                            <Close />
                        </IconButton>
                    </Stack>
                </DialogTitle>


                <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden', height: '100%', minHeight: 0, paddingBottom: 1}}>
                    {showContent()}
                </DialogContent>
            </Dialog>        
            {anchorEl && showHelp()}
        </>
    )
}

const ANSI_MAP: Record<string, string> = {
    'ArrowUp':    '\x1b[A',
    'ArrowDown':  '\x1b[B',
    'ArrowRight': '\x1b[C',
    'ArrowLeft':  '\x1b[D',
    'Home':       '\x1b[H',
    'End':        '\x1b[F',
    'PageUp':     '\x1b[5~',
    'PageDown':   '\x1b[6~',
    'Insert':     '\x1b[2~',
    'Delete':     '\x1b[3~',

    // Teclas de control básicas
    'Backspace':  '\x7f',    // A veces \x08 según el sistema
    'Tab':        '\t',
    'Enter':      '\r',
    'Escape':     '\x1b',

    // F1 - F12 (Varían según el terminal, estos son los comunes de xterm)
    'F1':  '\x1bOP',
    'F2':  '\x1bOQ',
    'F3':  '\x1bOR',
    'F4':  '\x1bOS',
    'F5':  '\x1b[15~',
    'F6':  '\x1b[17~',
    'F7':  '\x1b[18~',
    'F8':  '\x1b[19~',
    'F9':  '\x1b[20~',
    'F10': '\x1b[21~',
    'F11': '\x1b[23~',
    'F12': '\x1b[24~',
};


const getComplexCode = (e: KeyboardEvent): string | null => {
    const { key, ctrlKey, altKey, shiftKey } = e

    let modifier = 1
    if (shiftKey) modifier += 1
    if (altKey)   modifier += 2
    if (ctrlKey)  modifier += 4

    if (modifier === 1) return null

    const F1_F4: Record<string, string> = { 'F1': 'P', 'F2': 'Q', 'F3': 'R', 'F4': 'S' }
    if (F1_F4[key]) return `\x1b[1;${modifier}${F1_F4[key]}`

    const F5_F12: Record<string, number> = {
        'F5': 15, 'F6': 17, 'F7': 18, 'F8': 19, 'F9': 20, 'F10': 21, 'F11': 23, 'F12': 24
    }
    if (F5_F12[key]) return `\x1b[${F5_F12[key]};${modifier}~`

    // 5. Mapeo para Flechas y navegación
    const Nav: Record<string, string> = {
        'ArrowUp': 'A', 'ArrowDown': 'B', 'ArrowRight': 'C', 'ArrowLeft': 'D',
        'Home': 'H', 'End': 'F'
    };
    if (Nav[key]) return `\x1b[1;${modifier}${Nav[key]}`

    // 6. Mapeo para Edición (Insert, Delete, etc.)
    const Edit: Record<string, number> = { 'Insert': 2, 'Delete': 3, 'PageUp': 5, 'PageDown': 6 }
    if (Edit[key]) return `\x1b[${Edit[key]};${modifier}~`

    return null
}

function getControlChar(key: string): string | null {
    const charCode = key.toLowerCase().charCodeAt(0)
    if (charCode >= 97 && charCode <= 122) return String.fromCharCode(charCode - 96)
    
    return null
}

export { ContentExternal }