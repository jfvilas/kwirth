import express, { Request, Response} from 'express'
import { ClusterInfo } from '../model/ClusterInfo'
import { validKey } from '../tools/AuthorizationManagement'
import { ApiKeyApi } from './ApiKeyApi'

export class MetricsApi {
    public route = express.Router()
    clusterInfo:ClusterInfo

    constructor (clusterInfo:ClusterInfo, apiKeyApi: ApiKeyApi) {
        this.clusterInfo = clusterInfo

        this.route.route('/')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var json = this.clusterInfo.metrics.getMetricsList()
                    res.status(200).json(json)
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })
        this.route.route('/debug/:action/:nodename')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    if (req.params.action==='node') {
                        var json:any = {}
                        for(var k of this.clusterInfo.nodes.get(req.params.nodename)?.metricValues.keys()!) {
                            var v = this.clusterInfo.nodes.get(req.params.nodename)?.metricValues.get(k)
                            json[k]=v
                        }
                        for(var k of this.clusterInfo.nodes.get(req.params.nodename)?.machineMetrics.keys()!) {
                            var v = this.clusterInfo.nodes.get(req.params.nodename)?.machineMetrics.get(k)
                            json[k]=v
                        }
                        res.status(200).json(json)
                    }
                    if (req.params.action==='text') {
                        var node = this.clusterInfo.nodes.get(req.params.nodename)
                        var text = await this.clusterInfo.metrics.readCAdvisorMetrics(node!)
                        res.status(200).send(text)
                    }
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })

        this.route.route('/config')
            .all( async (req,res, next) => {
                if (!validKey(req, res, apiKeyApi)) return
                next()
            })
            .post( async (req:Request, res:Response) => {
                try {
                    var data = req.body as any
                    if (data.interval) {
                        clusterInfo.stopInterval()
                        clusterInfo.startInterval(+data.interval) 
                        console.log(`New metrics cluster interval set to ${data.interval}`)
                    }
                    res.status(200).json()
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error updating metrics settings')
                    console.log(err)
                }
            })
    }
}
