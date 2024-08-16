import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';
import { KwirthData } from '../model/KwirthData';
import { pauseDeployment, restartDeployment } from '../tools/KubernetesOperations';
import { validKey } from '../tools/AuthorizationManagement';

export class ManageKwirthApi {
  public route = express.Router();
  appsV1Api:AppsV1Api;
 
  constructor (appsV1Api:AppsV1Api, kwirthData:KwirthData) {
    this.appsV1Api=appsV1Api

    this.route.route('/restart')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( async (req, res) => {
        try {
            restartDeployment(this.appsV1Api, kwirthData.namespace, kwirthData.deployment);
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
            pauseDeployment(this.appsV1Api, kwirthData.namespace, kwirthData.deployment);
            res.status(200).json();
        }
        catch (err) {
            res.status(200).json();
            console.log(err);
        }
      });
  }
}
