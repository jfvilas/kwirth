import { IInstanceConfig, IInstanceMessage, InstanceConfigObjectEnum, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, MetricsConfigModeEnum } from '@jfvilas/kwirth-common'
import { TChannelConstructor, EChannelRefreshAction, IChannel, IChannelObject, IContentProps } from '../../IChannel'
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { Close, Fullscreen, FullscreenExit, Maximize, Minimize, PauseCircle, PlayCircle, SettingsApplicationsOutlined, StopCircle } from '@mui/icons-material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ELogSortOrderEnum, ILogConfig, ILogInstanceConfig } from '../../log/LogConfig'
import { ILogData } from '../../log/LogData'
import { useEffect, useRef, useState } from 'react'
import { createChannelInstance } from '../../../tools/Channel'
import { ENotifyLevel } from '../../../tools/Global'
import { IMetricsConfig, IMetricsInstanceConfig } from '../../metrics/MetricsConfig'
import { IMetricsData } from '../../metrics/MetricsData'
import { EChartType } from '../../metrics/MenuChart'
import { IOpsData } from '../../ops/OpsData'
import { ESwitchKeyEnum, IOpsConfig, IOpsInstanceConfig } from '../../ops/OpsConfig'
import { TerminalManager } from '../../ops/Terminal/TerminalManager'
import { MagnifyUserSettings } from '../MagnifyUserSettings'

interface IExternalContentProps {
    title: string
    channelId?: string
    settings: MagnifyUserSettings
    frontChannels: Map<string, TChannelConstructor>
    selectedFiles:IFileObject[]
    notify: (level: ENotifyLevel, msg: string) => void
    minimize: (content:IExternalContentObject) => void
    close: (content:IExternalContentObject) => void
    doRefresh: () => void
    content?: IExternalContentObject
    channelObject?: IChannelObject
    contentView: InstanceConfigViewEnum
    container?: string
}

export interface IExternalContentObject {
    ws: WebSocket | undefined
    settings: MagnifyUserSettings
    channel: IChannel
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
    windowMaximized: boolean
}

const ExternalContent: React.FC<IExternalContentProps> = (props:IExternalContentProps) => {
    const content = useRef<IExternalContentObject>()
    const [ percent, setPercent] = useState<number>(70)
   
    useEffect( () => {
        // if we receive content, we show content (we don't create a new content)
        if (props.content) {
            content.current = props.content
        }
        else if (props.channelObject) {
            content.current = createContent(props.channelId!,props.container)
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

    const createContent = (channelId:string, container?:string) => {
        let newChannel = createChannelInstance(props.frontChannels.get(channelId), props.notify)
        if (!newChannel) {
            console.log('Invaid channel instance created')
            return undefined
        }
        let newContent:IExternalContentObject = {
            ws: undefined,
            channel: newChannel,
            channelObject: {
                clusterName: props.channelObject?.clusterName!,
                instanceId: '',
                view: props.contentView,
                // namespace: props.selectedFiles[0].data.origin.metadata.namespace,
                // group: '',
                // pod: props.selectedFiles[0].data.origin.metadata.name,
                // container: container || '',
                //namespace: props.selectedFiles[0].data.origin.metadata.namespace,   //+++
                namespace: [...new Set(props.selectedFiles.map(n => n.data.origin.metadata.namespace))].join(','),
                //group: props.contentView === InstanceConfigViewEnum.GROUP? 'Deployment+'+props.selectedFiles[0].data.origin.metadata.name : '',
                group: props.contentView === InstanceConfigViewEnum.GROUP? props.selectedFiles.map(g => 'Deployment+'+g.data.origin.metadata.name).join(',') : '',
                //pod: props.contentView === InstanceConfigViewEnum.POD? props.selectedFiles[0].data.origin.metadata.name : '',
                pod: props.contentView === InstanceConfigViewEnum.POD? props.selectedFiles.map(p => p.data.origin.metadata.name).join(',') : '',
                container: props.contentView === InstanceConfigViewEnum.CONTAINER? props.selectedFiles[0].data.origin.metadata.name + '+' + props.container : '',
                config: undefined,
                data: undefined,
                instanceConfig: undefined
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

        if (instanceMessage.action === InstanceMessageActionEnum.PING || instanceMessage.channel === '') return

        if (props.channelObject!.frontChannels!.has(instanceMessage.channel)) {
            let refreshAction = content.current?.channel.processChannelMessage(content.current?.channelObject!, wsEvent)
            if (refreshAction) {
                if (refreshAction.action === EChannelRefreshAction.REFRESH) {
                    props.doRefresh()
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

    const setLogConfig = (c:IExternalContentObject) => {
        let logConfig:ILogConfig = {
            startDiagnostics: false,
            follow: true,
            maxMessages: props.settings.logLines,
            maxPerPodMessages: 5000,
            sortOrder: ELogSortOrderEnum.TIME
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

    const setMetricsConfig = (c:IExternalContentObject) => {
        let metricsData:IMetricsData = {
            assetMetricsValues: [],
            events: [],
            paused: false,
            started: false
        }
        let metricsConfig:IMetricsConfig = {
            depth: 50,
            width: 2,
            merge: false,
            stack: false,
            chart: EChartType.LineChart,
            metricsDefault: {}
        }
        let metricsInstanceConfig:IMetricsInstanceConfig = {
            mode: MetricsConfigModeEnum.STREAM,
            aggregate: false,
            interval: 15,
            metrics: ['kwirth_container_cpu_percentage','kwirth_container_memory_percentage', 'kwirth_container_transmit_mbps', 'kwirth_container_receive_mbps', 'kwirth_container_write_mbps', 'kwirth_container_read_mbps']
        }

        c.channelObject!.data = metricsData
        c.channelObject!.config = metricsConfig
        c.channelObject!.instanceConfig = metricsInstanceConfig
    }

    const setOpsConfig = (c:IExternalContentObject) => {
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
            accessKey: ESwitchKeyEnum.DISABLED,
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
                objects: InstanceConfigObjectEnum.PODS,
                action: InstanceMessageActionEnum.CONTINUE,
                flow: InstanceMessageFlowEnum.REQUEST,
                instance: content.current.channelObject.instanceId,
                accessKey: props.channelObject!.accessString!,
                view: props.contentView,
                scope: InstanceConfigScopeEnum.NONE,
                namespace: '',
                group: '',
                pod: '',
                container: '',
                type: InstanceMessageTypeEnum.SIGNAL
            }
            content.current.channelPaused = false
            content.current.ws.send(JSON.stringify(instanceConfig))
        }
        else {
            content.current.channel.startChannel(content.current.channelObject)

            let instanceConfig:IInstanceConfig = {
                channel: content.current.channel.channelId,
                objects: InstanceConfigObjectEnum.PODS,
                action: InstanceMessageActionEnum.START,
                flow: InstanceMessageFlowEnum.REQUEST,
                instance: '',
                accessKey: props.channelObject!.accessString!,
                scope: InstanceConfigScopeEnum.NONE,
                view: props.contentView,
                // namespace: props.selectedFiles[0].data.origin.metadata.namespace,   //+++
                // group: '',
                // pod: props.selectedFiles[0].data.origin.metadata.name,   //+++
                // container: props.selectedFiles[0].data.origin.metadata.name + '+' + props.container,
                //namespace: props.selectedFiles[0].data.origin.metadata.namespace,   //+++
                namespace: [...new Set(props.selectedFiles.map(n => n.data.origin.metadata.namespace))].join(','),
                //group: props.contentView === InstanceConfigViewEnum.GROUP? 'Deployment+'+props.selectedFiles[0].data.origin.metadata.name : '',
                group: props.contentView === InstanceConfigViewEnum.GROUP? props.selectedFiles.map(g => g.data.origin.kind+'+'+g.data.origin.metadata.name).join(',') : '',
                //pod: props.contentView === InstanceConfigViewEnum.POD? props.selectedFiles[0].data.origin.metadata.name : '',
                pod: props.contentView === InstanceConfigViewEnum.POD? props.selectedFiles.map(p => p.data.origin.metadata.name).join(',') : '',
                container: props.contentView === InstanceConfigViewEnum.CONTAINER? props.selectedFiles[0].data.origin.metadata.name + '+' + props.container : '',
                type: InstanceMessageTypeEnum.SIGNAL,
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
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.PAUSE,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: content.current.channelObject.instanceId,
            accessKey: props.channelObject!.accessString!,
            view: content.current.channelObject.view,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: InstanceMessageTypeEnum.SIGNAL
        }

        content.current.channelPaused = true
        instanceConfig.action = InstanceMessageActionEnum.PAUSE
        content.current.ws.send(JSON.stringify(instanceConfig))
    }

    const stop = () => {
        if (!content.current || !content.current.ws) return

        let instanceConfig: IInstanceConfig = {
            channel: content.current.channel.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.STOP,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: content.current.channelObject.instanceId,
            accessKey: props.channelObject?.accessString!,
            view: content.current.channelObject.view,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: InstanceMessageTypeEnum.SIGNAL
        }
        content.current.channel.stopChannel(content.current.channelObject)
        content.current.ws.send(JSON.stringify(instanceConfig))
        content.current.channelStarted = false
        content.current.channelPaused = false
    }

    const minimize = () => {
        props.minimize(content.current!)
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
        props.close(content.current)
    }

    const showContent = () => {
        if (!content.current || !content.current.channel) return
        let ChannelTabContent = content.current.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: content.current.channelObject!,
            //maxHeight: 300
        }
        // switch(content.current.channel.channelId) {
        //     case 'log':
        //         channelProps.maxHeight = 450
        //         break
        //     case 'ops':
        //         channelProps.maxHeight = 560
        //         break
        // }
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
                        <SettingsApplicationsOutlined/>
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
export { ExternalContent }