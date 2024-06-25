import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';

export class ManageKwirth {
  public route = express.Router();
  appsV1Api:AppsV1Api;

  restartDeployment = async (namespace:string, deploymentName:string) => {
    //+++ take this function to a tools lib
    try {
      console.log(`Restarting ${namespace}/${deploymentName}`);
      const { body: deployment } = await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
        if (!deployment!.spec!.template!.metadata!.annotations) deployment!.spec!.template!.metadata!.annotations = {};
        deployment!.spec!.template!.metadata!.annotations['kwirth/restartedAt'] = new Date().toISOString();
        this.appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment);
    }
    catch (err) {
        console.error(`Error restarting deployment ${deploymentName}:`, err);
    }
  }

  pauseDeployment = async (namespace:string, deploymentName:string) => {
    //+++ take this function to a tools lib
    console.log(`Pausing ${namespace}/${deploymentName}`);
    const deployment = await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
    deployment.body.spec!.paused = true;
    await this.appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment.body);
  }
  
  constructor (appsV1Api:AppsV1Api, namespace:string, deployment:string) {
    this.appsV1Api=appsV1Api

    this.route.route('/restart')
      .get( async (req, res) => {
        try {
            this.restartDeployment(namespace, deployment);
            res.status(200).json();
        }
        catch (err) {
            res.status(200).json();
            console.log(err);
        }
      });
      this.route.route('/pause')
      .get( async (req, res) => {
        try {
            this.pauseDeployment(namespace, deployment);
            res.status(200).json();
        }
        catch (err) {
            res.status(200).json();
            console.log(err);
        }
      });
  }

}
