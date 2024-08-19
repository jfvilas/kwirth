import { ConfigMaps } from '../tools/ConfigMaps';
import { ApiKey } from '../model/ApiKey';
import express from 'express';
import Guid from 'guid';
import { validKey } from '../tools/AuthorizationManagement';

export class ApiKeyApi {
  configMaps:ConfigMaps;
  public static apiKeys:ApiKey[]=[];
  public route = express.Router();

  constructor (configMaps:ConfigMaps) {
    this.configMaps = configMaps;

    configMaps.read('kwirth.keys',[]).then( result => {
      ApiKeyApi.apiKeys=result;
      console.log('read keys:');
      console.log(ApiKeyApi.apiKeys);
    });

    this.route.route('/')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( async (req, res) => {
        var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[];
        res.status(200).json(storedKeys);
      })
      .post( async (req, res) => {
        try {
          /*
            TYPE

            VALUES
            permanent
            volatile
          */
          var type=req.body.type.toLowerCase();
          /*
            RESOURCE

            FORMAT:
            scope:namespace:setType:setName:pod:container
            
            VALUES:
            scope: cluster|namespace|set|pod|container
            namespace: name
            setType: replica|daemon|stateful
            setName: name
            pod: name
            container: name

            EXAMPLES:
            cluster:::::  // all the cluster logs
            namespace:default::::  // all logs in 'default' namespace
            set:default:replica:abcd::  // all pods in 'abcd' replicaset inside namespace 'default'
            pod:default::abcd::  // all pods with name 'abcd' inside namespace 'default'
            pod:::abcd::  // all pods with name 'abcd'
          */
          var type=req.body.type.toLowerCase();  // volatile or permanent
          var resource=req.body.resource.toLowerCase();  // optional (mandatory if type is 'resource')
          var description=req.body.description;
          var expire=req.body.expire;
          var key=Guid.create().toString()+'|'+type+'|'+resource;
          var keyObject={ key:key, description:description, expire:expire };

          if (type==='permanent') {
            var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[];
            storedKeys.push(keyObject);
            await configMaps.write('kwirth.keys',storedKeys);
            ApiKeyApi.apiKeys=storedKeys;
          }
          else {
            ApiKeyApi.apiKeys.push(keyObject);
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
          var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[];
          var key=storedKeys.filter(k => k.key===req.params.key);
          if (key.length>0)
            res.status(200).json(key[0]);
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
          var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[];
          storedKeys=storedKeys.filter(k => k.key!==req.params.key);
          await configMaps.write('kwirth.keys', storedKeys );
          ApiKeyApi.apiKeys=storedKeys;

          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      })
      .put( async (req, res) => {
        try {
          var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[];
          var key=req.body as ApiKey;
          storedKeys=storedKeys.filter(k => k.key!==key.key);
          key.key=req.params.key;
          storedKeys.push(key);
          await configMaps.write('kwirth.keys',storedKeys);
          ApiKeyApi.apiKeys=storedKeys;

          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });
  }
}
