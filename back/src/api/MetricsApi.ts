import express, { Request, Response} from 'express';
import { Metrics } from '../tools/Metrics';
import { ClusterData } from '../tools/ClusterData';
import { validKey } from '../tools/AuthorizationManagement';

export class MetricsApi {
    public route = express.Router()
    metrics:Metrics

    /*

    # HELP kwirth_cpu_precentage Percentage of cpu used
    # TYPE kwirth_cpu_precentage
    # EVAL container_cpu_usage_seconds_total / machine_cpu_sockets * (kwirth_current_time_seconds - container_start_time_seconds)

    # HELP kwirth_running_time Nuber of seconds the container has been running
    # TYPE kwirth_running_time gauge
    # EVAL kwirth_current_time_seconds - container_start_time_seconds

    */

    constructor (metrics:Metrics) {
        this.metrics=metrics

        this.route.route('/')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    console.log('Obtaining available metrics list from cAdvisor (node 0):')
                    console.log('Nodes:', ClusterData.nodes)
                    var nodeIp=Array.from(ClusterData.nodes.values())[0].status?.addresses!.find(a => a.type==='InternalIP')?.address
                    var all=await metrics.getMetrics(nodeIp!)
                    console.log('',all)
                    var lines=all.split('\n')
                    lines=lines.filter(l => l.startsWith('#'))
                    lines.push('# HELP kwirth_running_time Number of seconds the container has been running')
                    lines.push('# TYPE kwirth_running_time gauge')
                    lines.push('# HELP kwirth_cpu_precentage Percentage of cpu used')
                    lines.push('# TYPE kwirth_cpu_precentage gauge')
                    lines.push('# HELP kwirth_cpu_number number of CPU reported at node')
                    lines.push('# TYPE kwirth_cpu_number gauge')
                    console.log(lines)
                    res.status(200).send(lines.join('\n'))
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })        
    }
}
