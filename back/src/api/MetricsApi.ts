import express, { Request, Response} from 'express';
import { Metrics } from '../tools/Metrics';
import { ClusterData } from '../tools/ClusterData';
import { validKey } from '../tools/AuthorizationManagement';

export class MetricsApi {
    public route = express.Router()
    metrics:Metrics

    constructor (metrics:Metrics) {
        this.metrics=metrics

        this.route.route('/')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    var json = ClusterData.metrics.getMetricsList()
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
                if (!validKey(req,res)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    if (req.params.action==='node') {
                        var json:any = {}
                        for(var k of ClusterData.nodes.get(req.params.nodename)?.metricValues.keys()!) {
                            var v=ClusterData.nodes.get(req.params.nodename)?.metricValues.get(k)
                            json[k]=v
                        }
                        for(var k of ClusterData.nodes.get(req.params.nodename)?.machineMetrics.keys()!) {
                            var v=ClusterData.nodes.get(req.params.nodename)?.machineMetrics.get(k)
                            json[k]=v
                        }
                        res.status(200).json(json)
                    }
                    if (req.params.action==='text') {
                        var node=ClusterData.nodes.get(req.params.nodename)
                        var text = await ClusterData.metrics.readCAdvisorMetrics(node!)
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
                if (!validKey(req,res)) return
                next()
            })
            .post( async (req:Request, res:Response) => {
                try {
                    var data = req.body as any
                    if (data.clusterMetricsInterval) {
                        clearTimeout(ClusterData.clusterMetricsTimeout)
                        ClusterData.startInterval(+data.clusterMetricsInterval)
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
