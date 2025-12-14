import express, { Request, Response} from 'express'
import { ApiKeyApi } from './ApiKeyApi'
import { ClusterInfo } from '../model/ClusterInfo'
import { IChannel } from '../channels/IChannel'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import Docker from 'dockerode'
import { applyAllResources, deleteAllResources } from '../tools/KubernetesManifests'
import { ClusterTypeEnum, KwirthData } from '@jfvilas/kwirth-common'
import { AppsV1ApiPatchNamespacedDeploymentRequest, CoreV1ApiReadNamespacedConfigMapRequest, CoreV1ApiReplaceNamespacedConfigMapRequest } from '@kubernetes/client-node'

export class ConfigApi {
    public route = express.Router()
    dockerApi : Docker
    kwirthData: KwirthData
    clusterInfo: ClusterInfo

    constructor (apiKeyApi: ApiKeyApi, kwirthData:KwirthData, clusterInfo:ClusterInfo, channels:Map<string,IChannel>) {
        this.kwirthData = kwirthData
        this.clusterInfo = clusterInfo
        this.dockerApi = new Docker()

        // return kwirth version information
        this.route.route('/info')
            .get( async (req:Request, res:Response) => {
                try {
                    res.status(200).json(this.kwirthData)
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
            
        // return kwirth version information
        this.route.route('/cluster')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                const versionInfo = await this.clusterInfo.versionApi.getCode()
                const clusterInfo = this.clusterInfo.kubeConfig.getCurrentCluster()

                const nodes = await this.clusterInfo.coreApi.listNode()
                const nodeNames = nodes.items.map((node:any) => node.metadata.name)

                try {
                    res.status(200).json({
                        name: this.clusterInfo.name,
                        type: this.clusterInfo.type,
                        flavour: this.clusterInfo.flavour,
                        memory: this.clusterInfo.memory,
                        vcpu: this.clusterInfo.vcpus,
                        reportedName: clusterInfo?.name,
                        reportedServer: clusterInfo?.server,
                        version: versionInfo.major + '.' + versionInfo.minor,
                        platform: versionInfo.platform,
                        nodes: nodeNames
                    })
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
            
        this.route.route('/trivy')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    let ns= 'trivy-system'
                    let cmnameto = 'trivy-operator'
                    let cmnametoconfig = 'trivy-operator-trivy-config'

                    switch (req.query.action) {
                        case 'install':
                            try {
                                const yaml = await (await fetch('https://raw.githubusercontent.com/aquasecurity/trivy-operator/v0.28.0/deploy/static/trivy-operator.yaml')).text()
                                await applyAllResources(yaml, this.clusterInfo)
                                res.status(200).send('ok')
                                return
                            }
                            catch (err) {
                                res.status(500).send(err)
                                return
                            }
                        case 'configfs':
                            try {
                                let cttoconfig = await this.clusterInfo.coreApi?.readNamespacedConfigMap({ name: cmnametoconfig, namespace: ns })
                                if (cttoconfig.data===undefined) {
                                    res.status(500).send('No Trivy config map exist')
                                    return
                                }
                                else {
                                    let cmtoconfig = cttoconfig
                                    cmtoconfig.data!['trivy.command'] = 'filesystem'
                                    cmtoconfig.data!['trivy.ignoreUnfixed'] = 'true'
                                    await this.clusterInfo.coreApi?.replaceNamespacedConfigMap({name: cmnametoconfig, namespace: ns, body: cmtoconfig})

                                    let ctto = await this.clusterInfo.coreApi?.readNamespacedConfigMap({name: cmnameto, namespace: ns})
                                    let cmto = ctto
                                    cmto.data!['scanJob.podTemplateContainerSecurityContext'] = `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"privileged":false,"readOnlyRootFilesystem":true,"runAsUser":0}`
                                    await this.clusterInfo.coreApi?.replaceNamespacedConfigMap({ name: cmnameto, namespace: ns, body: cmto})

                                    this.restartDeployment('trivy-system', 'trivy-operator')

                                    res.status(200).send('ok')
                                    return
                                }
                            }
                            catch (err) {
                                res.status(500).send(err)
                                return
                            }
                        case 'configimg':
                            try {
                                let ct = await this.clusterInfo.coreApi?.readNamespacedConfigMap({ name: cmnametoconfig, namespace: ns })
                                if (ct.data===undefined) {
                                    res.status(500).send('No Trivy config map exist')
                                    return
                                }
                                else {
                                    let cmtoconfig = ct
                                    cmtoconfig.data!['trivy.command'] = 'image'
                                    if (cmtoconfig.data && cmtoconfig.data['trivy.ignoreUnfixed']) delete cmtoconfig.data['trivy.ignoreUnfixed']
                                    await this.clusterInfo.coreApi?.replaceNamespacedConfigMap({ name: cmnametoconfig, namespace: ns, body: cmtoconfig })

                                    let ctto = await this.clusterInfo.coreApi?.readNamespacedConfigMap({ name: cmnameto, namespace: ns })
                                    let cmto = ctto
                                    if (cmto.data && cmto.data['scanJob.podTemplateContainerSecurityContext']) delete cmto.data['scanJob.podTemplateContainerSecurityContext']
                                    await this.clusterInfo.coreApi?.replaceNamespacedConfigMap({ name: cmnameto, namespace: ns, body:  cmto })

                                    this.restartDeployment('trivy-system', 'trivy-operator')

                                    res.status(200).send('ok')
                                    return
                                }
                            }
                            catch (err) {
                                res.status(500).send(err)
                                return
                            }
                        case 'remove':
                            try {
                                const yaml = await (await fetch('https://raw.githubusercontent.com/aquasecurity/trivy-operator/v0.28.0/deploy/static/trivy-operator.yaml')).text()
                                await deleteAllResources(yaml, this.clusterInfo)
                                res.status(200).send()
                            }
                            catch (err) {
                                res.status(500).send(err)
                                return
                            }
                            break
                        case 'status':
                            try {
                                let cttoconfig = await this.clusterInfo.coreApi?.readNamespacedConfigMap({ name: cmnametoconfig, namespace: ns })
                                if (cttoconfig.data===undefined) {
                                    res.status(500).send('No Trivy config map exist, Trivy seems not to be installed.')
                                    return
                                }
                                else {
                                    let cmtoconfig = cttoconfig
                                    let command = cmtoconfig.data!['trivy.command']
                                    return res.status(200).send(`Installed [mode: ${command}]`)
                                }
                            }
                            catch (err) {
                                res.status(500).send('Error checking Trivy configMap')
                                return
                            }
                            break
                        default:
                            res.status(500).send('invalid action '+req.query.action)
                            return
                    }
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })
        
        // get all namespaces
        this.route.route('/namespace')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                if (this.kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
                    res.status(200).json(['$docker'])
                }
                else {
                    try {
                        let accessKey = await AuthorizationManagement.getKey(req,res, apiKeyApi)
                        if (accessKey) {
                            let list = await AuthorizationManagement.getAllowedNamespaces(this.clusterInfo.coreApi, accessKey)
                            res.status(200).json(list)
                        }
                        else {
                            res.status(403).json([])
                            return
                        }
                    }
                    catch (err) {
                        res.status(500).json([])
                        console.log(err)
                    }
                }
            })

        // get all deployments in a namespace
        this.route.route('/:namespace/groups')
            .all( async (req:Request, res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    let accessKey = await AuthorizationManagement.getKey(req,res, apiKeyApi)
                    if (accessKey) {
                        let result = await AuthorizationManagement.getAllowedGroups(this.clusterInfo.appsApi, req.params.namespace, accessKey)
                        res.status(200).json(result)
                    }
                    else {
                        res.status(403).json([])
                        return
                    }
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })

        // get all pods in a namespace in a group
        this.route.route('/:namespace/:group/pods')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    let result:string[]=[]

                    if (this.kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
                        result = await this.clusterInfo.dockerTools.getAllPodNames()
                    }
                    else {
                        let accessKey = await AuthorizationManagement.getKey(req,res, apiKeyApi)
                        if (accessKey) {
                            result = await AuthorizationManagement.getAllowedPods(this.clusterInfo.coreApi, this.clusterInfo.appsApi, req.params.namespace, req.params.group, accessKey)
                        }
                        else {
                            res.status(403).json([])
                            return
                        }
                    }
                    result = [...new Set(result)]
                    res.status(200).json(result)
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })

        // returns an array containing all the containers running inside a pod
        this.route.route('/:namespace/:pod/containers')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                if (this.kwirthData.clusterType === ClusterTypeEnum.DOCKER) {
                    let names = await this.clusterInfo.dockerTools.getContainers(req.params.pod)
                    res.status(200).json(names)
                }
                else {
                    try {
                        let accessKey = await AuthorizationManagement.getKey(req, res, apiKeyApi)
                        if (accessKey) {
                            let result = await AuthorizationManagement.getAllowedContainers(this.clusterInfo.coreApi, accessKey, req.params.namespace, req.params.pod, )
                            res.status(200).json(result)
                        }
                        else {
                            res.status(403).json([])
                            return
                        }
                    }
                    catch (err) {
                        res.status(500).json([])
                        console.log(err)
                    }
                }
            })
    }

    setDockerApi = (dockerApi:Docker) => {
        this.dockerApi = dockerApi
    }

    restartDeployment = async (namespace:string, name:string) => {
        const patch = {
            spec: {
                template: {
                    metadata: {
                        annotations: { 'kwirth.jfvilas.github.com/restartedAt': new Date().toISOString() }
                    }
                }
            }
        }

        let param:AppsV1ApiPatchNamespacedDeploymentRequest = {
            name: name,
            namespace: namespace,
            body: patch
        }
        await this.clusterInfo.appsApi.patchNamespacedDeployment( param, {})  //+++ test
    }
    
}
