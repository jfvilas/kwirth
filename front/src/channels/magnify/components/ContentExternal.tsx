import { EInstanceConfigObject, EInstanceConfigScope, EInstanceConfigView, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EMetricsConfigMode, IInstanceConfig, IInstanceMessage, InstanceConfigScopeEnum } from '@jfvilas/kwirth-common'
import { TChannelConstructor, EChannelRefreshAction, IChannel, IChannelObject, IContentProps } from '../../IChannel'
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { Close, Fullscreen, FullscreenExit, Minimize, PauseCircle, PlayCircle, Settings, StopCircle } from '@mui/icons-material'
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

interface IContentExternalProps {
    title: string
    channelId: string
    settings: MagnifyUserPreferences
    frontChannels: Map<string, TChannelConstructor>
    selectedFiles:IFileObject[]
    onNotify: (channel:IChannel|undefined, level: ENotifyLevel, msg: string) => void
    onMinimize: (content:IContentExternalObject) => void
    onClose: (content:IContentExternalObject) => void
    onRefresh: () => void
    contentView: EInstanceConfigView
    content?: IContentExternalObject
    channelObject?: IChannelObject
    container?: string
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
}

const ContentExternal: React.FC<IContentExternalProps> = (props:IContentExternalProps) => {
    const content = useRef<IContentExternalObject>()
    const [ percent, setPercent] = useState<number>(70)
   
    // useEffect(() => {
    //     const previousFocus = document.activeElement as HTMLElement

    //     const handleKeyDown = (event: KeyboardEvent) => {
    //         event.stopPropagation()
    //         if (event.key === 'Escape') props.onClose(content.current!)
    //     }

    //     window.addEventListener('keydown', handleKeyDown, true)
    //     return () => {
    //         window.removeEventListener('keydown', handleKeyDown, true)
    //         previousFocus?.focus()
    //     }
    // }, [])

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
            }
        }
        setPercent(content.current?.windowMaximized? 100 : 70)
    },[])

    const createContent = (channelId:string) => {
        console.log(channelId)
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
            settings: props.settings
        }

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
        let opsConfig:IOpsConfig = {
            accessKey: ESwitchKey.DISABLED,
            launchShell: true,
            shell: {
                namespace: c.channelObject.namespace,
                pod: c.channelObject.pod,
                container: c.channelObject.container
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

    const showContent = () => {
        if (!content.current || !content.current.channel) return
        let ChannelTabContent = content.current.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: content.current.channelObject!,
        }
        return <ChannelTabContent {...channelProps}/>
    }

    return (
        <Dialog open={true} sx={{ '& .MuiDialog-paper': {
                                    width: `${percent}vw`,
                                    height: `${percent}vh`,
                                    maxWidth: `${percent}vw`,
                                    maxHeight: `${percent}vh`
                                }}
        }>
            <DialogTitle>
                <Stack direction={'row'} alignItems={'center'}>
                    <IconButton onClick={play} disabled={content.current?.channelStarted && !content.current?.channelPaused}>
                        <PlayCircle/>
                    </IconButton>
                    <IconButton onClick={pause} disabled={!content.current?.channelStarted || content.current?.channelPaused}>
                        <PauseCircle/>
                    </IconButton>
                    <IconButton onClick={stop} disabled={!content.current?.channelStarted}>
                        <StopCircle/>
                    </IconButton>
                    <IconButton>
                        <Settings/>
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
    )
}
export { ContentExternal }