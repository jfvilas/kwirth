import { CoreV1Api, CustomObjectsApi, V1Node } from "@kubernetes/client-node"
import { ClusterData, NodeData } from "./ClusterData"
import { ServiceConfigViewEnum } from "@jfvilas/kwirth-common"

export interface AssetData {
    podNode:string, 
    podNamespace:string,
    podGroup:string,
    podName:string, 
    containerName:string, 
    startTime:number
}

export class Metrics {
    private token:string
    private metricsList:Map<string,{help:string, type:string, eval:string}>
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

    async loadNodeMetrics(node:NodeData):Promise <Map<string,{help:string, type:string, eval:string}>> {
        var map:Map<string,{help:string, type:string, eval:string}> = new Map()

        var allMetrics=await this.readCAdvisorMetrics(node)
        var lines=allMetrics.split('\n').filter(l => l.startsWith('#'))
        for (var line of lines) {
            var regType=line.substring(0,6).trim()
            line=line.substring(6).trim()
            var i=line.indexOf(' ')
            var mname=line.substring(0,i).trim()

            if ('machine_scrape_error container_scrape_error'.includes(mname)) {
                // +++ implement a general messaging system for the user, for sending kwirth-scope signaling
                continue
            }

            if (!map.has(mname)) map.set(mname,{help: '', type: '', eval: ''})

            switch(regType) {
                case '# HELP':
                    map.get(mname)!.help=line.substring(i).trim()
                    break
                case '# TYPE':
                    map.get(mname)!.type=line.substring(i).trim()
                    break
                case '# EVAL':
                    map.get(mname)!.eval=line.substring(i).trim()
                    break
            }
        }
        return map
    }

    public async loadMetrics(nodes:NodeData[]) {
        var resultMap = await this.loadNodeMetrics(nodes[0])

        for (var node of nodes.slice(1)) {
            var nodeMap = await this.loadNodeMetrics(node)
            for (var m of resultMap.keys()) {
                if (!nodeMap.has(m)) resultMap.delete(m)
            }
        }
        this.metricsList = resultMap
    }

    public readCAdvisorMetrics = async (node:NodeData) => {
        var text=''
        try {
            var resp = await fetch (`https://${node.ip}:10250/metrics/cadvisor`, { headers: { Authorization: 'Bearer ' + this.token} })
            text = await resp.text()
        }
        catch (error:any) {
            text=''
        }
        text+='# HELP kwirth_container_memory_precentage Percentage of memory used by object\n'
        text+='# TYPE kwirth_container_memory_precentage gauge\n'
        text+='kwirth_container_memory_precentage{container="xxx",pod="reports-5b9ddf4fd4-tl25h",scope="container"} 239 1733656438512\n'
        text+='# HELP kwirth_container_cpu_precentage Percentage of cpu used\n'
        text+='# TYPE kwirth_container_cpu_precentage gauge\n'
        text+='kwirth_container_cpu_precentage{container="xxx",pod="reports-5b9ddf4fd4-tl25h",scope="container"} 40 1733656438512\n'
        text+='# HELP kwirth_container_random_values Total random cpu seconds\n'
        text+='# TYPE kwirth_container_random_values gauge\n'
        text+='kwirth_container_random_values{container="xxx",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracrnopro.azurecr.io/reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="reports-5b9ddf4fd4-tl25h",scope="container"} 237229 1733656438512\n'

        return text
    }

    public async readNodeMetrics(node:NodeData) {
        var rawSampledNodeMetrics = await this.readCAdvisorMetrics(node)      
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var lines=rawSampledNodeMetrics.split('\n')
        lines=lines.filter(l => !l.startsWith('#'))
        var newMap:Map<string, number> = new Map()

        for (var line of lines) {
            if (line==='') continue
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
            if ((labels.scope==='container' || labels.scope===undefined)) {
                i = line.indexOf('}')
                if (i>=0) {
                    sampledMetricName= labels.pod + '/' + labels.container + '/' + sampledMetricName
                    var valueAndTs=line.substring(i+1).trim()
                    if (valueAndTs!==undefined) {
                        var value
                        if (valueAndTs.includes(' '))
                            value=+valueAndTs.split(' ')[0].trim()
                        else
                            value=+valueAndTs.trim()

                        if (newMap.has(sampledMetricName))
                            newMap.set(sampledMetricName,newMap.get(sampledMetricName)! + value)
                        else
                            newMap.set(sampledMetricName, value)
                    }
                    else
                        console.log('No value nor ts: ', line)
                }
                else {
                    if (!line.startsWith("machine_scrape_error") && !line.startsWith("container_scrape_error")) {
                        console.log('Invalid metric format: ', line)
                    }
                }
            }
        }
        node.metricValues=newMap
        node.timestamp=Date.now()
    }

    public readClusterMetrics = async () => {
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
            var metric = ClusterData.metrics.extractContainerMetrics(metricName, view, node, asset)
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
        // +++ now process eval
        if (metric?.eval && metric.eval!=='') {
    
        }
        
        return result
    }
    
    public extractContainerKwirthMetrics = (requestedMetricName:string, node:NodeData, view:ServiceConfigViewEnum, asset:AssetData) => {
        var result={ value: 0, timestamp: 0 }

        switch(requestedMetricName) {
            case 'kwirth_container_cpu_precentage':
                var vcpus = node.machineMetrics.get('machine_cpu_cores')
                var seconds = Date.now() - asset.startTime
                var podSeconds = (this.extractContainerMetrics('container_cpu_usage_seconds_total', view, node, asset)).value
                if (vcpus && podSeconds) {
                    result = { value: (podSeconds/(vcpus*seconds))*100, timestamp: Date.now() }
                }
                else {
                    result = { value: 0, timestamp: Date.now() }
                }
                return result
            case 'kwirth_container_memory_precentage':
                var memory = node.machineMetrics.get('machine_memory_bytes')
                var containerMemory = (this.extractContainerMetrics('container_memory_usage_bytes', view, node, asset)).value
                if (memory && containerMemory) {
                    result = { value: (containerMemory/memory*100), timestamp: Date.now() }
                }
                else {
                    result = { value: 0, timestamp: Date.now() }
                }
                return result
            case 'kwirth_container_random_values':
                var rndValue = Math.random()
                result = { value: rndValue, timestamp: Date.now() }
                return result
            default:
                return result
        }
    }

    public extractContainerMetrics = (requestedMetricName:string, view:ServiceConfigViewEnum, node:NodeData, asset:AssetData) => {
        if (requestedMetricName.startsWith('kwirth_')) return this.extractContainerKwirthMetrics(requestedMetricName, node, view, asset)

        if (view !== ServiceConfigViewEnum.CONTAINER) asset.containerName=''
        
        var metricName=asset.podName+'/' + asset.containerName+'/'+requestedMetricName
        var value=ClusterData.nodes.get(node.name)?.metricValues.get(metricName)
        if (value!==undefined) {
            return  { value, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
        }
        else {
            console.log(`Metric '${metricName}' not found on node ${node.name}. Showing same metric on all nodes`)
            return  { value: 0, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
        }
    }

}