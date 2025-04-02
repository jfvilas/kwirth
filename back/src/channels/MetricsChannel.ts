import { AssetMetrics, ChannelCapabilities, IChannel, MetricsConfig, MetricsConfigModeEnum, MetricsMessage, InstanceConfig, InstanceConfigActionEnum, InstanceConfigChannelEnum, InstanceConfigFlowEnum, InstanceConfigViewEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { ClusterInfo } from '../model/ClusterInfo'
import { AssetData } from '../tools/MetricsTools'
import WebSocket from 'ws'

class MetricsChannel implements IChannel {
    clusterInfo: ClusterInfo

    // list of intervals (and its associated metrics) that produce metrics streams    
    websocketMetrics:Map<WebSocket, {instanceId:string, timeout: NodeJS.Timeout, working:boolean, paused:boolean, assets: AssetData[], instanceConfig:InstanceConfig} []> = new Map()  

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getCapabilities(): ChannelCapabilities {
        return {
            pauseable: true,
            modifyable: true,
            reconnectable: true
        }
    }

    getChannelScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

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

        for (let metricName of instanceConfig.data.metrics) {
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
                        var prevValues = this.getAssetMetrics(instanceConfig, newAssets, true)
    
                        let prev = prevValues.values.find(prevMetric => prevMetric.metricName === m.metricName)
                        if (prev) {
                            m.metricValue -= prev.metricValue
                            let totalSecs = this.clusterInfo.metricsInterval * this.clusterInfo.vcpus       
                            m.metricValue = Math.round(m.metricValue/totalSecs*100*100)/100
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
            case 'namespace':
                return [...new Set (assets.map (a => a.podNamespace))].join(',')
            case 'group':
                return [...new Set (assets.map (a => a.podGroup))].join(',')
            case 'pod':
                return [...new Set (assets.map (a => a.podName))].join(',')
            case 'container':
                return [...new Set (assets.map (a => a.podName+'['+a.containerName+']'))].join(',')
            default:
                return 'unnamedView'
        }
    }

    sendMetricsDataInstance = (webSocket:WebSocket, instanceId:string): void => {
        // get instance
        var instances = this.websocketMetrics.get(webSocket)
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
                channel: InstanceConfigChannelEnum.METRICS,
                type: InstanceMessageTypeEnum.DATA,
                instance: instanceConfig.instance,
                assets: [],
                namespace: instanceConfig.namespace,
                pod: instanceConfig.pod,
                timestamp: Date.now()
            }
    
            switch(instanceConfig.view) {
                case InstanceConfigViewEnum.NAMESPACE:
                    if (instanceConfig.data.aggregate) {
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
                    if (instanceConfig.data.aggregate) {
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
                    if (instanceConfig.data.aggregate) {
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
                    if (instanceConfig.data.aggregate) {
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
    
    sendInstanceConfigMessage = (ws:WebSocket, action:InstanceConfigActionEnum, flow: InstanceConfigFlowEnum, channel: InstanceConfigChannelEnum, instanceConfig:InstanceConfig, text:string): void => {
        var resp:any = {
            action,
            flow,
            channel,
            instance: instanceConfig.instance,
            type: 'signal',
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, instanceConfig: InstanceConfig): void {
        var sgnMsg:SignalMessage = {
            level,
            channel: instanceConfig.channel,
            instance: instanceConfig.instance,
            type: InstanceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }

    async startInstance (webSocket: WebSocket, instanceConfig: InstanceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            const podResponse = await this.clusterInfo.coreApi.readNamespacedPod(podName, podNamespace)
            const owner = podResponse.body.metadata?.ownerReferences![0]!
            const gtype = owner.kind.toLocaleLowerCase().replace('set','')  // gtype is 'replica', 'stateful' or 'daemon'
            const podGroup = gtype+'+'+owner.name
            const podNode = podResponse.body.spec?.nodeName
            
            switch (instanceConfig.data.mode) {
                case MetricsConfigModeEnum.SNAPSHOT:
                    if (podNode) {
                        console.log(`Send snapshot metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
                        var instances = this.websocketMetrics.get(webSocket)
                        var instance = instances?.find((instance) => instance.instanceId === instanceConfig.instance)
                        if (instance)
                            this.sendMetricsDataInstance(webSocket, instanceConfig.instance)
                        else
                            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig) 
                    }
                    break
                case MetricsConfigModeEnum.STREAM:
                    if (podNode) {
                        console.log(`Start pod metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
                        if (this.websocketMetrics.has(webSocket)) {
                            var instances = this.websocketMetrics.get(webSocket)
                            var instance = instances?.find((instance) => instance.instanceId === instanceConfig.instance)
                            if (!instance) {
                                // new instance for an existing websocket
                                var interval=(instanceConfig.data.interval? instanceConfig.data.interval:60)*1000
                                var timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,instanceConfig.instance), interval)
                                instances?.push({instanceId:instanceConfig.instance, working:false, paused:false, timeout, assets:[{podNode, podNamespace, podGroup, podName, containerName}], instanceConfig: instanceConfig})
                                return
                            }
                            
                            if (instanceConfig.data.view === InstanceConfigViewEnum.CONTAINER) {
                                instance?.assets.push ({podNode, podNamespace, podGroup, podName, containerName})
                            }
                            else {
                                if (!instance.assets.find(a => a.podName === podName && a.containerName === containerName)) {
                                    instance.assets.push ({podNode, podNamespace, podGroup, podName, containerName})                            
                                }
                            }
                        }
                        else {
                            this.websocketMetrics.set(webSocket, [])
                            var interval=(instanceConfig.data.interval? instanceConfig.data.interval:60)*1000
                            var timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,instanceConfig.instance), interval)
                            var instances = this.websocketMetrics.get(webSocket)
                            instances?.push({instanceId:instanceConfig.instance, working:false, paused:false, timeout, assets:[{podNode, podNamespace, podGroup, podName, containerName}], instanceConfig: instanceConfig})
                        }
                    }
                    else {
                        console.log(`Cannot determine node for ${podNamespace}/${podName}}, will not be added`)
                    }
                    break
                default:
                    this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${instanceConfig.data.mode}`, instanceConfig.data.mode)
                    break
            }
        }
        catch (err:any) {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, instanceConfig)
            console.log('Generic error starting metrics instance', err)
        }
    }

    stopInstance (webSocket: WebSocket, instanceConfig: InstanceConfig): void {
        this.removeInstance (webSocket,instanceConfig.instance)
        this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.STOP, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.METRICS, instanceConfig, 'Metrics instance stopped')
    }

    modifyInstance (webSocket:WebSocket, instanceConfig: InstanceConfig): void {
        let runningInstances = this.websocketMetrics.get(webSocket)
        let instance = runningInstances?.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            // only modifiable properties of the metrics config
            instance.instanceConfig.data.metrics = instanceConfig.data.metrics
            instance.instanceConfig.data.interval = instanceConfig.data.interval
            instance.instanceConfig.data.aggregate = instanceConfig.data.aggregate
            this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.MODIFY, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.METRICS, instanceConfig, 'Metrics modified')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }   
    }

    pauseContinueInstance(webSocket: WebSocket, instanceConfig: InstanceConfig, action: InstanceConfigActionEnum): void {
        let runningInstances = this.websocketMetrics.get(webSocket)
        let instance = runningInstances?.find(i => i.instanceId === instanceConfig.instance)
        if (instance) {
            if (action === InstanceConfigActionEnum.PAUSE) {
                instance.paused = true
                this.sendInstanceConfigMessage(webSocket, InstanceConfigActionEnum.PAUSE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.METRICS, instanceConfig, 'Metrics paused')
            }
            if (action === InstanceConfigActionEnum.CONTINUE) {
                instance.paused = false
                this.sendInstanceConfigMessage(webSocket,InstanceConfigActionEnum.CONTINUE, InstanceConfigFlowEnum.RESPONSE, InstanceConfigChannelEnum.METRICS, instanceConfig, 'Metrics continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${instanceConfig.instance} not found`, instanceConfig)
        }
    }

    removeConnection(webSocket: WebSocket): void {
        if (this.websocketMetrics.has(webSocket)) {
            let instances=this.websocketMetrics.get(webSocket)
            if (instances) {
                for (var i=0;i<instances.length;i++) {
                    console.log(`Interval for instance ${instances[i].instanceId} has been removed`)
                    this.removeInstance(webSocket, instances[i].instanceId)
                }
            }
            this.websocketMetrics.delete(webSocket)
        }
    }

    containsInstance(instanceId: string): boolean {
        for (var instances of this.websocketMetrics.values()) {
            var exists = instances.find(i => i.instanceId === instanceId)
            if (exists) return true
        }
        return false
    }

    updateConnection(webSocket: WebSocket, instanceId: string): boolean {
        for (let [key,value] of this.websocketMetrics.entries()) {
            var exists = value.find(i => i.instanceId === instanceId)
            if (exists) {
                let temp = value
                this.websocketMetrics.delete(key)
                this.websocketMetrics.set(webSocket, value)
                return true
            }
        }
        return false
    }
        
    removeInstance(webSocket: WebSocket, instanceId: string): void {
        if (this.websocketMetrics.has(webSocket)) {
            var instances = this.websocketMetrics.get(webSocket)
            if (instances) {
                var instanceIndex = instances.findIndex(t => t.instanceId === instanceId)
                if (instanceIndex>=0) {
                    clearInterval(instances[instanceIndex].timeout)
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
}

export { MetricsChannel }