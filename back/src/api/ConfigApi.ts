import express, { Request, Response} from 'express'
import { ClusterTypeEnum, KwirthData } from '@jfvilas/kwirth-common'
import { ApiKeyApi } from './ApiKeyApi'
import { ClusterInfo } from '../model/ClusterInfo'
import { IChannel } from '../channels/IChannel'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import Docker from 'dockerode'
import { applyAllResources, deleteAllResources } from '../tools/Trivy'

export class ConfigApi {
    public route = express.Router()
    dockerApi : Docker
    kwirthData: KwirthData
    clusterInfo: ClusterInfo

    setDockerApi = (dockerApi:Docker) => {
        this.dockerApi = dockerApi
    }

    constructor (apiKeyApi: ApiKeyApi, kwirthData:KwirthData, clusterInfo:ClusterInfo, channels:Map<string,IChannel>) {
        this.kwirthData = kwirthData
        this.clusterInfo = clusterInfo
        this.dockerApi = new Docker()

        // return kwirth version information
        this.route.route('/version')
            .get( async (req:Request, res:Response) => {
                try {
                    res.status(200).json(this.kwirthData)
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })

        // returns cluster information of the k8 cluster which this kwirth is connected to or running inside
        this.route.route('/cluster')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    let chList:string[] =  [...Array.from(channels.keys())]
                    let cluster={ name:kwirthData.clusterName, inCluster:kwirthData.inCluster, metricsInterval: this.clusterInfo.metricsInterval, channels: chList }
                    res.status(200).json(cluster)
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })
        
            
        // returns cluster information of the k8 cluster which this kwirth is connected to or running inside
        this.route.route('/trivy')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    switch (req.query.action) {
                        case 'install':
                            try {
                                const yaml = await (await fetch('https://raw.githubusercontent.com/aquasecurity/trivy-operator/v0.26.1/deploy/static/trivy-operator.yaml')).text()
                                await applyAllResources(yaml, this.clusterInfo)
                                res.status(200).send('ok')
                                return
                            }
                            catch (err) {
                                res.status(200).send(err)
                                return
                            }
                        case 'remove':
                            try {
                                const yaml = await (await fetch('https://raw.githubusercontent.com/aquasecurity/trivy-operator/v0.26.1/deploy/static/trivy-operator.yaml')).text()
                                await deleteAllResources(yaml, this.clusterInfo)
                                res.status(200).send()
                            }
                            catch (err) {
                                res.status(200).send(err)
                                return
                            }
                            break
                        default:
                            res.status(200).send('invalid action '+req.query.action)
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

}
