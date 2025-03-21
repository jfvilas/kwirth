import { AssetMetrics, MetricsConfig, MetricsConfigModeEnum, MetricsMessage, ServiceConfig, ServiceConfigActionEnum, ServiceConfigChannelEnum, ServiceConfigFlowEnum, ServiceConfigViewEnum, ServiceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { IChannel } from '../model/IChannel'
import { ClusterInfo } from '../model/ClusterInfo'
import { AssetData } from '../tools/MetricsTools'
import WebSocket from 'ws'

class MetricsChannel implements IChannel {
    clusterInfo: ClusterInfo

    // list of intervals (and its associated metrics) that produce metrics streams    
    websocketMetrics:Map<WebSocket, {instanceId:string, timeout: NodeJS.Timeout, working:boolean, paused:boolean, assets: AssetData[], serviceConfig:ServiceConfig} []> = new Map()  

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    getAssetMetrics = (serviceConfig:ServiceConfig, assets:AssetData[], usePrevMetricSet:boolean) : AssetMetrics => {
        var assetMetrics:AssetMetrics = { assetName: this.getAssetMetricName(serviceConfig, assets), values: [] }

        var newAssets:AssetData[] = []
        if (serviceConfig.view=== ServiceConfigViewEnum.CONTAINER) {
            newAssets = assets
        }
        else {
            for (var a of assets) {
                if (!newAssets.find(na => na.podName===a.podName)) {
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

        for (let metricName of serviceConfig.data.metrics) {
            let sourceMetricName = metricName
            if (metricName === 'kwirth_cluster_container_memory_percentage') sourceMetricName = 'container_memory_working_set_bytes'
            if (metricName === 'kwirth_cluster_container_cpu_percentage') sourceMetricName = 'container_cpu_usage_seconds_total'
            if (metricName === 'kwirth_cluster_container_random_counter' || metricName === 'kwirth_cluster_container_random_gauge') sourceMetricName = 'container_cpu_system_seconds_total'

            let uniqueValues:number[] = []

            for (let asset of newAssets) {
                let total=0
                let node = this.clusterInfo.nodes.get(asset.podNode)
                if (node) {
                    let metric
                    if (usePrevMetricSet)
                        metric = this.clusterInfo.metrics.extractContainerMetrics(this.clusterInfo, node.prevPodMetricValues, node.prevContainerMetricValues, sourceMetricName, serviceConfig.view, node, asset)
                    else
                        metric = this.clusterInfo.metrics.extractContainerMetrics(this.clusterInfo, node.podMetricValues, node.containerMetricValues, sourceMetricName, serviceConfig.view, node, asset)
                    total = metric.value
                }
                else {
                    console.log('No node found for calculating pod metric value', asset)
                }
                uniqueValues.push(total)        
            }

            let metricValue = uniqueValues.reduce((acc,value) => acc+value, 0)
            assetMetrics.values.push ( { metricName:metricName, metricValue })
        }

        for (var i=0;i<assetMetrics.values.length;i++) {
            let m = assetMetrics.values[i]

            if (m.metricName === 'kwirth_cluster_container_memory_percentage') {
                let clusterMemory = this.clusterInfo.memory
                if (Number.isNaN(this.clusterInfo.memory)) clusterMemory=Number.MAX_VALUE
                m.metricValue = Math.round(m.metricValue/clusterMemory*100*100)/100
            }
            else if (m.metricName === 'kwirth_cluster_container_cpu_percentage') {
                if (!usePrevMetricSet) {
                    // we perform a recursive call if-and-only-if we are not extracting prev values
                    var prevValues = this.getAssetMetrics(serviceConfig, newAssets, true)
                    console.log('x', prevValues)

                    let prev = prevValues.values.find(pm => pm.metricName === m.metricName)
                    if (prev) {
                        m.metricValue -= prev.metricValue
                        let totalSecs = this.clusterInfo.interval * this.clusterInfo.vcpus
                        console.log('totalsecs', totalSecs)
        
                        m.metricValue = Math.round(m.metricValue/totalSecs*100*100)/100
                        console.log('assetMetrics cpu final', assetMetrics)
                    }
                    else {
                        console.log(`No previous value found for ${m.metricName}`)
                    }
                }
            }
            else if (m.metricName === 'kwirth_cluster_container_random_counter') {
                m.metricValue = Math.round(Math.random()*100*100)/100
            }
            else if (m.metricName === 'kwirth_cluster_container_random_gauge') {
                m.metricValue = Math.round(Math.random()*100)/100
            }
        }


        return assetMetrics
    }

    getAssetMetricName = (serviceConfig:ServiceConfig, assets:AssetData[]) : string => {
        switch (serviceConfig.view) {
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

    sendMetricsDataInstance = (webSocket:WebSocket, instanceId:string) => {
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
        let serviceConfig = instance.serviceConfig
    
        try {
            var metricsMessage:MetricsMessage = {
                channel: ServiceConfigChannelEnum.METRICS,
                type: ServiceMessageTypeEnum.DATA,
                instance: serviceConfig.instance,
                assets: [],
                namespace: serviceConfig.namespace,
                pod: serviceConfig.pod,
                timestamp: Date.now()
            }
    
            switch(serviceConfig.view) {
                case ServiceConfigViewEnum.NAMESPACE:
                    if (serviceConfig.data.aggregate) {
                        let assetMetrics = this.getAssetMetrics(serviceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const namespaces = [...new Set(instance.assets.map(item => item.podNamespace))]
                        for (let namespace of namespaces) {
                            let assets = instance.assets.filter(a => a.podNamespace === namespace)
                            let assetMetrics = this.getAssetMetrics(serviceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }

                    }
                    break
                case ServiceConfigViewEnum.GROUP:
                    if (serviceConfig.data.aggregate) {
                        var assetMetrics = this.getAssetMetrics(serviceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const groupNames = [...new Set(instance.assets.map(item => item.podGroup))]
                        for (let groupName of groupNames) {
                            let assets=instance.assets.filter(a => a.podGroup === groupName)
                            let assetMetrics = this.getAssetMetrics(serviceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                case ServiceConfigViewEnum.POD:
                    console.log('assets', instance.assets)
                    if (serviceConfig.data.aggregate) {
                        var assetMetrics = this.getAssetMetrics(serviceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        const podNames = [...new Set(instance.assets.map(asset => asset.podName))]
                        for (var podName of podNames) {
                            var assets = instance.assets.filter(a => a.podName === podName)
                            var assetMetrics = this.getAssetMetrics(serviceConfig, assets, false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                case ServiceConfigViewEnum.CONTAINER:
                    if (serviceConfig.data.aggregate) {
                        var assetMetrics = this.getAssetMetrics(serviceConfig, instance.assets, false)
                        metricsMessage.assets.push(assetMetrics)
                    }
                    else {
                        for (var asset of instance.assets) {
                            var assetMetrics = this.getAssetMetrics(serviceConfig, [asset], false)
                            metricsMessage.assets.push(assetMetrics)
                        }
                    }
                    break
                default:
                    console.log(`Invalid view:`, serviceConfig.view)
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
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.WARNING, `Cannot read metrics for instance ${instanceId}`, serviceConfig)
            console.log('Error reading metrics', err)
        }
    }
    
    sendServiceConfigMessage = (ws:WebSocket, action:ServiceConfigActionEnum, flow: ServiceConfigFlowEnum, channel: ServiceConfigChannelEnum, serviceConfig:ServiceConfig, text:string) => {
        var resp:any = {
            action,
            flow,
            channel,
            instance: serviceConfig.instance,
            type: 'signal',
            text
        }
        ws.send(JSON.stringify(resp))
    }

    sendChannelSignal (webSocket: WebSocket, level: SignalMessageLevelEnum, text: string, serviceConfig: ServiceConfig) {
        var sgnMsg:SignalMessage = {
            level,
            channel: serviceConfig.channel,
            instance: serviceConfig.instance,
            type: ServiceMessageTypeEnum.SIGNAL,
            text
        }
        webSocket.send(JSON.stringify(sgnMsg))
    }

    async startInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, podNamespace: string, podName: string, containerName: string): Promise<void> {
        try {
            const podResponse = await this.clusterInfo.coreApi.readNamespacedPod(podName, podNamespace)
            const owner = podResponse.body.metadata?.ownerReferences![0]!
            const gtype = owner.kind.toLocaleLowerCase().replace('set','')  // gtype is 'replica', 'stateful' or 'daemon'
            const podGroup = gtype+'+'+owner.name
            const podNode = podResponse.body.spec?.nodeName
            
            switch (serviceConfig.data.mode) {
                case MetricsConfigModeEnum.SNAPSHOT:
                    if (podNode) {
                        console.log(`Send snapshot metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
                        var instances = this.websocketMetrics.get(webSocket)
                        var instance = instances?.find((instance) => instance.instanceId === serviceConfig.instance)
                        if (instance)
                            this.sendMetricsDataInstance(webSocket, serviceConfig.instance)
                        else
                            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.instance} not found`, serviceConfig) 
                    }
                    break
                case MetricsConfigModeEnum.STREAM:
                    if (podNode) {
                        console.log(`Start pod metrics for ${podNode}/${podNamespace}/${podGroup}/${podName}/${containerName}`)
                        if (this.websocketMetrics.has(webSocket)) {
                            var instances = this.websocketMetrics.get(webSocket)
                            var instance = instances?.find((instance) => instance.instanceId === serviceConfig.instance)
                            if (!instance) {
                                // new instance for an existing websocket
                                var interval=(serviceConfig.data.interval? serviceConfig.data.interval:60)*1000
                                var timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,serviceConfig.instance), interval)
                                instances?.push({instanceId:serviceConfig.instance, working:false, paused:false, timeout, assets:[{podNode, podNamespace, podGroup, podName, containerName}], serviceConfig})
                                return
                            }
                            
                            if (serviceConfig.data.view === ServiceConfigViewEnum.CONTAINER) {
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
                            var interval=(serviceConfig.data.interval? serviceConfig.data.interval:60)*1000
                            var timeout = setInterval(() => this.sendMetricsDataInstance(webSocket,serviceConfig.instance), interval)
                            var instances = this.websocketMetrics.get(webSocket)
                            instances?.push({instanceId:serviceConfig.instance, working:false, paused:false, timeout, assets:[{podNode, podNamespace, podGroup, podName, containerName}], serviceConfig})
                        }
                    }
                    else {
                        console.log(`Cannot determine node for ${podNamespace}/${podName}}, will not be added`)
                    }
                    break
                default:
                    this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Invalid mode: ${serviceConfig.data.mode}`, serviceConfig.data.mode)
                    break
            }
        }
        catch (err:any) {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, err.stack, serviceConfig)
            console.log('Generic error starting metrics service', err)
        }
    }

    stopInstance (webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        this.removeInstance (webSocket,serviceConfig.instance)
        this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.STOP, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, serviceConfig, 'Metrics service stopped')
    }

    modifyService (webSocket:WebSocket, serviceConfig: ServiceConfig) : void {
        let runningInstances = this.websocketMetrics.get(webSocket)
        let instance = runningInstances?.find(i => i.instanceId === serviceConfig.instance)
        if (instance) {
            // only modifiable propertis of the metrics config
            instance.serviceConfig.data.metrics = serviceConfig.data.metrics
            instance.serviceConfig.data.interval = serviceConfig.data.interval
            instance.serviceConfig.data.aggregate = serviceConfig.data.aggregate
            this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.MODIFY, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, serviceConfig, 'Metrics modified')
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.instance} not found`, serviceConfig)
        }   
    }

    updateInstance (webSocket: WebSocket, serviceConfig: ServiceConfig, eventType:string, podNamespace:string, podName:string, containerName:string) : void {
            var metricsConfig = serviceConfig as MetricsConfig
            var instances = this.websocketMetrics.get(webSocket)
            var instance = instances?.find((instance) => instance.instanceId === metricsConfig.instance)
            if (instance) {
                if (eventType==='DELETED') {
                    instance.assets = instance.assets.filter(c => c.podNamespace!==podNamespace && c.podName!==podName && c.containerName!==containerName)
                }
                if (eventType==='MODIFIED') {
                    var thisPod = instance.assets.find(p => p.podNamespace===podNamespace && p.podName===podName && p.containerName===containerName)
                }
            }
    }

    getServiceScopeLevel(scope: string): number {
        return ['','subcribe','create','cluster'].indexOf(scope)
    }

    processModifyServiceConfig(webSocket: WebSocket, serviceConfig: ServiceConfig): void {
        
    }

    pauseContinueChannel(webSocket: WebSocket, serviceConfig: ServiceConfig, action: ServiceConfigActionEnum): void {
        let runningInstances = this.websocketMetrics.get(webSocket)
        let instance = runningInstances?.find(i => i.instanceId === serviceConfig.instance)
        if (instance) {
            if (action === ServiceConfigActionEnum.PAUSE) {
                instance.paused = true
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.PAUSE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, serviceConfig, 'Metrics paused')
            }
            if (action === ServiceConfigActionEnum.CONTINUE) {
                instance.paused = false
                this.sendServiceConfigMessage(webSocket,ServiceConfigActionEnum.CONTINUE, ServiceConfigFlowEnum.RESPONSE, ServiceConfigChannelEnum.METRICS, serviceConfig, 'Metrics continued')
            }
        }
        else {
            this.sendChannelSignal(webSocket, SignalMessageLevelEnum.ERROR, `Instance ${serviceConfig.instance} not found`, serviceConfig)
        }
    }

    removeService(webSocket: WebSocket): void {
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