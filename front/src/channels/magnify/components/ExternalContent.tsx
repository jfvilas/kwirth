import { IInstanceConfig, IInstanceMessage, InstanceConfigObjectEnum, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceMessageActionEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum } from '@jfvilas/kwirth-common'
import { TChannelConstructor, EChannelRefreshAction, IChannel, IChannelObject, IContentProps } from '../../IChannel'
import { Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material'
import { Close, Maximize, Minimize, PauseCircle, PlayCircle, StopCircle } from '@mui/icons-material'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ELogSortOrderEnum, ILogConfig, ILogInstanceConfig } from '../../log/LogConfig'
import { ILogData } from '../../log/LogData'
import { useEffect, useRef, useState } from 'react'
import { createChannelInstance } from '../../../tools/Channel'
import { ENotifyLevel } from '../../../tools/Global'

interface IExternalContentProps {
    channelId?: string
    frontChannels: Map<string, TChannelConstructor>
    selectedFiles:IFileObject[]
    notify: (level: ENotifyLevel, msg: string) => void
    minimize: (content:IExternalContentObject) => void
    close: (content:IExternalContentObject) => void
    doRefresh: () => void
    content?: IExternalContentObject
    channelObject?: IChannelObject
}

export interface IExternalContentObject {
    ws: WebSocket | undefined
    channel: IChannel
    channelObject: IChannelObject
    channelStarted: boolean
    channelPaused: boolean
    channelPending: boolean
}

const ExternalContent: React.FC<IExternalContentProps> = (props:IExternalContentProps) => {
    const content = useRef<IExternalContentObject>()
   
    useEffect( () => {
        // if we receive content, we show content (we don't create a new content)
        if (props.content) {
            content.current = props.content
        }
        else if (props.channelObject) {
            console.log('create********************')
            content.current = createContent(props.channelId!,props.selectedFiles)
            if (!content.current) return
            switch(props.channelId) {
                case 'log':
                    setLogConfig(content.current)
                    break
                case 'metrics':
                    setMetricsConfig(content.current)
                    break
            }
        }
    },[])

    const createContent = (channelId:string, f:IFileObject[]) => {
        let newChannel = createChannelInstance(props.frontChannels.get(channelId), props.notify)
        if (!newChannel) {
            console.log('Invaid channel instance created')
            return undefined
        }
        let newContent:IExternalContentObject = {
            ws:undefined,
            channel: newChannel,
            channelObject: {
                clusterName: props.channelObject?.clusterName!,
                instanceId: '',
                view: InstanceConfigViewEnum.POD,  //+++
                namespace: props.selectedFiles[0].data.origin.metadata.namespace,   //+++
                group: '',
                pod: props.selectedFiles[0].data.origin.metadata.name,  //+++
                container: '',
                config: undefined,
                data: undefined,
                instanceConfig: undefined
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false
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
            maxMessages: 5000,
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
                view: content.current.channelObject.view,
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
                view: InstanceConfigViewEnum.POD,
                namespace: props.selectedFiles[0].data.origin.metadata.namespace,   //+++
                group: '',
                pod: props.selectedFiles[0].data.origin.metadata.name,   //+++
                container: '',
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

    const maximize = () => {
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
            maxHeight: 450
        }
        return <ChannelTabContent {...channelProps}/>
    }

    return (
        <Dialog open={true} sx={{ '& .MuiDialog-paper': {
                                    width: `70vw`,
                                    height: `70vh`,
                                    maxWidth: `70vw`,
                                    maxHeight: `70vh`
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
                    <Typography sx={{flexGrow:1}}></Typography>
                    <IconButton onClick={maximize}>
                        <Maximize />
                    </IconButton>
                    <IconButton onClick={minimize}>
                        <Minimize />
                    </IconButton>
                    <IconButton onClick={close}>
                        <Close />
                    </IconButton>
                </Stack>
            </DialogTitle>
            <DialogContent>
                {showContent()}
            </DialogContent>

        </Dialog>        
    )
}
export { ExternalContent }