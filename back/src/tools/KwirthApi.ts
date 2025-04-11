import { V1ObjectMeta, V1Pod, V1PodSpec } from "@kubernetes/client-node"
import { ClusterInfo } from "../model/ClusterInfo"
import * as crypto from 'crypto'

export class DockerTools {
    clusterInfo:ClusterInfo

    constructor (clusterInfo:ClusterInfo) {
        this.clusterInfo = clusterInfo
    }

    public getContainerId = async (podName:string, containerName: string) => {
        let id
        let runningContainers= await this.clusterInfo.dockerApi.listContainers( { all:false } )
        runningContainers.forEach(c => {
            if (c.Labels['com.docker.compose.project']) {
                let project = c.Labels['com.docker.compose.project']
                let serviceName = c.Labels['com.docker.compose.service'] || undefined
                if (!serviceName) serviceName = project + '-' + crypto.createHash('md5').update(c.Labels['com.docker.compose.config-hash']).digest('hex').slice(0,6)
                if (project === podName && containerName === serviceName) id = c.Id
            }
            else {
                let cname = c.Names ? c.Names[0] : c.Id
                if (podName === '$docker' && containerName === cname)  id = c.Id
            } 
        })
        return id
    }

    public getContainers = async (podName:string): Promise<string[]> => {
        let runningContainers= await this.clusterInfo.dockerApi.listContainers( { all:false } )
        let containers:string[] = []
        runningContainers.forEach(c => {
            if (c.Labels['com.docker.compose.project']) {
                let project = c.Labels['com.docker.compose.project']
                let cname = c.Labels['com.docker.compose.service'] || undefined
                if (!cname) cname = project + '-' + crypto.createHash('md5').update(c.Labels['com.docker.compose.config-hash']).digest('hex').slice(0,6)
                if (podName === project) containers.push(cname)
            }
            else {
                let cname = c.Names ? c.Names[0] : c.Id
                if (cname.startsWith('/')) cname = cname.substring(1)
                if (podName === '$docker') containers.push(cname)
            }
        })
        return containers
    }

    public getAllPodNames= async (): Promise<string[]> => {
        let podNames:string[] = []

        let runningContainers= await this.clusterInfo.dockerApi.listContainers( { all:false } )
        runningContainers.forEach(c => {
            if (c.Labels['com.docker.compose.project']) {
                let project = c.Labels['com.docker.compose.project']
                let cname = c.Labels['com.docker.compose.service'] || undefined
                if (!cname) cname = project + '-' + crypto.createHash('md5').update(c.Labels['com.docker.compose.config-hash']).digest('hex').slice(0,6)
                if (!podNames.includes(project)) podNames.push(project)
            }
        })
        podNames.push('$docker')
        return podNames
    }

    public getAllPods = async () => {
        let allPods:V1Pod[] = []
            let runningContainers= await this.clusterInfo.dockerApi.listContainers( { all:false } )
            runningContainers.forEach(c => {
                if (c.Labels['com.docker.compose.project']) {
                    let project = c.Labels['com.docker.compose.project']
                    if (!allPods.find(p => p.metadata?.name === project)) {
                        let cPod = new V1Pod()
                        cPod.metadata = new V1ObjectMeta()
                        cPod.metadata.name = project
                        cPod.metadata.namespace = '$docker'
                        cPod.metadata.labels = { app: '$docker', name:'$docker' }
                        cPod.spec = new V1PodSpec()
                        cPod.spec.containers = []
                        allPods.push(cPod)
                    }
                } 
            })
            let dockerPod = new V1Pod()
            dockerPod.metadata = new V1ObjectMeta()
            dockerPod.metadata.name = '$docker'
            dockerPod.metadata.namespace = '$docker'
            dockerPod.metadata.labels = { app: '$docker', name:'$docker' }
            dockerPod.spec = new V1PodSpec()
            dockerPod.spec.containers = []

            allPods.push(dockerPod)
        return allPods
    }

}