import express, { Request, Response} from 'express'
import { AppsV1Api, V1DeploymentList, V1PodList } from '@kubernetes/client-node'
import { CoreV1Api } from '@kubernetes/client-node'
import { validAuth, validKey } from '../tools/AuthorizationManagement'
import { restartPod, restartGroup } from '../tools/KubernetesOperations'
import { IChannel, InstanceConfigChannelEnum } from '@jfvilas/kwirth-common'
import { IncomingMessage } from 'http'
import { ApiKeyApi } from './ApiKeyApi'

export class ManageClusterApi {
    public route = express.Router()
    coreApi:CoreV1Api
    appsApi:AppsV1Api
    channels:Map<string,IChannel>

    constructor (coreApi:CoreV1Api, appsApi:AppsV1Api, apiKeyApi: ApiKeyApi, channels:Map<string, IChannel>) {
        this.coreApi = coreApi
        this.appsApi = appsApi
        this.channels = channels

        this.route.route('/find')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    // filter results: jq .[].spec.containers[].image aa.json
                    // object indicates what kind of object to search for: pod, deployment
                    var object:string=req.query.type? (req.query.type as string) : 'pod' // transitional
                    var namespace:string=req.query.namespace as string
                    var labelSelector = undefined 
                    var label:string=req.query.label as string
                    var value:string=req.query.entity as string  // transitional
                    if (!value) value=req.query.value as string
                    if (label && value) labelSelector=`${label}=${value}`
                    // data points to what data to find: id => just pod id (name+namespace), all => all pod data
                    var data:string=req.query.data? (req.query.data as string) : 'id'  // transitional
                    switch(object) {
                        case 'pod':
                            var podListResp:{response:IncomingMessage,body:V1PodList}
                            if (namespace) 
                                podListResp = await this.coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)
                            else
                                podListResp = await this.coreApi.listPodForAllNamespaces(undefined, undefined, undefined, labelSelector)
                            switch (data) {
                                case 'id':
                                    var podList=podListResp.body.items.map(pod => {
                                        return { namespace:pod.metadata?.namespace, name:pod.metadata?.name }
                                    })
                                    res.status(200).json(podList)
                                    break
                                case 'all':
                                    res.status(200).json(podListResp.body.items)
                                    break   
                                default:
                                    console.log('Invalid data spec')
                                    res.status(500).json()
                                    break
                            }
                            break
                        case 'deployment':
                            var depListResp:{response:IncomingMessage,body:V1DeploymentList}
                            if (namespace) 
                                depListResp = await this.appsApi.listNamespacedDeployment(namespace, undefined, undefined, undefined, undefined, labelSelector)
                            else
                                depListResp = await this.appsApi.listDeploymentForAllNamespaces(undefined, undefined, undefined, labelSelector)
                            switch (data) {
                                case 'id':
                                    var depList=depListResp.body.items.map(deployment => {
                                        return { namespace:deployment.metadata?.namespace, name:deployment.metadata?.name }
                                    })
                                    res.status(200).json(depList)
                                    break
                                case 'all':
                                    res.status(200).json(depListResp.body.items)
                                    break   
                                default:
                                    console.log('Invalid data spec')
                                    res.status(500).json()
                                    break
                            }
                            break
                        default:
                            console.log('Invalid object')
                            res.status(500).json()
                            break
                        }
                }
                catch (err) {
                    res.status(500).json()
                    console.log(err)
                }
            })

        this.route.route('/restartdeployment/:namespace/:deployment')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .post( async (req:Request, res:Response) => {
                // +++ we must segregate restarting channel from logging channel, and use correct channel
                if (!validAuth(req,res, this.channels, 'restart', InstanceConfigChannelEnum.LOG, req.params.namespace,req.params.deployment,'','')) return
                try {
                    restartGroup(this.coreApi, this.appsApi, req.params.namespace, req.params.deployment)
                    res.status(200).json()
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            })

        this.route.route('/restartpod/:namespace/:podName')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .post( async (req:Request, res:Response) => {
                if (!validAuth(req, res, channels, 'restart', InstanceConfigChannelEnum.LOG, req.params.namespace,'',req.params.podName,'')) return
                try {
                    console.log(`Restart pod ${req.params.podName}`)
                    console.log(req.headers)
                    restartPod(coreApi, req.params.namespace, req.params.podName)
                    res.status(200).json()
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            })
    }
}
