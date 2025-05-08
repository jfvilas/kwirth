import express, { Request, Response} from 'express'
import { AppsV1Api, CoreV1Api } from '@kubernetes/client-node'
import { KwirthData } from '@jfvilas/kwirth-common'
import { pauseDeployment, restartGroup } from '../tools/KubernetesOperations'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { ApiKeyApi } from './ApiKeyApi'

export class ManageKwirthApi {
    public route = express.Router();
    coreApi:CoreV1Api;
    appsApi:AppsV1Api;
    
    constructor (coreApi:CoreV1Api, appsApi:AppsV1Api, apiKeyApi: ApiKeyApi, kwirthData:KwirthData) {
        this.coreApi=coreApi
        this.appsApi=appsApi

        this.route.route('/restart')
            .all( async (req:Request,res:Response, next) => {
                if (await !AuthorizationManagement.validKey(req, res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    restartGroup(this.coreApi, this.appsApi, kwirthData.namespace, kwirthData.deployment)
                    res.status(200).json()
                }
                catch (err) {
                    res.status(200).json()
                    console.log(err)
                }
            })
        
        this.route.route('/pause')
            .all( async (req:Request,res:Response, next) => {
                if (await !AuthorizationManagement.validKey(req, res, apiKeyApi)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                    pauseDeployment(this.appsApi, kwirthData.namespace, kwirthData.deployment)
                    res.status(200).json()
                }
                catch (err) {
                    res.status(200).json()
                    console.log(err)
                }
            })
    }
}
