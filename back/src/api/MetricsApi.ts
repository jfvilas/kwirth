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
    # TYPE kwirth_running_time counter
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
                    var json = ClusterData.metrics.getMetricsList()
                    res.status(200).json(json)
                }
                catch (err) {
                    res.status(400).send()
                    console.log('Error obtaining available metrics list')
                    console.log(err)
                }
            })        
    }
}
