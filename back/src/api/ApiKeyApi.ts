import { ConfigMaps } from '../tools/ConfigMaps';
import { ApiKey } from '../model/ApiKey';
import express from 'express';
import Guid from 'guid';
import { validKey } from '../tools/AuthorizationManagement';

export class ApiKeyApi {
  static apiKeys:ApiKey[]=[];
  configMaps:ConfigMaps;
  public route = express.Router();

  constructor (configMaps:ConfigMaps) {
    this.configMaps = configMaps;
    configMaps.read('kwirth.keys',{ keys:[] }).then (  (resp) => {
      ApiKeyApi.apiKeys=JSON.parse(resp.keys);
    })
    .catch ((err) => {
      console.log('err reading keys. kwirth will start with no keys');
      console.log(err);
    });

    this.route.route('/')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( async (req, res) => {
        res.status(200).json(ApiKeyApi.apiKeys);
      })
      .post( async (req, res) => {
        try {
          /*
            TYPE:
            kwirth
            resource
          */
          var type=req.body.type.toLowerCase();
          /*
            RESOURCE:
            cluster:scope:namespace:set:pod:container
            
            cluster: name
            scope: cluster|namespace|set|pod|container
            namespace: name
            set: name
            pod: name
            container: name
          */
          var resource=req.body.resource.toLowerCase();  // optional (mandatory if type is 'resource')
          var description=req.body.description;
          var expire=req.body.expire;
          var key=type+'|'+resource+'|'+Guid.create().toString();
          var keyObject={ key:key, description:description, expire:expire };
          ApiKeyApi.apiKeys.push(keyObject);
          if (type!=='resource') {
            configMaps.write('kwirth.keys',{ keys: JSON.stringify(ApiKeyApi.apiKeys) });
          }
          res.status(200).json(keyObject);
      }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });

    this.route.route('/:key')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( async (req, res) => {
        try {
          var key=ApiKeyApi.apiKeys.filter(k => k.key!==req.params.key);
          if (key)
            res.status(200).json(key);
          else
            res.status(404).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      })
      .delete( async (req, res) => {
        try {
          ApiKeyApi.apiKeys=ApiKeyApi.apiKeys.filter(k => k.key!==req.params.key);
          if (req.params.key.startsWith('kwirth')) {
            configMaps.write('kwirth.keys',{ keys:JSON.stringify(ApiKeyApi.apiKeys) });
          }
          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      })
      .put( async (req, res) => {
        try {
          var key=req.body as ApiKey;
          ApiKeyApi.apiKeys=ApiKeyApi.apiKeys.filter(k => k.key!==key.key);
          key.key=req.params.key;
          ApiKeyApi.apiKeys.push(key);
          if (req.params.key.startsWith('kwirth')) {
            configMaps.write('kwirth.keys',{ keys:JSON.stringify(ApiKeyApi.apiKeys) });
          }
          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });
  }
}
