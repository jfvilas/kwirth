import { CoreV1Api, CustomObjectsApi, V1Node } from "@kubernetes/client-node"

export class Metrics {
    private coreApi:CoreV1Api
    private token:string
    private metricsList:Map<string,{help:string, type:string, eval:string}>

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

    public async loadMetrics(nodeIp:string) {
        console.log('Loading metrics from', nodeIp)
        var allMetrics=await this.getNodeMetrics(nodeIp)
        console.log('Metrics loaded\n', allMetrics)
        var lines=allMetrics.split('\n')
        lines=lines.filter(l => l.startsWith('#'))
        lines.push('# HELP kwirth_running_time Number of seconds the container has been running')
        lines.push('# TYPE kwirth_running_time counter')
        lines.push('# HELP kwirth_cpu_precentage Percentage of cpu used')
        lines.push('# TYPE kwirth_cpu_precentage gauge')
        lines.push('# HELP kwirth_cpu_number number of CPU reported at node')
        lines.push('# TYPE kwirth_cpu_number gauge')
        lines.push('# HELP kwirth_cpu_total_random_seconds total random cpu seconds')
        lines.push('# TYPE kwirth_cpu_total_random_seconds counter')
        for (var line of lines) {
            var regType=line.substring(0,6).trim()
            line=line.substring(6).trim()
            var i=line.indexOf(' ')
            var mname=line.substring(0,i).trim()
            if (!this.metricsList.has(mname)) this.metricsList.set(mname,{help: '', type: '', eval: ''})

            switch(regType) {
                case '# HELP':
                    this.metricsList.get(mname)!.help=line.substring(i).trim()
                    break
                case '# TYPE':
                    this.metricsList.get(mname)!.type=line.substring(i).trim()
                    break
                case '# EVAL':
                    this.metricsList.get(mname)!.eval=line.substring(i).trim()
                    break
            }
        }
        console.log(this.metricsList)
    }

    public getNodeMetrics = async (nodeIp:string) => {
        try {
            var resp = await fetch (`https://${nodeIp}:10250/metrics/cadvisor`,{ headers: { Authorization: 'Bearer ' + this.token} })
            var text = await resp.text()
            return text
        }
        catch (error:any) {
            console.log(`Error obtaining node metrics from cAdvisor at node ${nodeIp}`)
        }
        return ''
    }

    getPodStartTime = async (namespace:string, pod:string) => {
        var epoch:number=0
        try {
            const podResponse = await this.coreApi.readNamespacedPod(pod, namespace);
            const startTime = podResponse.body.status?.startTime;
            if (startTime) epoch = startTime?.getTime()
        }
        catch (error) {
            console.error('Error obteniendo la información del pod:', error);
        }
    }

    getContainerStartTime = async (namespace:string, pod:string, container:string) => {
        var epoch: number=0
        try {
            const podResponse = await this.coreApi.readNamespacedPod(pod, namespace)
            const containers = podResponse.body.status?.containerStatuses
            if (containers) {
                containers.forEach(cont => {
                    console.log(cont)
                    if (cont.name===container) {
                        const startTime = cont.state?.running?.startedAt
                        if (startTime) epoch = startTime?.getTime()
                    }
                })
            }
        }
        catch (error) {
            console.error('Erro obtaining pod information:', error);
        }
        return epoch
    }
    

    public extractContainerMetrics = async (requestedMetricName:string, node:V1Node, sampledMetrics:string, prevValues:number[], podNamespace:string, podName:string, containerName:string) => {
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var samples:any[]= []
        var timestamp=0
        var result={ value: 0, timestamp: 0 }

        if (requestedMetricName.startsWith('kwirth_')) {
            switch(requestedMetricName) {
                case 'kwirth_running_time':
                    var rt:any=await this.extractContainerMetrics('container_start_time_seconds', node, sampledMetrics, prevValues, podNamespace, podName, containerName)
                    if (rt.value===0) {
                        if (containerName!=='') 
                            rt.value = await this.getContainerStartTime(podNamespace, podName, containerName)
                        else
                            rt.value = await this.getPodStartTime( podNamespace, podName)
                    }
                    result = { value: Date.now()-rt.value, timestamp: Date.now() }
                    return result
                case 'kwirth_cpu_precentage':
                    var totCpu=0
                    if (node.status?.capacity) totCpu+= +node.status?.capacity.cpu
                    result = { value: totCpu, timestamp: Date.now() }
                    return result
                case 'kwirth_cpu_number':
                    var numCpu=0
                    if (node.status?.capacity) numCpu = +node.status?.capacity.cpu
                    result = { value: numCpu, timestamp: Date.now() }
                    return result
                case 'kwirth_cpu_total_random_seconds':
                    var rndValue = Math.random()
                    result = { value: rndValue, timestamp: Date.now() }
                    return result
                default:
                    return result
            }
        }

        var lines=sampledMetrics.split('\n')
        for (var line of lines) {
            var i = line.indexOf('{')
            var sampledMetricName=line.substring(0,i)

            //we will only process requested metric
            if (sampledMetricName===requestedMetricName) {
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

                // +++ pending get metrics for different aggregations (namespace, pod regex, etc...)
                if (labels.pod && labels.pod.startsWith(podName) && labels.container && labels.container!=='') {
                    var i=line.indexOf('}')
                    if (i>=0) {
                        var valueAndTs=line.substring(i+1)
                        if (valueAndTs) {
                            valueAndTs=valueAndTs.trim()
                            var sample=labels
                            sample.metric=requestedMetricName
                            if (valueAndTs.includes(' ')) {
                                sample.value = +valueAndTs.split(' ')[0].trim()
                                timestamp = +valueAndTs.split(' ')[1].trim()
                                samples.push(sample)
                                if (containerName!=='' && labels.container===containerName) break
                            }
                            else {
                                // the metrics is absolute, fixed, has no timestamp
                                sample.value = +(valueAndTs.trim())
                            }
                        }
                        else {
                            console.log('No value/ts: ', line)
                        }
                    }
                    else {
                        console.log('Invalid metric format: ', line)
                    }
                }

            }
        }
        console.log('sum:',requestedMetricName)
        console.log('samples:', samples)
        // we now reduce the values. it's needed if, for example, we want pod values, so we must aggregate container values
        // it is also neded to make higher level aggregations, like namespace
        var sum={ value:0 }
        if (samples.length>0) {
            console.log('metric', requestedMetricName, 'samples', samples.length)
            console.log('samples',samples)
            sum=samples.reduce( (prev, current) => { return { value: prev.value + current.value }}, {value:0})
        }
        result = { value: sum.value, timestamp }
        console.log('result',result)
        return result
    }

}