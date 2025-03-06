//import { CoreV1Api, CustomObjectsApi, V1Node } from "@kubernetes/client-node"
import { ClusterData, NodeData } from "./ClusterData"
import { ServiceConfigViewEnum } from "@jfvilas/kwirth-common"

export interface AssetData {
    podNode:string
    podNamespace:string
    podGroup:string
    podName:string 
    containerName:string
}

export interface MetricDefinition {
    help:string
    type:string
    eval:string
}

export class Metrics {
    private token:string
    private metricsList:Map<string,MetricDefinition>
    private loadingClusterMetrics: boolean=false

    constructor (token:string) {
        this.token=token
        this.metricsList=new Map()
    }

    /*
        URL's from cAdvisor
        
        /stats/summary
        /metrics
        /metrics/cadvisor
        /metrics/probes
        /metrics/resource
        /pods
        /stats/summary
        /healthz
        /configz

        METRICS FORMAT
        name
        ^(.*[^{]){1}{

        labels
        (?:\s*([^=^{]*)=\"([^\"]*)\",*)

        value + ts
        }\s*(\d+)\s*(\d+)$        

        container_fs_reads_bytes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracrnopro.azurecr.io/customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="customers-5cc8cb444f-psrwp"} 36864 1728588770767
        container_fs_reads_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracrnopro.azurecr.io/customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="customers-5cc8cb444f-psrwp"} 5 1728588770767
        container_fs_writes_bytes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracrnopro.azurecr.io/customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="customers-5cc8cb444f-psrwp"} 2.643968e+07 1728588770767
        container_fs_writes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracrnopro.azurecr.io/customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="customers-5cc8cb444f-psrwp"} 2929 1728588770767

    */

    public getMetricsList() {
        var objects = Array.from(this.metricsList.keys()).map ( metricName => { return { metric:metricName, ...this.metricsList.get(metricName)} })
        return objects
    }

    public getMetric(metricName:string) {
        var metric = this.metricsList.get(metricName)
        return metric
    }

    // adds proprties to matrics map
    addRecordType (map:Map<string,MetricDefinition>, mname:string, recordType:string, value:string) {
        if (!map.has(mname)) map.set(mname,{help: '', type: '', eval: ''})
        switch(recordType) {
            case '# HELP':
                map.get(mname)!.help = value
                break
            case '# TYPE':
                map.get(mname)!.type = value
                break
            case '# EVAL':
                map.get(mname)!.eval = value
                break
        }
    }

    // creates a map containing all existing metrics existing in a cluster node (and their properties)
    async loadNodeMetrics(node:NodeData):Promise <Map<string,MetricDefinition>> {
        var map:Map<string,MetricDefinition> = new Map()

        var allMetrics = await this.readCAdvisorMetrics(node)
        console.log('allMetrics node', node.name)
        console.log(allMetrics)
        var lines = allMetrics.split('\n').filter(l => l.startsWith('#'))
        for (var line of lines) {
            var recordType=line.substring(0,6).trim()
            line = line.substring(6).trim()
            var i = line.indexOf(' ')
            var mname = line.substring(0,i).trim()
            var value = line.substring(i).trim()

            if ('machine_scrape_error container_scrape_error'.includes(mname)) {
                // we ignore scraping metrics
                // +++ implement a general messaging system for the user, for sending kwirth-scope signaling
                continue
            }

            // create specific new metrics for subtyped metrics: we create a new metric for each specific metric, and we don't add the orignal metrics
            if (mname==='container_memory_failures_total') {
                for (var sub of ['pgfault', 'pgmajfault']) {
                    var submetric = mname + '_' + sub
                    this.addRecordType(map, submetric, recordType, value)
                }
            }
            else if (mname==='container_tasks_state') {
                for (var sub of ['iowaiting', 'running', 'sleeping', 'stopped', 'uninterruptible']) {
                    var submetric = mname + '_' + sub
                    this.addRecordType(map, submetric, recordType, value)
                }
            }
            else {
                this.addRecordType(map, mname, recordType, value)
            }
        }
        return map
    }

    // creates a map containing all the metrics existing in the cluser (and their properties)
    public async loadMetrics(nodes:NodeData[]) {
        var resultMap = await this.loadNodeMetrics(nodes[0])

        for (var node of nodes.slice(1)) {
            var nodeMetricsMap = await this.loadNodeMetrics(node)
            for (var m of nodeMetricsMap.keys()) {
                if (!resultMap.has(m)) resultMap.set(m,nodeMetricsMap.get(m)!)
            }
        }
        this.metricsList = resultMap
    }

    // read metric raw values at a specific cluster node (invokes kubelet's cAdvisor)
    public readCAdvisorMetrics = async (node:NodeData) => {
        var text=''
        try {
            var resp = await fetch (`https://${node.ip}:10250/metrics/cadvisor`, { headers: { Authorization: 'Bearer ' + this.token} })
            text = await resp.text()
        }
        catch (error:any) {
            console.log('Error reading cAdvisor metrics', error)
            text=''
        }
        // add kwirth metrics
        text+='# HELP kwirth_cluster_memory_precentage Percentage of memory used by object from the whole cluster\n'
        text+='# TYPE kwirth_cluster_memory_precentage gauge\n'
        text+='kwirth_cluster_memory_precentage{container="xxx",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n'
        text+='# HELP kwirth_cluster_cpu_precentage Percentage of cpu used from the whole cluster\n'
        text+='# TYPE kwirth_cluster_cpu_precentage gauge\n'
        text+='kwirth_cluster_cpu_precentage{container="xxx",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n'
        text+='# HELP kwirth_cluster_random_values Random values\n'
        text+='# TYPE kwirth_cluster_random_values gauge\n'
        text+='kwirth_cluster_random_values{container="xxx",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n'

        return text
    }

    // reads node metrics and loads 'metricValues' with parsed and formated data
    public async readNodeMetrics(node:NodeData) {
        var rawSampledNodeMetrics = await this.readCAdvisorMetrics(node)
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var lines=rawSampledNodeMetrics.split('\n')
        var newMap:Map<string, number> = new Map()

        for (var line of lines) {
            if (line==='' || line.startsWith('#')) continue
            
            var i = line.indexOf('{')
            if (i<0) i=line.indexOf(' ')
            var sampledMetricName=line.substring(0,i)

            // now we obtain labels (we obtain groups in a while-loop)
            // and we create a labels object containing all labels and its values
            // for this line: container_fs_writes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracrnopro.azurecr.io/customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="customers-5cc8cb444f-psrwp"} 2929 1728588770767
            // we obtain:
            // {
            //    container:"costumers",
            //    device:"/dev/sda",
            //    id:...
            // }
            let m
            var labels:any={}
            while ((m = regex.exec(line)) !== null) {
                if (m.index === regex.lastIndex) regex.lastIndex++
                labels[m[1]]=m[2]
            }

            if (sampledMetricName.startsWith('machine_')) {
                /*
                    machine metrics have no timestamp, and they are no linked to containers nor pods, so we process them in a special way

                    machine_cpu_cores{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 8
                    machine_cpu_physical_cores{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 4
                    machine_cpu_sockets{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 1
                    machine_memory_bytes{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 3.3651703808e+10
                    machine_nvm_avg_power_budget_watts{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 0
                    machine_nvm_capacity{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",mode="app_direct_mode",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 0
                    machine_nvm_capacity{boot_id="ce1e483e-b238-42b2-9deb-a3665e3f8ff3",machine_id="dc3393257d514881b88878df01c28d2a",mode="memory_mode",system_uuid="3c99405a-660c-4cb5-a2ba-421add685332"} 0
                    machine_scrape_error 0
                */
                var parts=line.split(' ')
                var machineMetricvalue=parts[parts.length-1]
                node.machineMetrics.set(sampledMetricName, +machineMetricvalue)
                continue
            }

            if (!labels.pod) continue
            if (labels.container!=='' && (labels.scope==='container' || labels.scope===undefined)) {
                // we rebuild the metric name for subtyped metrics (we create synthetic metrics and we ignore the subtype)
                if (sampledMetricName==='container_memory_failures_total') sampledMetricName += '_' + labels.failure_type
                if (sampledMetricName==='container_tasks_state') sampledMetricName += '_' + labels.state

                i = line.indexOf('}')
                if (i>=0) {
                    // THIS IS THE METRIC NAME WE STORE IN THE MAP
                    sampledMetricName= labels.namespace + '/' + labels.pod + '/' + labels.container + '/' + sampledMetricName

                    var valueAndTimestamp=line.substring(i+1).trim()
                    if (valueAndTimestamp!==undefined) {
                        var value
                        if (valueAndTimestamp.includes(' '))
                            value = +valueAndTimestamp.split(' ')[0].trim()
                        else
                            value = +valueAndTimestamp.trim()

                        if (newMap.has(sampledMetricName)) {
                            console.log('Repeated metrics (will add values):')
                            console.log('Original metric:', sampledMetricName, newMap.get(sampledMetricName))
                            console.log('Duplicated  metric:', sampledMetricName, value)
                            newMap.set(sampledMetricName, newMap.get(sampledMetricName)! + value)
                        }
                        else
                            newMap.set(sampledMetricName, value)
                    }
                    else {
                        console.log('No value nor ts: ', line)
                    }
                }
                else {
                    if (!line.startsWith("machine_scrape_error") && !line.startsWith("container_scrape_error")) {
                        console.log('Invalid metric format: ', line)
                    }
                }
            }
            else {
                // line is not a container metric
            }
        }
        node.prevValues = node.metricValues
        node.metricValues = newMap
        node.timestamp = Date.now()
    }

    public readClusterMetrics = async () => {
        // +++ we should check cluster config (number of nodes) from time to time, it impacts calculation of kwirth_cluster_... metrics
        if (this.loadingClusterMetrics) {
            console.log('Still loading cluster metrics')
            return
        }
        this.loadingClusterMetrics = true
        console.log(`About to read cluster metrics ${new Date().toTimeString()}`)
        for (var node of ClusterData.nodes.values()) {
            this.readNodeMetrics(node)
        }
        this.loadingClusterMetrics = false
    }

    public getContainerMetricValue = (metricName:string, view:ServiceConfigViewEnum, asset:AssetData) => {
        var total=0
        var node=ClusterData.nodes.get(asset.podNode)
        if (node) {
            var metric = ClusterData.metrics.extractContainerMetrics(ClusterData.nodes.get(node.name)?.metricValues!, metricName, view, node, asset)
            total = metric.value
        }
        else {
            console.log('No node found for calculating pod metric value', asset)
        }
        return total
    }
    
    public getTotal = (metricName:string, values:number[]) => {
        var result:number
        var metric = ClusterData.metrics.getMetric(metricName)
        switch(metric?.type) {
            case 'gauge':
            case 'counter':
                result = values.reduce((ac,value) => ac+value, 0)
                break
            default:
                console.log(`Unsupported metric type: "${metric?.type}"`)
                result = 0
                break
        }
        if (metric?.eval && metric.eval!=='') {
            // +++ now process eval (pending impl)
        }
        
        return result
    }
    
    public extractContainerKwirthMetrics = (requestedMetricName:string, node:NodeData, view:ServiceConfigViewEnum, asset:AssetData) => {
        var result = { value: 0, timestamp: 0 }

        switch(requestedMetricName) {
            case 'kwirth_cluster_cpu_precentage':
                var vcpus = node.machineMetrics.get('machine_cpu_cores')
                vcpus=0
                for (var n of ClusterData.nodes.values()) {
                    vcpus += n.machineMetrics.get('machine_cpu_cores')!
                }
                let seconds = ClusterData.clusterMetricsInterval
                var podSeconds = (this.extractContainerMetrics(ClusterData.nodes.get(node.name)?.metricValues!, 'container_cpu_usage_seconds_total', view, node, asset)).value
                var podSecondsPrev = (this.extractContainerMetrics(ClusterData.nodes.get(node.name)?.prevValues!, 'container_cpu_usage_seconds_total', view, node, asset)).value
                console.log('cpus',vcpus)
                console.log('seconds',seconds)
                console.log('podSeconds',podSeconds)
                console.log('podSecondsPrev',podSecondsPrev)
                if (vcpus && podSeconds && podSecondsPrev) {
                    result = { value: ((podSeconds-podSecondsPrev)/(vcpus*seconds))*100, timestamp: node.timestamp }
                }
                else {
                    result = { value: 0, timestamp: node.timestamp }
                }
                return result
            case 'kwirth_cluster_memory_precentage':
                var memory = node.machineMetrics.get('machine_memory_bytes')
                var containerMemory = (this.extractContainerMetrics(ClusterData.nodes.get(node.name)?.metricValues!, 'container_memory_usage_bytes', view, node, asset)).value
                if (memory && containerMemory) {
                    result = { value: (containerMemory/memory*100), timestamp: node.timestamp }
                }
                else {
                    result = { value: 0, timestamp: node.timestamp }
                }
                return result
            case 'kwirth_cluster_random_values':
                var rndValue = Math.random()
                result = { value: rndValue, timestamp: node.timestamp }
                return result
            default:
                return result
        }
    }

    public extractContainerMetrics = (metricsSet:Map<string,number>, requestedMetricName:string, view:ServiceConfigViewEnum, node:NodeData, asset:AssetData) => {
        if (requestedMetricName.startsWith('kwirth_')) return this.extractContainerKwirthMetrics(requestedMetricName, node, view, asset)

        if (view === ServiceConfigViewEnum.CONTAINER) {
            var metricName = asset.podNamespace + '/' + asset.podName + '/' + asset.containerName + '/' + requestedMetricName
            var value = metricsSet.get(metricName)
            if (value !== undefined) {
                return  { value, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
            }
            else {
                console.log(`Metric '${metricName}' not found on node ${node.name}.`)
                return  { value: 0, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
            }    
        }
        else {
            // we extract all metrics in the metricsValue that have an imppact in calculating requested metrics (for instance, several container metrics for calculating pod metric)
            var subset = Array.from(metricsSet.keys()).filter (k => k.startsWith(asset.podNamespace + '/' + asset.podName+'/') && k.endsWith('/'+requestedMetricName))
            var metricDef = this.metricsList.get(requestedMetricName)
            switch(metricDef?.type) {
                case 'counter':
                    var accum = 0
                    for (var submetric of subset) {
                        accum += metricsSet.get(submetric)!
                    }
                    return  { value: accum, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
                case 'gauge':
                    var average = 0
                    if (subset.length>0) {
                        for (var submetric of subset) {
                            average += metricsSet.get(submetric)!
                        }
                        average /= subset.length
                    }
                    return  { value: average, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
                default:
                    console.log('Invalid metric type: ',metricDef?.type)
                    return  { value: 0, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
            }
        }
    }

}