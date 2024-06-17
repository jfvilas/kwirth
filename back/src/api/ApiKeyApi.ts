import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Guid from 'guid';
import { ApiKey } from '../model/ApiKey';
//import Semaphore from 'ts-semaphore';

export class ApiKeyApi {
  static apiKeys:ApiKey[]=[];
  configMaps:ConfigMaps;
  //+++ review if semaphore is needed (static semaphore:Semaphore = new Semaphore(1);)
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
      .get( async (req, res) => {
        res.status(200).json(ApiKeyApi.apiKeys);
      })
      .post( async (req, res) => {
        try {
          var description=req.body.description;
          var expire=req.body.expire;
          var key={ key:Guid.create().toString(), description:description, expire:expire };
          ApiKeyApi.apiKeys.push(key);
          configMaps.write('kwirth.keys',{ keys: JSON.stringify(ApiKeyApi.apiKeys) });
          res.status(200).json(key);
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });

    this.route.route('/:key')
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
          configMaps.write('kwirth.keys',{ keys:JSON.stringify(ApiKeyApi.apiKeys) });
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
          configMaps.write('kwirth.keys',{ keys:JSON.stringify(ApiKeyApi.apiKeys) });
          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });
  }

}