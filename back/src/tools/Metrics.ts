import { ClusterInfo, NodeInfo } from "../model/ClusterInfo"
import { InstanceConfigViewEnum } from "@jfvilas/kwirth-common"

export interface AssetData {
    podNode:string
    podNamespace:string
    podGroup:string
    podName:string 
    containerName:string
}

export interface MetricDefinition {
    help: string
    type: string
    eval: string
}

export class MetricsTools {
    private clusterInfo:ClusterInfo
    private metricsList: Map<string,MetricDefinition>
    private loadingClusterMetrics: boolean = false

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
        this.metricsList = new Map()
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

    // obteians the list of metrics available (its names, types and descriptions)
    public getMetricsList() {
        return Array.from(this.metricsList.keys()).map ( metricName => { return { metric:metricName, ...this.metricsList.get(metricName)} })
    }

    // adds properties to matrics map
    addRecordType (map:Map<string,MetricDefinition>, metricName:string, recordType:string, value:string): void {
        if (!map.has(metricName)) map.set(metricName,{help: '', type: '', eval: ''})
        switch(recordType) {
            case '# HELP':
                map.get(metricName)!.help = value
                break
            case '# TYPE':
                map.get(metricName)!.type = value
                break
            case '# EVAL':
                map.get(metricName)!.eval = value
                break
        }
    }

    // creates a map containing all existing metrics in a cluster node (and their properties), but not values
    async loadNodeMetrics(node:NodeInfo): Promise <Map<string,MetricDefinition>> {
        var map:Map<string,MetricDefinition> = new Map()

        var allMetrics = await this.readCAdvisorMetrics(node)
        var lines = allMetrics.split('\n').filter(l => l.startsWith('#'))
        for (var line of lines) {
            var recordType=line.substring(0,6).trim()
            line = line.substring(6).trim()
            var i = line.indexOf(' ')
            var mname = line.substring(0,i).trim()
            var value = line.substring(i).trim()

            if ('machine_scrape_error container_scrape_error'.includes(mname)) {
                // we ignore scraping metrics
                continue
            }

            // create specific new metrics for subtyped metrics: we create a new metric for each specific metric, and we don't add the orignal metrics
            if (mname==='container_memory_failures_total') {
                for (var sub of ['pgfault', 'pgmajfault']) {
                    var submetric = mname + '_' + sub
                    this.addRecordType(map, submetric, recordType, value)
                }
            }
            if (mname==='container_blkio_device_usage_total') {
                for (var sub of ['read', 'write']) {
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

    startMetrics = async () => {
        console.log('Metrics information for cluster is being loaded')
        let nodes = Array.from(this.clusterInfo.nodes.values())

        this.metricsList = new Map()
        for (var node of nodes) {
            var nodeMetricsMap = await this.loadNodeMetrics(node)
            for (var m of nodeMetricsMap.keys()) {
                if (!this.metricsList.has(m)) this.metricsList.set(m,nodeMetricsMap.get(m)!)
            }
        }

        this.clusterInfo.vcpus = 0
        this.clusterInfo.memory = 0
        for (let node of nodes.values()) {
            await this.readNodeMetrics(node)
            if (node.machineMetricValues.get('machine_cpu_cores')) this.clusterInfo.vcpus += node.machineMetricValues.get('machine_cpu_cores')!.value
            if (node.machineMetricValues.get('machine_memory_bytes')) this.clusterInfo.memory += node.machineMetricValues.get('machine_memory_bytes')!.value
        }
        this.clusterInfo.startInterval(this.clusterInfo.metricsInterval)
        console.log('Metrics recollection started')
    }

    /*
    curl https://172.18.0.3:10250/metrics/cadvisor -k -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkFVaEIzSjdNeTBmVmdfZTRtWlVoSnlwMVlTWk5fZ180SWtKcEdHMElfNmMifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJkZWZhdWx0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Imt3aXJ0aC1zYS1rd2lydGh0b2tlbiIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJrd2lydGgtc2EiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiIwMmE2N2Y3Ni0zNWNhLTQzYmMtYjQxNS03MzUwNTM1NGFjM2IiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6ZGVmYXVsdDprd2lydGgtc2EifQ.mT7HDvn0e7I-iZmznMaqocOmH92Srrib_qdiXu1GDx4tmpRbmYVZN3aCBB2ZwUT-aFnKcvTZMWUlvm_bZUvNzbOq1CZ4SJXB1oij-6wrEf8_d7ZRNrOnvzi7hNs9wKR3V8uEck5avbxTZmRGAoOsuI42KQZ8ABQURf7WqWz0ZdvUh2_WrLZnOrqopbXnLhKuYmbq9pKphsZvWUKTrMmb7hxeTUYzrMKtAAjesLqYla-nNAKgrSktOrbZtvpNuOPdPKhntlHzs-Jj_vbMWH0rbbGSqR88IfmGSt4hqWiQtvTZC0IdVcVXuIc-0aD1GE4M_S0PoSed_Lwiq7e8MQhSqg"
    */

    // read metric raw values at a specific cluster node (invokes kubelet's cAdvisor)
    public readCAdvisorMetrics = async (node:NodeInfo): Promise<string> => {
        var text=''
        try {
            var resp = await fetch (`https://${node.ip}:10250/metrics/cadvisor`, { headers: { Authorization: 'Bearer ' + this.clusterInfo.token} })
            //var resp = await fetch (`https://psd-k8s-dev.azure.plexusdevops.com/kwirth/metrics/debug/text/aks-basv2pool-33612910-vmss000000`, { headers: { Authorization: '7db98cec-8891-7c53-539a-f7917c650662|permanent|cluster::+::'} })

            text = await resp.text()
        }
        catch (error:any) {
            console.log(`Error reading cAdvisor metrics at node ${node.ip}`, error.stack)
            text=''
        }
        // add kwirth container metrics
        text += '# HELP kwirth_container_memory_percentage Percentage of memory used by object from the whole cluster\n'
        text += '# TYPE kwirth_container_memory_percentage gauge\n'
        text += 'kwirth_container_memory_percentage{container="xxx",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n'

        text += '# HELP kwirth_container_cpu_percentage Percentage of cpu used from the whole cluster\n'
        text += '# TYPE kwirth_container_cpu_percentage gauge\n'
        text += 'kwirth_container_cpu_percentage{container="xxx",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n'

        text += '# HELP kwirth_container_random_counter Accumulated container random values\n'
        text += '# TYPE kwirth_container_random_counter counter\n'
        text += `kwirth_container_random_counter{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n`

        text += '# HELP kwirth_container_random_gauge Instant container random values\n'
        text += '# TYPE kwirth_container_random_gauge gauge\n'
        text += `kwirth_container_random_gauge{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h",scope="container"} 0 1733656438512\n`

        text += '# HELP kwirth_container_transmit_percentage Percentage of data sent in relation to the whole cluster\n'
        text += '# TYPE kwirth_container_transmit_percentage gauge\n'
        text += 'kwirth_container_transmit_percentage{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h"} 0 1733656438512\n'

        text += '# HELP kwirth_container_receive_percentage Percentage of data received in relation to the whole cluster\n'
        text += '# TYPE kwirth_container_receive_percentage gauge\n'
        text += 'kwirth_container_receive_percentage{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h"} 0 1733656438512\n'

        text += '# HELP kwirth_container_transmit_mbps Mbps of data sent over the last period\n'
        text += '# TYPE kwirth_container_transmit_mbps gauge\n'
        text += 'kwirth_container_transmit_mbps{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h"} 0 1733656438512\n'

        text += '# HELP kwirth_container_receive_mbps Mbps of data received over the last period\n'
        text += '# TYPE kwirth_container_receive_mbps gauge\n'
        text += 'kwirth_container_receive_mbps{container="",id="kwirth",image="doker.io/kwirth",name="kwirth",namespace="default",pod="kwirth-5b9ddf4fd4-tl25h"} 0 1733656438512\n'

        return text
    }

    // reads node metrics and loads 'metricValues' with parsed and formated data
    public async readNodeMetrics(node:NodeInfo): Promise<void> {
        var rawSampledNodeMetrics = await this.readCAdvisorMetrics(node)
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var lines=rawSampledNodeMetrics.split('\n')
        var newContainerMetricValues:Map<string, {value: number, timestamp:number}> = new Map()
        var newPodMetricValues:Map<string, {value: number, timestamp:number}> = new Map()
        var newMachineMetricValues:Map<string, {value: number, timestamp:number}> = new Map()

        for (var line of lines) {
            if (line==='' || line.startsWith('#')) continue
            
            let i = line.indexOf('{')
            if (i<0) i=line.indexOf(' ')
            let sampledMetricName=line.substring(0,i)
            let sourceMetricName = sampledMetricName

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
                var machineMetricvalue = parts[parts.length-1]
                //node.machineMetricValues.set(sampledMetricName, +machineMetricvalue)
                newMachineMetricValues.set(sampledMetricName, { value: +machineMetricvalue, timestamp: Date.now()} )
                continue
            }

            if (!labels.pod) continue

            // we rebuild the metric name for subtyped metrics (we create synthetic metrics and we ignore the subtype)
            if (sampledMetricName==='container_memory_failures_total') sampledMetricName += '_' + labels.failure_type
            if (sampledMetricName==='container_tasks_state') sampledMetricName += '_' + labels.state
            if (sampledMetricName==='container_blkio_device_usage_total') sampledMetricName += '_' + labels.operation.toLowerCase()
    
            if (labels.container!=='' && (labels.scope==='container' || labels.scope===undefined)) {

                i = line.indexOf('}')
                if (i>=0) {
                    // THIS IS THE METRIC NAME WE STORE IN THE MAP
                    sampledMetricName= labels.namespace + '/' + labels.pod + '/' + labels.container + '/' + sampledMetricName

                    var valueAndTimestamp=line.substring(i+1).trim()
                    if (valueAndTimestamp!==undefined) {
                        let newValue = 0
                        let timestamp = 0
                        if (valueAndTimestamp.includes(' ')) {
                            newValue = +valueAndTimestamp.split(' ')[0].trim()
                            timestamp = +valueAndTimestamp.split(' ')[1].trim()
                        }
                        else {
                            newValue = +valueAndTimestamp.trim()
                        }

                        if (newContainerMetricValues.has(sampledMetricName)) {
                            if ('container_blkio_device_usage_total container_fs_writes_total container_fs_reads_bytes_total container_fs_reads_total container_fs_writes_bytes_total'.includes(sourceMetricName)) {
                                // it is a synthetic metrics (read & write are labels promoted to metric name)
                                // device usage contains data for different volumes (/dev/sda, /dev/sdb...)
                                // we just sum app all operations ignoring the device
                                newContainerMetricValues.set(sampledMetricName, { value: newValue + newContainerMetricValues.get(sampledMetricName)!.value, timestamp:timestamp } )                                    
                            }
                            else {
                                console.log('Repeated container metrics (will add values):')
                                console.log('Line:')
                                console.log(line)
                                console.log('Original metric:', sampledMetricName, newContainerMetricValues.get(sampledMetricName))
                                console.log('Duplicated  metric:', sampledMetricName, newValue)
                                newContainerMetricValues.set(sampledMetricName, { value: newContainerMetricValues.get(sampledMetricName)!.value, timestamp: timestamp} )
                            }
                        }
                        else
                            newContainerMetricValues.set(sampledMetricName, { value: newValue, timestamp:timestamp} )
                    }
                    else {
                        console.log('No value nor ts for container metric: ', line)
                    }
                }
                else {
                    console.log('Invalid container metric format: ', line)
                }
            }
            else {
                if (labels.container==='' && labels.pod!=='' && labels.namespace!=='' && labels.image!=='' && (labels.scope==='hierarchy' || labels.scope===undefined)) {
                    // pod metrics
                    i = line.indexOf('}')
                    if (i>=0) {
                        // this is the metric key we store in the map (NO CONTAINER NAME IN THE METRIC NAME)
                        sampledMetricName= labels.namespace + '/' + labels.pod + '/' + sampledMetricName
    
                        var valueAndTimestamp=line.substring(i+1).trim()
                        if (valueAndTimestamp!==undefined) {
                            let newValue = 0
                            let timestamp = 0
                            if (valueAndTimestamp.includes(' ')) {
                                newValue = +valueAndTimestamp.split(' ')[0].trim()
                                timestamp = +valueAndTimestamp.split(' ')[1].trim()
                            }
                            else
                                newValue = +valueAndTimestamp.trim()
    
                            if (newPodMetricValues.has(sampledMetricName)) {
                                if ('container_network_transmit_packets_dropped_total container_network_transmit_errors_total container_network_transmit_bytes_total container_network_transmit_packets_total container_network_transmit_packets_total container_network_receive_packets_total container_network_receive_bytes_total container_network_receive_errors_total container_network_receive_packets_dropped_total'.includes(sourceMetricName)) {
                                    // duplicated metrics because of different network interfaces exist
                                    // so we just sum up all metrics (we don't care about the exact network interface)
                                    newPodMetricValues.set(sampledMetricName, { value: newValue + newPodMetricValues.get(sampledMetricName)!.value, timestamp:timestamp } )
                                }
                                else {
                                    console.log('Repeated pod metrics (will add values):')
                                    console.log('Line:')
                                    console.log(line)
                                    console.log('Original metric:   ', sampledMetricName, newPodMetricValues.get(sampledMetricName))
                                    console.log('Duplicated  metric:', sampledMetricName, newValue)
                                    newPodMetricValues.set(sampledMetricName, { value: newValue + newPodMetricValues.get(sampledMetricName)!.value, timestamp:timestamp } )
                                }
                            }
                            else
                                newPodMetricValues.set(sampledMetricName, { value: newValue, timestamp:timestamp })
                        }
                        else {
                            console.log('No value nor ts for pode metric: ', line)
                        }
                    }
                    else {
                        console.log('Invalid pod metric format: ', line)
                    }    
                }
                else {
                    // line is not a pod metric
                }
                
            }
        }
        node.prevContainerMetricValues = node.containerMetricValues
        node.containerMetricValues = newContainerMetricValues

        node.prevPodMetricValues = node.podMetricValues
        node.podMetricValues = newPodMetricValues

        node.prevMachineMetricValues = node.machineMetricValues
        node.machineMetricValues = newMachineMetricValues
        node.timestamp = Date.now()
    }

    // read metrics and values for all nodes in the cluster
    public readClusterMetrics = async (clusterInfo: ClusterInfo): Promise<void> => {
        if (this.loadingClusterMetrics) {
            console.log(`Still loading cluster metrics ${new Date().toTimeString()}`)
            return
        }

        //if (global.gc) global.gc()
        this.loadingClusterMetrics = true

        try {
            console.log(`About to read cluster metrics ${new Date().toTimeString()}`)

            // we rebuild the list of nodes
            let newNodeSet = await clusterInfo.loadNodes()
            // remove inxistent nodes
            for (let nodeName of Array.from(clusterInfo.nodes.keys())) {
                if (!newNodeSet.get(nodeName)) clusterInfo.nodes.delete(nodeName)
            }
            // add new nodes
            for (let nodeName of Array.from(newNodeSet.keys())) {
                if (!clusterInfo.nodes.get(nodeName)) clusterInfo.nodes.set(nodeName, newNodeSet.get(nodeName)!)
            }

            // we read the metrics of the nodeset
            for (let node of clusterInfo.nodes.values()) {
                await this.readNodeMetrics(node)
            }
        }
        catch (err) {
            console.log('Error reading cluster metrics')
            console.log(err)
        }
        this.loadingClusterMetrics = false
    }

    // get a spsecific value for a concrete metric
    public extractContainerMetrics = (clusterInfo:ClusterInfo, podMetricsSet:Map<string,{value: number, timestamp:number}>, containerMetricsSet:Map<string,{value: number, timestamp:number}>, requestedMetricName:string, view:InstanceConfigViewEnum, node:NodeInfo, asset:AssetData): {value:number, timestamp:number|undefined }=> {
        if (view === InstanceConfigViewEnum.CONTAINER) {
            var metricName = asset.podNamespace + '/' + asset.podName + '/' + asset.containerName + '/' + requestedMetricName
            var value = containerMetricsSet.get(metricName)?.value
            if (value !== undefined) {
                return  { value, timestamp: clusterInfo.nodes.get(node.name)?.timestamp }
            }
            else {
                console.log(`Metric '${metricName}' not found on node ${node.name}.`)
                return  { value: 0, timestamp: clusterInfo.nodes.get(node.name)?.timestamp }
            }    
        }
        else {
            // we extract all metrics in the metricsValue that have an impact in calculating requested metrics (for instance, several container metrics for calculating pod metric)
            // we get some metric values ignoring the container (just ckecking namespace, pod and metricname)
            var subset = Array.from(containerMetricsSet.keys()).filter (k => k.startsWith(asset.podNamespace + '/' + asset.podName+'/') && k.endsWith('/'+requestedMetricName))
            if (subset.length===0) {
                // if we cannot get metrics when extracting data from container metrics, we look for podMetrics
                var podValue = podMetricsSet.get(asset.podNamespace + '/' + asset.podName+'/'+requestedMetricName)?.value
                if (podValue)
                    return  { value: podValue, timestamp: clusterInfo.nodes.get(node.name)?.timestamp }
                else {
                    console.log(`Pod metric value not found for: ${asset.podNamespace + '/' + asset.podName+'/'+requestedMetricName}`)
                    return  { value: 0, timestamp: clusterInfo.nodes.get(node.name)?.timestamp }
                }
            }
            else {
                var accum = 0
                for (var submetric of subset) { 
                    var v = containerMetricsSet.get(submetric)!.value
                    accum +=v
                }
                return  { value: accum, timestamp: clusterInfo.nodes.get(node.name)?.timestamp }
            }
        }
    }

}