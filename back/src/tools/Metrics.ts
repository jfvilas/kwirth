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
                'v1beta1',         // Version
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
        try {
            var resp = await fetch (`https://${nodeIp}:10250/metrics/cadvisor`,{ headers: { Authorization: 'Bearer '+this.token} })
            var text=await resp.text()
            return text
        }
        catch (error:any) {
            console.log(error)
        }
        return ''
    }

    public extractMetrics = (sampledMetrics:string,metricName:string, podName:string, containerName:string) => {
        const regex = /(?:\s*([^=^{]*)=\"([^"]*)",*)/gm;
        var samples:any[]= []

        var lines=sampledMetrics.split('\n')
        lines.forEach(line => {
            var i = line.indexOf('{')
            var readMetricName=line.substring(0,i)
            if (readMetricName===metricName) {
                let m
                var labels:any={}
                while ((m = regex.exec(line)) !== null) {
                    if (m.index === regex.lastIndex) regex.lastIndex++
                    labels[m[1]]=m[2]
                }
                if (labels.container===containerName || labels.pod.startsWith(podName)) {
                    var i=line.indexOf('}')
                    var valuets=line.substring(i+1).trim()
                    var sample=labels
                    sample.metric=metricName
                    sample.value=+valuets.split(' ')[0].trim()
                    sample.timestamp=+valuets.split(' ')[1].trim()
                    samples.push(sample)
                }
            }
        })
        var sum={ value:0 }
        if (samples.length>0) {
            console.log(samples)
            sum=samples.reduce( (prev, current) => { return { value: prev.value + current.value }}, {value:0})
        }
        return sum.value
    }

    public async testExtractAllMetrics(nodeIp:string, podName:string, containerName:string) {
        var x  = await this.getMetrics(nodeIp)
        console.log('container_fs_writes_total= ',this.extractMetrics(x,'container_fs_writes_total', podName, containerName))
        console.log('container_fs_reads_total= ',this.extractMetrics(x,'container_fs_reads_total', podName, containerName))
        console.log('container_cpu_usage_seconds_total= ',this.extractMetrics(x,'container_cpu_usage_seconds_total', podName, containerName))
        console.log('container_memory_usage_bytes= ',this.extractMetrics(x,'container_memory_usage_bytes', podName, containerName))
        console.log('container_network_receive_bytes_total= ',this.extractMetrics(x,'container_network_receive_bytes_total', podName, containerName))
        console.log('container_network_transmit_bytes_total= ',this.extractMetrics(x,'container_network_transmit_bytes_total', podName, containerName))
    }

}