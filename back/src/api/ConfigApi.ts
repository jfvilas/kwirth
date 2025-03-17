import express, { Request, Response} from 'express'
import { CoreV1Api, AppsV1Api } from '@kubernetes/client-node'
import { KwirthData, ServiceConfigChannelEnum } from '@jfvilas/kwirth-common'
import { validKeyAsync } from '../tools/AuthorizationManagement'
import { IChannel } from '../model/IChannel'
import { ApiKeyApi } from './ApiKeyApi'

export class ConfigApi {
    public route = express.Router()
    coreApi: CoreV1Api
    appsV1Api: AppsV1Api
    kwirthData: KwirthData

    constructor (coreApi:CoreV1Api, appsV1Api:AppsV1Api, apiKeyApi: ApiKeyApi, kwirthData:KwirthData, channels:Map<string,IChannel>) {
        this.coreApi = coreApi
        this.appsV1Api = appsV1Api
        this.kwirthData = kwirthData

        // return kwirth version information
        this.route.route('/version')
            .get( async (req:Request, res:Response) => {
                try {
                    res.status(200).json(this.kwirthData)
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            })

        // return an array containing the list of channels (its names) supported by this kwirth instance
        this.route.route('/channel')
            .get( async (req:Request, res:Response) => {
                try {
                    var chList:string[] = [ServiceConfigChannelEnum.LOG, ServiceConfigChannelEnum.ALARM, ServiceConfigChannelEnum.METRICS]
                    chList.push (...Array.from(channels.keys()))
                    res.status(200).json(chList)
                }
                catch (err) {
                    res.status(500).json([])
                    console.log(err)
                }
            })
        
        // returns cluster information of the k8 cluster which this kwirth is connected to or running inside
        this.route.route('/cluster')
            .all( async (req,res, next) => {
                if (!validKeyAsync(req,res, apiKeyApi)) return;
                next();
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var cluster={ name:kwirthData.clusterName, inCluster:kwirthData.inCluster };
                    res.status(200).json(cluster);
                }
                catch (err) {
                    res.status(200).json([]);
                    console.log(err);
                }
            })
        
        // get all namespaces
        this.route.route('/namespace')
            .all( async (req,res, next) => {
                if (!validKeyAsync(req,res, apiKeyApi)) return;
                next();
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var response = await this.coreApi.listNamespace();
                    var namespaces = response.body.items.map (n => n?.metadata?.name);
                    res.status(200).json(namespaces);
                }
                catch (err) {
                    res.status(200).json([]);
                    console.log(err);
                }
            });

        // get all deployments in a namespace
        this.route.route(['/:namespace/sets','/:namespace/groups'])
            .all( async (req:Request, res:Response, next) => {
                if (!validKeyAsync(req,res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var list:any[]=[];
                    var respDeps = await this.appsV1Api.listNamespacedReplicaSet(req.params.namespace)
                    list.push (...respDeps.body.items.map (n => { return { name:n?.metadata?.name, type:'replica' }}))
                    var respStat = await this.appsV1Api.listNamespacedStatefulSet(req.params.namespace)
                    list.push (...respStat.body.items.map (n => { return { name:n?.metadata?.name, type:'stateful' }}))
                    var respDae = await this.appsV1Api.listNamespacedDaemonSet(req.params.namespace)
                    list.push (...respDae.body.items.map (n => { return { name:n?.metadata?.name, type:'daemon' }}))
                    res.status(200).json(list);
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            });

        // get all pods in a namespace in a group
        this.route.route('/:namespace/:group/pods')
            .all( async (req,res, next) => {
                if (!validKeyAsync(req,res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var response= await this.coreApi.listNamespacedPod(req.params.namespace)
                    var pods = response.body.items.filter (n => n?.metadata?.ownerReferences![0].name===req.params.group).map (n => n?.metadata?.name)
                    res.status(200).json(pods)
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            })

        // returns an array containing all the containers running inside a pod
        this.route.route('/:namespace/:pod/containers')
            .all( async (req,res, next) => {
                if (!validKeyAsync(req,res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var response= await this.coreApi.listNamespacedPod(req.params.namespace)
                    var searchPod = response.body.items.filter (p => p?.metadata?.name===req.params.pod)
                    if (searchPod.length===0) {
                        res.status(200).json([])
                        return
                    }
                    var conts = searchPod[0].spec?.containers.map(c => c.name)
                    res.status(200).json(conts)
                }
                catch (err) {
                    res.status(200).json([])
                    console.log(err)
                }
            })
    }

}
