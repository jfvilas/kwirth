import { CoreV1Api, CustomObjectsApi, V1Node } from "@kubernetes/client-node"
import { ClusterData, NodeData } from "./ClusterData"

export class Metrics {
    private coreApi:CoreV1Api
    private token:string
    private metricsList:Map<string,{help:string, type:string, eval:string}>
    private loadingClusterMetrics: boolean=false

    constructor (coreApi:CoreV1Api, token:string) {
        this.coreApi=coreApi
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

        container_fs_reads_bytes_total{container="eulen-customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 36864 1728588770767
        container_fs_reads_total{container="eulen-customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 5 1728588770767
        container_fs_writes_bytes_total{container="eulen-customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 2.643968e+07 1728588770767
        container_fs_writes_total{container="eulen-customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 2929 1728588770767

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

        console.log('Loading metrics from', node.ip)
        var allMetrics=await this.readCAdvisorMetrics(node)
        // console.log('allMetrics')
        // console.log(allMetrics)
        var lines=allMetrics.split('\n').filter(l => l.startsWith('#'))
        for (var line of lines) {
            var regType=line.substring(0,6).trim()
            line=line.substring(6).trim()
            var i=line.indexOf(' ')
            var mname=line.substring(0,i).trim()
            if ('machine_scrape_error container_scrape_error'.includes(mname)) continue

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
            // for (var m of nodeMap.keys()) {
            //     if (!resultMap.has(m)) nodeMap.delete(m)
            // }
            for (var m of resultMap.keys()) {
                if (!nodeMap.has(m)) resultMap.delete(m)
            }
        }
        // console.log('resultMap')
        // console.log(resultMap)
        this.metricsList = resultMap
    }

    public readCAdvisorMetrics = async (node:NodeData) => {
        var text=''
        try {
            var resp = await fetch (`https://${node.ip}:10250/metrics/cadvisor`, { headers: { Authorization: 'Bearer ' + this.token} })
            text = await resp.text()
        }
        catch (error:any) {
            console.log(`Error obtaining node metrics from cAdvisor at node ${node.ip}`)
            text=''
        }
        text+='# HELP container_kwirth_running_time Number of seconds the container has been running\n'
        text+='# TYPE container_kwirth_running_time counter\n'
        text+='container_kwirth_running_time{container="xxx",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 239 1733656438512\n'
        text+='# HELP container_kwirth_cpu_precentage Percentage of cpu used\n'
        text+='# TYPE container_kwirth_cpu_precentage gauge\n'
        text+='container_kwirth_cpu_precentage{container="xxx",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 40 1733656438512\n'
        text+='# HELP machine_kwirth_cpu_number Number of CPU reported at node\n'
        text+='# TYPE machine_kwirth_cpu_number gauge\n'
        text+='machine_kwirth_cpu_number{container="xxx",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 4 1733656438512\n'
        text+='# HELP container_kwirth_cpu_total_random_seconds Total random cpu seconds\n'
        text+='# TYPE container_kwirth_cpu_total_random_seconds counter\n'
        text+='container_kwirth_cpu_total_random_seconds{container="xxx",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 237229 1733656438512\n'

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
            var sampledMetricName=line.substring(0,i)

            // now we obtain labels (we obtain groups in a while-loop)
            // and we create a labels object containing all labels and its values
            // for this line: container_fs_writes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 2929 1728588770767
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

            if (!labels.pod || !labels.container) continue
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
                            // this metrcis has been reported as multivalued
                            //   container_blkio_device_usage_total{container="cc",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod6d27603d_4e54_40e3_ae72_6260866d5fa2.slice/cri-containerd-2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2.scope",image="cracreulennopro.azurecr.io/eulen-news-dev:1.1.0",major="8",minor="0",name="2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2",namespace="dev",operation="Read",pod="eulen-news-848c69d9cd-j7gtq"} 5.726208e+06 1733656317535
                            //   container_blkio_device_usage_total{container="cc",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod6d27603d_4e54_40e3_ae72_6260866d5fa2.slice/cri-containerd-2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2.scope",image="cracreulennopro.azurecr.io/eulen-news-dev:1.1.0",major="8",minor="0",name="2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2",namespace="dev",operation="Write",pod="eulen-news-848c69d9cd-j7gtq"} 6.91892224e+08 1733656317535
                            //
                            //   container_memory_failures_total{container="yy",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 237229 1733656438512
                            //   container_memory_failures_total{container="yy",failure_type="pgmajfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 30 1733656438512
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
        // console.log('newMap', node.name)
        // for (var k of newMap.keys())
        //     console.log(k, '=>', newMap.get(k))
        node.metricValues=newMap
        node.timestamp=Date.now()
    }

    public readClusterMetrics = async () => {
        if (this.loadingClusterMetrics) {
            console.log('Still loading cluster metrics')
            return
        }
        this.loadingClusterMetrics = true
        console.log('About to read cluster metrics')
        for (var node of ClusterData.nodes.values()) {
            this.readNodeMetrics(node)
        }
        this.loadingClusterMetrics = false
    }

    getPodStartTime = async (namespace:string, pod:string) => {
        var epoch:number=0
        try {
            const podResponse = await this.coreApi.readNamespacedPod(pod, namespace);
            const startTime = podResponse.body.status?.startTime;
            if (startTime!==undefined) epoch = startTime?.getTime()
        }
        catch (error) {
            console.error('Error obtaining pod information:', error);
        }
        return epoch
    }

    getContainerStartTime = async (namespace:string, pod:string, container:string) => {
        var epoch: number=0
        try {
            const podResponse = await this.coreApi.readNamespacedPod(pod, namespace)
            const containers = podResponse.body.status?.containerStatuses
            if (containers!==undefined) {
                containers.forEach(cont => {
                    if (cont.name===container) {
                        const startTime = cont.state?.running?.startedAt
                        if (startTime!==undefined) epoch = startTime?.getTime()
                    }
                })
            }
        }
        catch (error) {
            console.error('Error obtaining pod information:', error);
        }
        return epoch
    }
    

    public extractContainerKwirthMetrics = async (requestedMetricName:string, node:NodeData, podNamespace:string, podName:string, containerName:string) => {
        var result={ value: 0, timestamp: 0 }

        switch(requestedMetricName) {
            case 'container_kwirth_running_time':
                var rt:any=await this.extractContainerMetrics('container_start_time_seconds', node, podNamespace, podName, containerName)
                if (rt.value===0) {
                    if (containerName!=='') 
                        rt.value = await this.getContainerStartTime(podNamespace, podName, containerName)
                    else
                        rt.value = await this.getPodStartTime( podNamespace, podName)
                }
                result = { value: Date.now()-rt.value, timestamp: Date.now() }
                return result
            case 'container_kwirth_cpu_precentage':
                var totCpu=0
                if (node.kubernetesNode.status?.capacity!==undefined) totCpu+= +node.kubernetesNode.status?.capacity.cpu
                result = { value: totCpu, timestamp: Date.now() }
                return result
            case 'machine_kwirth_cpu_number':
                var numCpu=0
                if (node.kubernetesNode.status?.capacity!==undefined) numCpu = +node.kubernetesNode.status?.capacity.cpu
                result = { value: numCpu, timestamp: Date.now() }
                return result
            case 'container_kwirth_cpu_total_random_seconds':
                var rndValue = Math.random()
                result = { value: rndValue, timestamp: Date.now() }
                return result
            default:
                return result
        }
    }

    public extractContainerMetrics = async (requestedMetricName:string, node:NodeData, podNamespace:string, podName:string, containerName:string) => {
        if (requestedMetricName.startsWith('kwirth_')) return this.extractContainerKwirthMetrics(requestedMetricName, node, podNamespace, podName, containerName)

        var metricName=podName+'/'+containerName+'/'+requestedMetricName
        var value=ClusterData.nodes.get(node.name)?.metricValues.get(metricName)
        //console.log('value ', value)
        if (value!==undefined) {
            return  { value, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
        }
        else {
            console.log(`Metric '${metricName}' not found on node ${node.name}. Showing all nodes`)
            for (var onenode of ClusterData.nodes.values())
                console.log(onenode.name, '=>', onenode.metricValues.get(metricName))
            return  { value: 0, timestamp: ClusterData.nodes.get(node.name)?.timestamp }
        }
    }

    // public extractContainerMetrics = async (requestedMetricName:string, node:NodeData, podNamespace:string, podName:string, containerName:string) => {
    //     if (requestedMetricName.startsWith('kwirth_')) return this.extractContainerKwirthMetrics(requestedMetricName, node, podNamespace, podName, containerName)

    //     const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
    //     var samples:{value:number, timestamp:number}[]= []
    //     var lines=rawSampledNodeMetrics.split('\n')

    //     for (var line of lines) {
    //         var i = line.indexOf('{')
    //         var sampledMetricName=line.substring(0,i)

    //         if (sampledMetricName===requestedMetricName) {
    //             // now we obtain labels (we obtain groups in a while-loop)
    //             // and we create a labels object containing all labels and its values
    //             // for this line: container_fs_writes_total{container="customers",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod268dcd16_68d8_497e_a85c_3b6b5031518b.slice/cri-containerd-39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a.scope",image="cracreulennopro.azurecr.io/eulen-customers-dev:latest",name="39eaedb2106a4794c6094a4a142971f948e02b5fa104422f76889a48eeeb9f1a",namespace="dev",pod="eulen-customers-5cc8cb444f-psrwp"} 2929 1728588770767
    //             // we obtain:
    //             // {
    //             //    container:"costumers",
    //             //    device:"/dev/sda",
    //             //    id:...
    //             // }
    //             let m
    //             var labels:any={}
    //             while ((m = regex.exec(line)) !== null) {
    //                 if (m.index === regex.lastIndex) regex.lastIndex++
    //                 labels[m[1]]=m[2]
    //             }

    //             if (labels.pod && labels.pod.startsWith(podName) && labels.container === containerName && (labels.scope==='container' || labels.scope===undefined)) {
    //                 var i=line.indexOf('}')
    //                 if (i>=0) {
    //                     var valueAndTs=line.substring(i+1).trim()
    //                     if (valueAndTs) {
    //                         if (valueAndTs.includes(' ')) {
    //                             console.log('>>>>', line)
    //                             samples.push({ value: +valueAndTs.split(' ')[0].trim(), timestamp: +valueAndTs.split(' ')[1].trim() })
    //                         }
    //                         else {
    //                             // the metric has value but it has no timestamp
    //                             console.log('>>>>', line)
    //                             samples.push({ value: +valueAndTs.split(' ')[0].trim(), timestamp: 0 })
    //                         }
    //                     }
    //                     else {
    //                         console.log('No value nor ts: ', line)
    //                     }
    //                 }
    //                 else {
    //                     console.log('Invalid metric format: ', line)
    //                 }
    //             }
    //         }
    //     }
    //     var result = {value:0, timestamp:0}
    //     if (samples.length===0) {
    //         // these are metric requested by user that have not been found when asking form values at the node wuehre the container is running
    //     }
    //     else  if (samples.length===1) {
    //         result = samples[0]
    //     }
    //     else {
    //         // this metrcis has been reported as multivalued
    //         //   container_blkio_device_usage_total{container="eulen-news",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod6d27603d_4e54_40e3_ae72_6260866d5fa2.slice/cri-containerd-2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2.scope",image="cracreulennopro.azurecr.io/eulen-news-dev:1.1.0",major="8",minor="0",name="2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2",namespace="dev",operation="Read",pod="eulen-news-848c69d9cd-j7gtq"} 5.726208e+06 1733656317535
    //         //   container_blkio_device_usage_total{container="eulen-news",device="/dev/sda",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod6d27603d_4e54_40e3_ae72_6260866d5fa2.slice/cri-containerd-2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2.scope",image="cracreulennopro.azurecr.io/eulen-news-dev:1.1.0",major="8",minor="0",name="2e967beb3b04e3f34805909cd1a5ac8b3bfcec910cc81cba763fdf830b0669c2",namespace="dev",operation="Write",pod="eulen-news-848c69d9cd-j7gtq"} 6.91892224e+08 1733656317535
    //         //
    //         //   container_memory_failures_total{container="eulen-reports",failure_type="pgfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 237229 1733656438512
    //         //   container_memory_failures_total{container="eulen-reports",failure_type="pgmajfault",id="/kubepods.slice/kubepods-besteffort.slice/kubepods-besteffort-pod647db86f_3af5_4041_b2d1_9100e401d7eb.slice/cri-containerd-29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980.scope",image="cracreulennopro.azurecr.io/eulen-reports-dev:1.1.0",name="29b103a2ad113a226ff97be1c8f97b08c6066109550198d276f887360a7bd980",namespace="dev",pod="eulen-reports-5b9ddf4fd4-tl25h",scope="container"} 30 1733656438512
    //         //console.log('**** multivalue metric', requestedMetricName)
    //         result = { value: samples.reduce( (ac,val) => ac+val.value, 0), timestamp:samples[0].timestamp }
    //     }
    //     //console.log('result',result)
    //     return result
    // }

}