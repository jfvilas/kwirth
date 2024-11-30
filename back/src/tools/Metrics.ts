import { CustomObjectsApi } from "@kubernetes/client-node"


export class Metrics {
    private customApi:CustomObjectsApi
    private token:string

    constructor (customApi: CustomObjectsApi, token:string) {
        this.customApi=customApi
        this.token=token
    }

    private getNodeMetrics = async () => {
        try {
            const response = await this.customApi.listClusterCustomObject(
                'metrics.k8s.io', // Group
                'v1beta1',        // Version
                'nodes'
            );
            console.log(JSON.stringify(response.body, null, 2))
        }
        catch (err) {
            console.error('Error fetching node metrics:', err)
        }
    }

    // Función para obtener métricas de los pods
    private getOnePodMetrics = async (podName:string, labelSelector:string) => {
        try {
            const response = await this.customApi.listClusterCustomObject(
                'metrics.k8s.io', // Group
                'v1beta1',         // Version
                'pods',             
                undefined,
                undefined,
                undefined,
                undefined,
                labelSelector // 'app=kwirth'
            );
            console.log(JSON.stringify(response.body, null, 2))
        }
        catch (err) {
            console.error('Error fetching pod metrics:', err)
        }
    }

    /*
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
    public getMetrics = async (nodeIp:string) => {
        // console.log('nodeIp', nodeIp)
        // console.log('token', this.token)
        try {
            var resp = await fetch (`https://${nodeIp}:10250/metrics/cadvisor`,{ headers: { Authorization: 'Bearer ' + this.token} })
            // console.log(resp)
            var text = await resp.text()
            return text
        }
        catch (error:any) {
            console.log(`Error accessing cAdvisor at node ${nodeIp}`)
            console.log(error)
        }
        return ''
    }

    public extractMetrics = (sampledMetrics:string, requestedMetricName:string, podName:string, containerName:string) => {
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var samples:any[]= []
        var timestamp=0

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
                    // console.log('found metric', sampledMetricName)
                    // console.log('labels', labels)
                    // console.log('found pod',labels.pod, podName)
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
                                if (containerName!=='' && labels.container===containerName ) break
                            }
                            else {
                                // the metrics is absolute, fixed, has no timestamp
                                sample.value = +(valueAndTs.trim())
                                //console.log('Invalid value/ts format: ', line)
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
            console.log(samples)
            sum=samples.reduce( (prev, current) => { return { value: prev.value + current.value }}, {value:0})
        }
        var result = { value: sum.value, timestamp }
        console.log(result)
        return result
    }

    // public async testExtractAllMetrics(nodeIp:string, podName:string, containerName:string) {
    //     var x  = await this.getMetrics(nodeIp)
    //     console.log('container_fs_writes_total= ',this.extractMetrics(x,'container_fs_writes_total', podName, containerName))
    //     console.log('container_fs_reads_total= ',this.extractMetrics(x,'container_fs_reads_total', podName, containerName))
    //     console.log('container_cpu_usage_seconds_total= ',this.extractMetrics(x,'container_cpu_usage_seconds_total', podName, containerName))
    //     console.log('container_memory_usage_bytes= ',this.extractMetrics(x,'container_memory_usage_bytes', podName, containerName))
    //     console.log('container_network_receive_bytes_total= ',this.extractMetrics(x,'container_network_receive_bytes_total', podName, containerName))
    //     console.log('container_network_transmit_bytes_total= ',this.extractMetrics(x,'container_network_transmit_bytes_total', podName, containerName))
    // }

}