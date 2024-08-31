import express from 'express';
import { AppsV1Api, CoreV1Api } from '@kubernetes/client-node';
import { KwirthData } from '../model/KwirthData';
import { pauseDeployment, restartGroup } from '../tools/KubernetesOperations';
import { validKey } from '../tools/AuthorizationManagement';

export class ManageKwirthApi {
    public route = express.Router();
    coreApi:CoreV1Api;
    appsApi:AppsV1Api;
    
    constructor (coreApi:CoreV1Api, appsApi:AppsV1Api, kwirthData:KwirthData) {
        this.coreApi=coreApi
        this.appsApi=appsApi

        this.route.route('/restart')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return;
                next();
            })
            .get( async (req, res) => {
                try {
                    restartGroup(this.coreApi, this.appsApi, kwirthData.namespace, kwirthData.deployment);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(200).json();
                    console.log(err);
                }
            });
        
        this.route.route('/pause')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return;
                next();
            })
            .get( async (req, res) => {
                try {
                    pauseDeployment(this.appsApi, kwirthData.namespace, kwirthData.deployment);
                    res.status(200).json();
                }
                catch (err) {
                    res.status(200).json();
                    console.log(err);
                }
            });
    }
}
