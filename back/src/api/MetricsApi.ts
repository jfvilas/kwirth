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
                    console.log('/metrics')
                    console.log(ClusterData.nodes)
                    var all=await metrics.getMetrics(Array.from(ClusterData.nodes.values())[0])
                    console.log(all)
                    var lines=all.split('\n')
                    lines=lines.filter(l => l.startsWith('#'))
                    console.log(lines)
                    res.status(200).send(lines.join('\n'))
                }
                catch (err) {
                    res.status(400).send('')
                    console.log(err)
                }
            })        
    }
}
