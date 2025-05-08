import express, { Request, Response} from 'express'
import { CoreV1Api, AppsV1Api } from '@kubernetes/client-node'
import { AccessKey, ClusterTypeEnum, KwirthData, parseResources } from '@jfvilas/kwirth-common'
import { ApiKeyApi } from './ApiKeyApi'
import { ClusterInfo } from '../model/ClusterInfo'
import Docker from 'dockerode'
import { IChannel } from '../channels/IChannel'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'

export class ConfigApi {
    public route = express.Router()
    dockerApi : Docker
    coreApi: CoreV1Api
    appsApi: AppsV1Api
    kwirthData: KwirthData
    clusterInfo: ClusterInfo

    setDockerApi = (dockerApi:Docker) => {
        this.dockerApi = dockerApi
    }

    constructor (coreApi:CoreV1Api, appsV1Api:AppsV1Api, apiKeyApi: ApiKeyApi, kwirthData:KwirthData, clusterInfo:ClusterInfo, channels:Map<string,IChannel>) {
        this.coreApi = coreApi
        this.appsApi = appsV1Api
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

        // return an array containing the list of channels (its names) supported by this kwirth instance
        this.route.route('/channel')
            .get( async (req:Request, res:Response) => {
                try {
                    var chList:string[] =  [...Array.from(channels.keys())]
                    res.status(200).json(chList)
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
                    var cluster={ name:kwirthData.clusterName, inCluster:kwirthData.inCluster, metricsInterval: this.clusterInfo.metricsInterval }
                    res.status(200).json(cluster)
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
                            let list = await AuthorizationManagement.getAllowedNamespaces(this.coreApi, accessKey)
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
                        let result = await AuthorizationManagement.getAllowedGroups(this.appsApi, req.params.namespace, accessKey)
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
                            result = await AuthorizationManagement.getPodsFromGroup(this.coreApi, this.appsApi, req.params.namespace, req.query.type as string, req.params.group, accessKey)
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
                            let result = await AuthorizationManagement.getAllowedContainers(this.coreApi, accessKey, req.params.namespace, req.params.pod, )
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
