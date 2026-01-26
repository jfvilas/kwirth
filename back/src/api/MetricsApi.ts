import express, { Request, Response} from 'express'
import { ClusterInfo } from '../model/ClusterInfo'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { ApiKeyApi } from './ApiKeyApi'
import { IClusterMetricsConfig } from '@jfvilas/kwirth-common'
import { NodeMetrics } from '../model/INodeMetrics'

export class MetricsApi {
    public route = express.Router()
    clusterInfo:ClusterInfo

    constructor (clusterInfo:ClusterInfo, apiKeyApi: ApiKeyApi) {
        this.clusterInfo = clusterInfo

        this.route.route('/')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req, res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    if (this.clusterInfo.metrics) {
                        let json = this.clusterInfo.metrics.getMetricsList()
                        res.status(200).json(json)
                    }
                    else {
                        res.status(200).json([])
                    }
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })
        this.route.route('/usage/*')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req, res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    switch (req.url) {
                        case '/usage/cluster':
                            this.sendUsageCluster(req,res)
                        break
                        case '/usage/poddetail':
                            this.sendUsagePodDetail(req,res)
                        break
                    }
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })
        this.route.route('/debug/:action/:nodename')
            .all( async (req:Request,res:Response, next) => {
                // if (! (await AuthorizationManagement.validKey(req, res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    if (req.params.action==='node') {
                        var json:{ [key:string]:any } = {}
                        for(var key of this.clusterInfo.nodes.get(req.params.nodename)?.containerMetricValues.keys()!) {
                            var value = this.clusterInfo.nodes.get(req.params.nodename)?.containerMetricValues.get(key)
                            json[key]=value
                        }
                        for(var key of this.clusterInfo.nodes.get(req.params.nodename)?.machineMetricValues.keys()!) {
                            var value = this.clusterInfo.nodes.get(req.params.nodename)?.machineMetricValues.get(key)
                            json[key]=value
                        }
                        res.status(200).json(json)
                    }
                    if (req.params.action==='text') {
                        var node = this.clusterInfo.nodes.get(req.params.nodename)
                        var text = await this.clusterInfo.metrics.readCAdvisorMetrics(node!)
                        res.status(200).send(text)
                    }
                    if (req.params.action==='summary') {
                        var node = this.clusterInfo.nodes.get(req.params.nodename)
                        if (node) {
                            let nm = (await this.clusterInfo.metrics.readCAdvisorSummary(node)).node as NodeMetrics
                            res.status(200).send(JSON.stringify(nm))
                        }
                    }
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error debugging available metrics list')
                    console.log(err)
                }
            })

        this.route.route('/config')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req, res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    res.status(200).json({ metricsInterval: clusterInfo.metricsInterval })
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error sending metrics settings')
                    console.log(err)
                }
            })
            .post( async (req:Request, res:Response) => {
                try {
                    let data:IClusterMetricsConfig = req.body
                    if (data.metricsInterval) {
                        clusterInfo.metricsInterval = data.metricsInterval
                        clusterInfo.stopMetricsInterval()
                        clusterInfo.startMetricsInterval(+data.metricsInterval) 
                        console.log(`New metrics cluster interval set to ${data.metricsInterval}`)
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

    sendUsageCluster = (req:Request, res:Response) => {
        let cpuu=0, cpun=this.clusterInfo.vcpus
        let memu=0, memt=0
        let tx=0, rx=0
        let prevtx=0, prevrx=0
        if (this.clusterInfo.metrics) {
            try {
                for (let node of this.clusterInfo.nodes.values()) {
                    if (node.summary) {
                        memu+=node.summary.memory.usageBytes
                        memt+=node.summary.memory.usageBytes + node.summary.memory.availableBytes
                        cpuu+=node.summary.cpu.usageNanoCores
                        tx += node.summary.network.txBytes
                        rx += node.summary.network.rxBytes

                        if (node.prevSummary) {
                            prevtx += node.prevSummary.network.txBytes
                            prevrx += node.prevSummary.network.rxBytes
                        }
                    }
                }
                if (memt===0) memt=1
                if (cpun===0) cpun=1
                let tottx = tx-prevtx
                let totrx = rx-prevrx
                tottx = (tottx/1024/1024) / this.clusterInfo.metricsInterval
                totrx = (totrx/1024/1024) / this.clusterInfo.metricsInterval
                res.status(200).send({cpu:(cpuu/(cpun*Math.pow(10,9)))*100, memory:memu/memt*100, txmbps:tottx, rxmbps:totrx})
            }
            catch (err) {
                console.error('Error calculating node resources', err)
                res.status(200).send({cpu:Math.random()*100, memory:Math.random()*100, txmbps:Math.random()*100, rxmbps:Math.random()*100})
            }
        }
        else {
            res.status(200).send({cpu:0, memory:0, txmbps:0, rxmbps:0})
        }
    }

    sendUsagePodDetail = (req:Request, res:Response) => {
        if (this.clusterInfo.metrics) {
            try {
                res.status(200).send({})
                
            }
            catch (err) {
                console.error('Error calculating node resources', err)
                res.status(200).send({})
            }
        }
        else {
            res.status(200).send({})
        }

    }

}
