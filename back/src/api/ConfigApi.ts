import express from 'express';
import { CoreV1Api, AppsV1Api, KubeConfig } from '@kubernetes/client-node';
import Guid from 'guid';
import { Key } from '../model/Key';

export class ConfigApi {
  public static keys:Key[]=[];
  public route = express.Router();
  coreApi:CoreV1Api;
  appsV1Api:AppsV1Api;

  constructor (kc:KubeConfig, coreApi:CoreV1Api, appsV1Api:AppsV1Api) {
    this.coreApi=coreApi;
    this.appsV1Api=appsV1Api

    this.route.route('/cluster')
      .get( async (req, res) => {
        try {
          var cluster={ name:kc.getCurrentCluster()?.name, apiKey:Guid.create().toString() };
          res.status(200).json(cluster);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
    });
    
    this.route.route('/namespace')
      .get( async (req, res) => {
        try {
          var response = await this.coreApi.listNamespace();
          var namespaces = response.body.items.map (n => n?.metadata?.name);
          res.status(200).json(namespaces);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      });

      this.route.route('/:namespace/pod')
      .get( async (req, res) => {
        try {
          var response= await this.coreApi.listNamespacedPod(req.params.namespace);
          var pods = response.body.items.map (n => n?.metadata?.name);
          res.status(200).json(pods);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      })

    this.route.route('/:namespace/deployment')
      .get( async (req, res) => {
        try {
          var response= await this.appsV1Api.listNamespacedDeployment(req.params.namespace);
          var deps = response.body.items.map (n => n?.metadata?.name);
          res.status(200).json(deps);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      })

      this.route.route('/key')
      .get( async (req, res) => {
        try {
          // store keys in secret
          res.status(200).json(ConfigApi.keys);
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      })
      .post( async (req, res) => {
        try {
          var description=req.body.description;
          var expire=req.body.expire;
          console.log(req);
          var key={ key:Guid.create().toString(), description:description, expire:expire };
          ConfigApi.keys.push(key);
          res.status(200).json(key);
        }
        catch (err) {
          res.status(200).json({});
          console.log(err);
        }
      });

      this.route.route('/key/:key')
      .get( async (req, res) => {
        try {
          var key=ConfigApi.keys.filter(k => k.key!==req.params.key);
          if (key)
            res.status(200).json(key);
          else
            res.status(404).json({});

        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      })
      .delete( async (req, res) => {
        try {
          ConfigApi.keys=ConfigApi.keys.filter(k => k.key!==req.params.key);
          res.status(200).json({});
        }
        catch (err) {
          res.status(200).json([]);
          console.log(err);
        }
      })
      .put( async (req, res) => {
        try {
          var key=req.body as Key;
          ConfigApi.keys=ConfigApi.keys.filter(k => k.key!==key.key);
          key.key=req.params.key;
          ConfigApi.keys.push(key);
          res.status(200).json({});
        }
        catch (err) {
          res.status(200).json({});
          console.log(err);
        }
      });

  }

}
