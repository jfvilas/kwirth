import { KwirthData } from "@jfvilas/kwirth-common"
import { MetricDescription } from "../channels/metrics/MetricDescription"
import { Cluster } from "../model/Cluster"
import { addGetAuthorization } from "./AuthorizationManagement"

export const getMetricsNames = async (cluster:Cluster) => {
    try {
        console.log(`Receiving metrics for cluster ${cluster.name}`)
        cluster.metricsList=new Map()
        var response = await fetch (`${cluster.url}/metrics`, addGetAuthorization(cluster.accessString))
        var json=await response.json() as MetricDescription[]
        json.map( jsonMetric => cluster.metricsList.set(jsonMetric.metric, jsonMetric))
        console.log(`Metrics for cluster ${cluster.name} have been received (${Array.from(cluster.metricsList.keys()).length})`)
    }
    catch (err) {
        console.log('Error obtaining metrics list')
        console.log(err)
    }
}


export const readClusterInfo = async (cluster: Cluster): Promise<void> => {
        try {
            cluster.enabled = false
            let response = await fetch(`${cluster.url}/config/info`, addGetAuthorization(cluster.accessString))
            if (response.status===200) {
                cluster.kwirthData = await response.json() as KwirthData
                // accessString, name & url are set in clustersList, we don't overwrite them here
                cluster.source = false
                cluster.enabled = true
                if (cluster.kwirthData) {
                    let metricsRequired = Array.from(cluster.kwirthData.channels).reduce( (prev, current) => { return prev || current.metrics}, false)
                    if (metricsRequired) getMetricsNames(cluster)
                }
                return
            }
            else {
                console.log('Status', response.status)
            }
        }
        catch (error) {
            console.log(error)
        }
        console.log(`Cluster ${cluster.name} not enabled`)
    }

