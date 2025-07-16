import { AssetMetrics, MetricsMessage, InstanceConfig, InstanceConfigViewEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceConfigResponse, InstanceMessageFlowEnum, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessage, MetricsConfig, MetricsConfigModeEnum, InstanceConfigScopeEnum, parseResources, accessKeyDeserialize, BackChannelData, ClusterTypeEnum } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../../model/ClusterInfo'
import { AssetData } from '../../tools/Metrics'
import { IChannel } from '../IChannel'

interface IInstance {
    instanceId: string
    timeout: NodeJS.Timeout
    working: boolean
    paused: boolean
    assets: AssetData[]
    instanceConfig: InstanceConfig
    interval: number
}

class MetricsChannel implements IChannel {
    clusterInfo: ClusterInfo

    // list of intervals (and its associated metrics) that produce metrics streams    
    websocketMetrics: {
        ws:WebSocket,
        lastRefresh: number,
        instances: IInstance[]
    }[] = []
    
    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getChannelData(): BackChannelData {
        return {
            id: 'metrics',
            routable: false,
            pauseable: true,
            modifyable: true,
            reconnectable: true,
            sources: [ ClusterTypeEnum.KUBERNETES ],
            metrics: true
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['','snapshot','stream','cluster'].indexOf(scope)
    }

    async processCommand (webSocket:WebSocket, instanceMessage:InstanceMessage) : Promise<boolean> {
        return false
    }

    containsInstance(instanceId: string): boolean {
        for (var socket of this.websocketMetrics) {
            var exists = socket.instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    checkScopes = (instanceConfig:InstanceConfig, scope: InstanceConfigScopeEnum) => {
        let resources = parseResources (accessKeyDeserialize(instanceConfig.accessKey).resources)
        let requiredLevel = this.getChannelScopeLevel(scope)
        let canPerform = resources.some(r => r.scopes.split(',').some(sc => this.getChannelScopeLevel(sc)>= requiredLevel))
        return canPerform
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            const podResponse = await this.clusterInfo.coreApi.readNamespacedPod(podName, podNamespace)
            const owner = podResponse.body.metadata?.ownerReferences?.find(or => or.controller)
            if (!owner) {
                console.log('No owner found')
                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `No owner found for starting instance ${instanceConfig.instance}: ${podNamespace}/${podName}/${containerName}`, instanceConfig)
                return
            }
            const gtype = owner.kind.toLocaleLowerCase()  // deployment, replicaset, daemonset or statefulset
            const podGroup = gtype + '+' + owner.name
            const podNode = podResponse.body.spec?.nodeName
            
            switch ((instanceConfig.data as MetricsConfig).mode) {
                case MetricsConfigModeEnum.SNAPSHOT:
                    {
                        if (!this.checkScopes(instanceConfig, InstanceConfigScopeEnum.SNAPSHOT)) {
                            console.log('Insufficient scope for SNAPSHOT')
                            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Insufficient scope for SNAPSHOT', instanceConfig) 
                            return
                        }
                        if (podNode) {
                            console.log(`Send snapshot metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)

                            let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
                            if (!socket) {
                                console.log('No socket found for startInstance snapshot')
                                return
                            }
                            let instances = socket.instances
                            let instance = instances?.find((instance) => instance.instanceId === instanceConfig.instance)
                            if (instance)
                                this.sendMetricsDataInstance(webSocket, instanceConfig.instance, false)
                            else
                                this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig) 
                        }
                    }
                    break
                case MetricsConfigModeEnum.STREAM:
                    {
                        if (!this.checkScopes(instanceConfig, InstanceConfigScopeEnum.STREAM)) {
                            console.log('Insufficient scope for STREAM')
                            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, 'Insufficient scope for STREAM', instanceConfig) 
                            return
                        }

                        if (podNode) {
                            console.log(`Start pod metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
                            let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
                            let metricsConfig = instanceConfig.data as MetricsConfig
                            let interval = (metricsConfig.interval || 60) * 1000
                            if (socket) {
                                let instances = socket.instances
                                let instance = instances?.find((instance) => instance.instanceId === instanceConfig.instance)
                                if (!instance) {
                                    // new instance for an existing websocket
                                    let timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,instanceConfig.instance, false), interval)
                                    instances?.push( {
                                        instanceId: instanceConfig.instance,
                                        working:false,
                                        paused:false,
                                        timeout,
                                        interval,
                                        assets:[{podNode, podNamespace, podGroup, podName, containerName}],
                                        instanceConfig: instanceConfig
                                    })
                                    this.sendMetricsDataInstance(webSocket,instanceConfig.instance, true)
                                    return
                                }
                                
                                if (instanceConfig.view === InstanceConfigViewEnum.CONTAINER) {
                                    instance.assets.push ({podNode, podNamespace, podGroup, podName, containerName})
                                    this.sendMetricsDataInstance(webSocket,instanceConfig.instance, true)
                                }
                                else {
                                    if (!instance.assets.find(asset => asset.podName === podName && asset.containerName === containerName)) {
                                        instance.assets.push ({podNode, podNamespace, podGroup, podName, containerName})
                                        this.sendMetricsDataInstance(webSocket,instanceConfig.instance, true)
                                    }
                                }
                            }
                            else {
                                this.websocketMetrics.push( {ws:webSocket, lastRefresh: Date.now(), instances:[]} )
                                let timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,instanceConfig.instance, false), interval)
                                let instances = this.websocketMetrics.find(entry => entry.ws === webSocket)?.instances
                                instances?.push({
                                    instanceId:instanceConfig.instance, 
                                    working:false, 
                                    paused:false, 
                                    timeout, 
                                    assets:[{podNode, podNamespace, podGroup, podName, containerName}], 
                                    instanceConfig: instanceConfig, 
                                    interval
                                })
                                this.sendMetricsDataInstance(webSocket,instanceConfig.instance, true)
                            }
                        }
                        else {
                            console.log(`Cannot determine node for ${podNamespace}/${podName}}, will not be added`)
                        }
                    }
                    break
                default:
                    this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${(instanceConfig.data as MetricsConfig).mode}`, instanceConfig)
                    break
            }
        }
        catch (err:any) {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
            console.log('Generic error starting metrics instance', err)
        }
    }

    stopInstance (webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            this.removeInstance (webSocket,instanceConfig.instance)
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.METRICS, instanceConfig, 'Metrics instance stopped')
        }
        else {
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.STOP, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.METRICS, instanceConfig, 'Instance not found')
        }
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {
        let instance = this.getInstance(webSocket, instanceConfig.instance)        
        if (instance) {
            // only modifiable properties of the metrics config
            let destConfig = instance.instanceConfig.data as MetricsConfig
            destConfig.metrics = (instanceConfig.data as MetricsConfig).metrics
            destConfig.interval = (instanceConfig.data as MetricsConfig).interval
            destConfig.aggregate = (instanceConfig.data as MetricsConfig).aggregate
            this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.MODIFY, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.METRICS, instanceConfig, 'Metrics modified')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }   
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceMessageActionEnum): void {
        let instance = this.getInstance(webSocket, instanceConfig.instance)
        if (instance) {
            if (action === InstanceMessageActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceMessageActionEnum.PAUSE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.METRICS, instanceConfig, 'Metrics paused')
            }
            if (action === InstanceMessageActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket,InstanceMessageActionEnum.CONTINUE, InstanceMessageFlowEnum.RESPONSE, InstanceMessageChannelEnum.METRICS, instanceConfig, 'Metrics continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    removeInstance(webSocket: WebSocket, instanceId: string): void {
        let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                if (instanceIndex>=0) {
                    instances[instanceIndex].timeout.close()
                    instances.splice(instanceIndex,1)
                }
                else{
                    console.log('Instance not found, cannot delete')
                }
            }
            else {
                console.log('There are no Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found on intervals')
        }
    }

    containsConnection (webSocket:WebSocket) : boolean {
        return Boolean (this.websocketMetrics.find(s => s.ws === webSocket))
    }

    refreshConnection(webSocket: WebSocket): boolean {
        let socket = this.websocketMetrics.find(s => s.ws === webSocket)
        if (socket) {
            socket.lastRefresh = Date.now()
            return true
        }
        else {
            console.log('WebSocket not found')
            return false
        }
    }

    updateConnection(newWebSocket: WebSocket, instanceId: string): boolean {
        for (let entry of this.websocketMetrics) {
            var exists = entry.instances.find(i => i.instanceId === instanceId)
            if (exists) {
                entry.ws = newWebSocket
                for (var instance of entry.instances) {
                    clearInterval(instance.timeout)
                    instance.timeout = setInterval(() => this.sendMetricsDataInstance(newWebSocket, instanceId, false), instance.interval)
                }
                return true
            }
        }
        return false
    }

    removeConnection(webSocket: WebSocket): void {
        let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                for (var i=0;i<instances.length;i++) {
                    console.log(`Interval for instance ${instances[i].instanceId} has been removed`)
                    this.removeInstance(webSocket, instances[i].instanceId)
                }
            }
            var pos = this.websocketMetrics.findIndex(s => s.ws === webSocket)
            this.websocketMetrics.splice(pos,1)
        }
    }

    // PRIVATE

    getInstance(webSocket:WebSocket, instanceId: string) : IInstance | undefined{
        let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
        if (socket) {
            let instances = socket.instances
            if (instances) {
                let instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                if (instanceIndex>=0) return instances[instanceIndex]
                console.log('Instance not found')
            }
            else {
                console.log('There are no Instances on websocket')
            }
        }
        else {
            console.log('WebSocket not found')
        }
        return undefined
    }

    // PRIVATE
    getAssetMetrics = (instanceConfig:InstanceConfig, assets:AssetData[], usePrevMetricSet:boolean): AssetMetrics => {
        var assetMetrics:AssetMetrics = { assetName: this.getAssetMetricName(instanceConfig, assets), values: [] }

        var newAssets:AssetData[] = []
        if (instanceConfig.view=== InstanceConfigViewEnum.CONTAINER) {
            newAssets = assets
        }
        else {
            for (var a of assets) {
                if (!newAssets.find(na => na.podName === a.podName)) {
                    newAssets.push({
                        podNode: a.podNode,
                        podNamespace: a.podNamespace,
                        podGroup: a.podGroup,
                        podName: a.podName,
                        containerName: ''
                    })
                }
            }
        }

        for (let metricName of (instanceConfig.data as MetricsConfig).metrics) {
            let sourceMetricName = metricName
            if (metricName === 'kwirth_cluster_container_memory_percentage') sourceMetricName = 'container_memory_working_set_bytes'
            if (metricName === 'kwirth_cluster_container_cpu_percentage') sourceMetricName = 'container_cpu_usage_seconds_total'

            if (metricName === 'kwirth_cluster_container_transmit_percentage') sourceMetricName = 'container_network_transmit_bytes_total'
            if (metricName === 'kwirth_cluster_container_receive_percentage') sourceMetricName = 'container_network_receive_bytes_total'

            if (metricName === 'kwirth_cluster_container_transmit_mbps') sourceMetricName = 'container_network_transmit_bytes_total'
            if (metricName === 'kwirth_cluster_container_receive_mbps') sourceMetricName = 'container_network_receive_bytes_total'

            if (metricName === 'kwirth_cluster_container_random_counter' || metricName === 'kwirth_cluster_container_random_gauge') sourceMetricName = 'container_cpu_system_seconds_total'

            let uniqueValues:number[] = []

            for (let asset of newAssets) {
                let total=0
                let node = this.clusterInfo.nodes.get(asset.podNode)
                if (node) {
                    let metric
                    if (usePrevMetricSet)
                        metric = this.clusterInfo.metrics.extractContainerMetrics(this.clusterInfo, node.prevPodMetricValues, node.prevContainerMetricValues, sourceMetricName, instanceConfig.view, node, asset)
                    else
                        metric = this.clusterInfo.metrics.extractContainerMetrics(this.clusterInfo, node.podMetricValues, node.containerMetricValues, sourceMetricName, instanceConfig.view, node, asset)
                    total = metric.value
                }
                else {
                    console.log('No node found for calculating pod metric value', asset)
                }
                uniqueValues.push(total)
            }

            let metricValue = uniqueValues.reduce((acc,value) => acc + value, 0)
            assetMetrics.values.push ({ metricName, metricValue })
        }

        for (var i=0; i<assetMetrics.values.length; i++) {
            let m = assetMetrics.values[i]

            switch(m.metricName) {
                case 'kwirth_cluster_container_memory_percentage':
                    let clusterMemory = this.clusterInfo.memory
                    if (Number.isNaN(this.clusterInfo.memory)) clusterMemory=Number.MAX_VALUE
                    m.metricValue = Math.round(m.metricValue/clusterMemory*100*100)/100
                    break
                case 'kwirth_cluster_container_cpu_percentage':
                    if (!usePrevMetricSet) {
                        // we perform a recursive call if-and-only-if we are not extracting prev values
                        let prevValues = this.getAssetMetrics(instanceConfig, newAssets, true)
    
                        let prev = prevValues.values.find(prevMetric => prevMetric.metricName === m.metricName)
                        if (prev) {
                            m.metricValue -= prev.metricValue
                            if (m.metricValue < 0) {
                                m.metricValue = 0  // this happens when pod restarts take place
                            }
                            else {
                                let totalSecs = this.clusterInfo.metricsInterval * this.clusterInfo.vcpus
                                m.metricValue = Math.round(m.metricValue/totalSecs*100*100)/100
                            }
                        }
                        else {
                            console.log(`No previous value  [CPU] found for ${m.metricName}`)
                        }
                    }
                    break
                case 'kwirth_cluster_container_random_counter':
                    m.metricValue = Date.now() % (Math.random()*32*1000000)
                    break
                case 'kwirth_cluster_container_random_gauge':
                    m.metricValue = Math.round(Math.random()*100)/100
                    break
                case 'kwirth_cluster_container_transmit_percentage':
                case 'kwirth_cluster_container_receive_percentage':
                    // get total transmit/receive bytes
                    let totalBytes:number = 0
                    for (var node of this.clusterInfo.nodes.values()) {
                        let sourceMetricName = m.metricName==='kwirth_cluster_container_transmit_percentage'? 'container_network_transmit_bytes_total':'container_network_receive_bytes_total'
                        let nodeMetrics = Array.from(node.podMetricValues.keys()).filter(k => k.endsWith('/'+sourceMetricName))
                        nodeMetrics.map ( m => {
                            totalBytes += node.podMetricValues.get(m)?.value!
                        })
                    }
                    m.metricValue = Math.round(m.metricValue/totalBytes*100*100)/100
                    break
                case 'kwirth_cluster_container_transmit_mbps':
                case 'kwirth_cluster_container_receive_mbps':
                    if (!usePrevMetricSet) {
                        // we perform a recursive call if-and-only-if we are not extracting prev values
                        var prevValues = this.getAssetMetrics(instanceConfig, newAssets, true)
                        let prev = prevValues.values.find(prevMetric => prevMetric.metricName === m.metricName)

                        if (prev) {
                            m.metricValue -= prev.metricValue // we get the value of bytes sent/received on the last period
                            m.metricValue *= 8  // we convert into bits
                            m.metricValue /= (1024*1024)  // we convert into Mbits
                            let totalSecs = this.clusterInfo.metricsInterval
                            m.metricValue = Math.round(m.metricValue/totalSecs*100*100)/100   // we build a percentage with 2 decimal positions
                        }
                        else {
                            console.log(`No previous value  [NETWORK] found for ${m.metricName}`)
                        }
                    }
                    break

            }
        }

        return assetMetrics
    }

    getAssetMetricName = (instanceConfig:InstanceConfig, assets:AssetData[]): string => {
        switch (instanceConfig.view) {
            case InstanceConfigViewEnum.NAMESPACE:
                return [...new Set (assets.map (a => a.podNamespace))].join(',')
            case InstanceConfigViewEnum.GROUP:
                return [...new Set (assets.map (a => a.podGroup))].join(',')
            case InstanceConfigViewEnum.POD:
                return [...new Set (assets.map (a => a.podName))].join(',')
            case InstanceConfigViewEnum.CONTAINER:
                return [...new Set (assets.map (a => a.podName+'['+a.containerName+']'))].join(',')
            default:
                return 'unnamedView'
        }
    }

    sendMetricsDataInstance = (webSocket:WebSocket, instanceId:string, initial:boolean): void => {
        let socket = this.websocketMetrics.find(entry => entry.ws === webSocket)
        if (!socket) {
            console.log('No socket found for sendLogData')
            return
        }
        let instances = socket.instances

        if (!instances) {
            console.log('No instances found for sendMetricsData')
            return
        }
        var instance = instances.find (i => i.instanceId === instanceId)
        if (!instance) {
            console.log(`No instance found for sendMetricsData instance ${instanceId}`)
            return
        }
        if (instance.working) {
            console.log(`Previous instance of ${instanceId} is still running`)
            return
        }
        if (instance.paused) {
            console.log(`Instance ${instanceId} is paused, no SMD performed`)
            return
        }
    
        instance.working=true
        let instanceConfig = instance.instanceConfig
    
        try {
            var metricsMessage:MetricsMessage = {
                action: InstanceMessageActionEnum.NONE,
                flow: InstanceMessageFlowEnum.UNSOLICITED,
                channel: InstanceMessageChannelEnum.METRICS,
                type: InstanceMessageTypeEnum.DATA,
                instance: instanceConfig.instance,
                assets: [],
                namespace: instanceConfig.namespace,
                pod: instanceConfig.pod,
                timestamp: initial? 0: Date.now(),
                container: '',
                msgtype: 'metricsmessage'
            }
    
            switch(instanceConfig.view) {
                case InstanceConfigViewEnum.NAMESPACE:
                    if ((instanceConfig.data as MetricsConfig).aggregate) {
                        let assetMetrics = this.getAssetMetrics(instanceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const namespaces = [...new Set(instance.assets.map(item => item.podNamespace))]
                        for (let namespace of namespaces) {
                            let assets = instance.assets.filter(a => a.podNamespace === namespace)
                            let assetMetrics = this.getAssetMetrics(instanceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }

                    }
                    break
                case InstanceConfigViewEnum.GROUP:
                    if ((instanceConfig.data as MetricsConfig).aggregate) {
                        var assetMetrics = this.getAssetMetrics(instanceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const groupNames = [...new Set(instance.assets.map(item => item.podGroup))]
                        for (let groupName of groupNames) {
                            let assets=instance.assets.filter(a => a.podGroup === groupName)
                            let assetMetrics = this.getAssetMetrics(instanceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                case InstanceConfigViewEnum.POD:
                    if ((instanceConfig.data as MetricsConfig).aggregate) {
                        var assetMetrics = this.getAssetMetrics(instanceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const uniquePodNames = [...new Set(instance.assets.map(asset => asset.podName))]
                        for (var podName of uniquePodNames) {
                            var assets = instance.assets.filter(a => a.podName === podName)
                            var assetMetrics = this.getAssetMetrics(instanceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                case InstanceConfigViewEnum.CONTAINER:
                    if ((instanceConfig.data as MetricsConfig).aggregate) {
                        var assetMetrics = this.getAssetMetrics(instanceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        for (var asset of instance.assets) {
                            var assetMetrics = this.getAssetMetrics(instanceConfig, [asset], false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                default:
                    console.log(`Invalid view:`, instanceConfig.view)
            }
    
            try {
                webSocket.send(JSON.stringify(metricsMessage))
            }
            catch (err) {
                console.log('Socket error, we should forget interval')
            }
            instance.working=false
        }
        catch (err) {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.WARNING, `Cannot read metrics for instance ${instanceId}`, instanceConfig)
            console.log('Error reading metrics', err)
        }
    }
    
    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceMessageActionEnum, flow: InstanceMessageFlowEnum, channel: InstanceMessageChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
        var resp:InstanceConfigResponse = {
            action,
            flow,
            channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig): void {
        var signalMessage:SignalMessage = {
            action: InstanceMessageActionEnum.NONE,
            flow: InstanceMessageFlowEnum.RESPONSE,
            type: InstanceMessageTypeEnum.SIGNAL,
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            text
        }
        webSocket.send(JSON.stringify(signalMessage))
    }


}

export { MetricsChannel }