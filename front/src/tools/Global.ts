import { Cluster, KwirthData } from "../model/Cluster"
import { addGetAuthorization } from "./AuthorizationManagement"

export const readClusterInfo = async (cluster: Cluster): Promise<void> => {
        try {
            cluster.enabled = false
            let response = await fetch(`${cluster.url}/config/info`, addGetAuthorization(cluster.accessString))
            if (response.status===200) {
                cluster.kwirthData = await response.json() as KwirthData
                // accessString, name & url are set in clustersList, we don't overwrite them here
                cluster.source = false
                cluster.enabled = true
                return
            }
            else {
            }
        }
        catch (error) {}
        console.log(`Cluster ${cluster.name} not enabled`)
    }

