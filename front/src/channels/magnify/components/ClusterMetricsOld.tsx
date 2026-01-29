import { EInstanceConfigObject, EInstanceConfigScope, EInstanceConfigView, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, EMetricsConfigMode, IInstanceConfig, IInstanceMessage } from '@jfvilas/kwirth-common'
import { EChannelRefreshAction, IChannel, IChannelObject, IContentProps, TChannelConstructor } from '../../IChannel'
import { useEffect, useRef } from 'react'
import { IMetricsConfig, IMetricsInstanceConfig } from '../../metrics/MetricsConfig'
import { EChartType } from '../../metrics/MenuChart'
import { IMetricsData } from '../../metrics/MetricsData'
import { IFileObject } from '@jfvilas/react-file-manager'
import { ENotifyLevel } from '../../../tools/Global'
import { createChannelInstance } from '../../../tools/ChannelTools'

interface IClusterMetricsProps {
    files: IFileObject[]
    channelObject: IChannelObject
    frontChannels: Map<string, TChannelConstructor>
    onNotify: (channel:IChannel|undefined, level: ENotifyLevel, msg: string) => void
}

const ClusterMetricsOld: React.FC<IClusterMetricsProps> = (props:IClusterMetricsProps) => {
    const content = useRef<any>()
   
    useEffect( () => {
        setMetricsConfig()
    },[])

    const setMetricsConfig = () => {
        let namespaces = props.files.filter(f => f.class === 'Namespace').map(f => f.name)
        let metricsData:IMetricsData = {
            assetMetricsValues: [],
            events: [],
            paused: false,
            started: false
        }
        let metricsConfig:IMetricsConfig = {
            depth: 50,
            width: 4,
            lineHeight: 150,
            configurable: false,
            compact: true,
            legend: false,
            merge: false,
            stack: false,
            chart: EChartType.LineChart,
            metricsDefault: {}
        }
        let metricsInstanceConfig:IMetricsInstanceConfig = {
            mode: EMetricsConfigMode.STREAM,
            aggregate: true,
            interval: 15,
            metrics: ['kwirth_container_cpu_percentage','kwirth_container_memory_percentage', 'kwirth_container_transmit_mbps','kwirth_container_receive_mbps']
        }

        let newChannel = createChannelInstance(props.frontChannels.get('metrics'), props.onNotify)!
        let config = {
            ws: new WebSocket(props.channelObject?.clusterUrl!),
            channel: newChannel,
            channelObject: {
                clusterName: props.channelObject?.clusterName!,
                instanceId: '',
                view:EInstanceConfigView.NAMESPACE,
                namespace: [...new Set(namespaces)].join(','),
                group: '',
                pod: '',
                container: '',
                config: metricsConfig,
                data: metricsData,
                instanceConfig: metricsInstanceConfig
            } as IChannelObject,
        }
        if (newChannel.requiresMetrics()) config.channelObject.metricsList = props.channelObject?.metricsList
        if (newChannel.requiresClusterUrl()) config.channelObject.clusterUrl = props.channelObject?.clusterUrl
        if (newChannel.requiresAccessString()) config.channelObject.accessString = props.channelObject?.accessString


        config.ws.onmessage = (event:MessageEvent) => wsOnMessage(event)
        config.ws.onerror = (event) => () => { console.log('WebSocket error:'+event, new Date().toISOString()) }
        config.ws.onclose = (event:CloseEvent) => { console.log('WebSocket disconnect:'+event.reason, new Date().toISOString()) }
        config.ws.onopen = () => {
            config.channel.startChannel(config.channelObject)

            let instanceConfig:IInstanceConfig = {
                channel: config.channel.channelId,
                objects: EInstanceConfigObject.PODS,
                action: EInstanceMessageAction.START,
                flow: EInstanceMessageFlow.REQUEST,
                instance: '',
                accessKey: props.channelObject!.accessString!,
                scope: EInstanceConfigScope.NONE,
                view: EInstanceConfigView.NAMESPACE ,
                namespace: [...new Set(namespaces)].join(','),
                group: '',
                pod: '',
                container: '',
                type: EInstanceMessageType.SIGNAL,
            }
            instanceConfig.scope = config.channel.getScope() || ''
            instanceConfig.data = config.channelObject.instanceConfig
            config.ws.send(JSON.stringify(instanceConfig))
        }
        content.current = config
        
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

        if (content.current) {
            if (props.channelObject!.frontChannels!.has(instanceMessage.channel)) {
                let refreshAction = content.current.channel.processChannelMessage(content.current.channelObject, wsEvent)
                if (refreshAction) {
                    if (refreshAction.action === EChannelRefreshAction.REFRESH) {
                        //+++props.onRefresh()
                    }
                    else if (refreshAction.action === EChannelRefreshAction.STOP) {
                    }
                }
            }
            else {
                console.log('Received invalid channel in message: ', instanceMessage)
            }
        }
    }

    const showContent = () => {
        if (!content.current) return <></>
        let ChannelTabContent = content.current.channel.TabContent
        let channelProps:IContentProps = {
            channelObject: content.current.channelObject,
        }
        return <ChannelTabContent {...channelProps}/>
    }
    return showContent()
}
export { ClusterMetricsOld }