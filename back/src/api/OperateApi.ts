import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';

export class OperateApi {
  public route = express.Router();
  appsV1Api:AppsV1Api;

  restartDeployment = async (namespace:string, deploymentName:string) => {
      try {
          const { body: deployment } = await this.appsV1Api.readNamespacedDeployment(deploymentName, namespace);
  
          // Modify an annotation so k8s would detect a change has been applied, what finally would cause the restart
          if (!deployment!.spec!.template!.metadata!.annotations) deployment!.spec!.template!.metadata!.annotations = {};
          deployment!.spec!.template!.metadata!.annotations['kwirth/restartedAt'] = new Date().toISOString();
  
          this.appsV1Api.replaceNamespacedDeployment(deploymentName, namespace, deployment);
      }
      catch (err) {
          console.error(`Error restarting deployment ${deploymentName}:`, err);
      }
  }
    
  constructor (appsV1Api:AppsV1Api) {
    this.appsV1Api=appsV1Api

    this.route.route('/:namespace/:deployment')
      .post( async (req, res) => {
        try {
            this.restartDeployment(req.params.namespace, req.params.deployment);
            res.status(200).json();
        }
        catch (err) {
            res.status(200).json([]);
            console.log(err);
        }
      })
  }

}
