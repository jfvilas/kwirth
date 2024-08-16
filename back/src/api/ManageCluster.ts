import express from 'express';
import { AppsV1Api } from '@kubernetes/client-node';
import { CoreV1Api } from '@kubernetes/client-node';

export class ManageCluster {
  public route = express.Router();
  coreV1Api:CoreV1Api;
  appsV1Api:AppsV1Api;

  
  constructor (coreV1Api:CoreV1Api, appsV1Api:AppsV1Api) {
    this.coreV1Api=coreV1Api
    this.appsV1Api=appsV1Api

    this.route.route('/find')
      .get( async (req, res) => {
        try {
          var label:string=req.query.label as string;
          var entity:string=req.query.entity as string;
          const labelSelector=`${label}=${entity}`;
          console.log('querying: '+labelSelector);
          const kresp = await this.coreV1Api.listPodForAllNamespaces(undefined, undefined, undefined, labelSelector);
          var podList=kresp.body.items.map(pod => {
            console.log(pod);
            var owners = pod.metadata!.ownerReferences;
            if (owners) {
              console.log(owners.length);
              console.log(owners[0]);
            }
            return { namespace:pod.metadata?.namespace, name:pod.metadata?.name }
          });
          res.status(200).json(podList);
        }
        catch (err) {
            res.status(500).json();
            console.log(err);
        }
      });
  }

}
