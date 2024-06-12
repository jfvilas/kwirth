import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Guid from 'guid';
import { Key } from '../model/Key';
import Semaphore from 'ts-semaphore';

export class KeyApi {
  static keys:Key[]=[];
  configMaps:ConfigMaps;
  static semaphore:Semaphore = new Semaphore(1);
  public route = express.Router();

  constructor (configMaps:ConfigMaps) {
    this.configMaps = configMaps;
    configMaps.read('kwirth.keys',{ keys:[] }).then (  (resp) => {
      console.log('read keys');
      KeyApi.keys=JSON.parse(resp.keys);
      console.log(KeyApi.keys);
    })
    .catch ((err) => {
      console.log('err reading keys');
      console.log(err);
    });


    this.route.route('/')
      .get( async (req, res) => {
        res.status(200).json(KeyApi.keys);
      })
      .post( async (req, res) => {
        try {
          var description=req.body.description;
          var expire=req.body.expire;
          var key={ key:Guid.create().toString(), description:description, expire:expire };
          KeyApi.keys.push(key);
          configMaps.write('kwirth.keys',{ keys: JSON.stringify(KeyApi.keys) });
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
          var key=KeyApi.keys.filter(k => k.key!==req.params.key);
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
          KeyApi.keys=KeyApi.keys.filter(k => k.key!==req.params.key);
          configMaps.write('kwirth.keys',{ keys:JSON.stringify(KeyApi.keys) });
          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      })
      .put( async (req, res) => {
        try {
          var key=req.body as Key;
          KeyApi.keys=KeyApi.keys.filter(k => k.key!==key.key);
          key.key=req.params.key;
          KeyApi.keys.push(key);
          configMaps.write('kwirth.keys',{ keys:JSON.stringify(KeyApi.keys) });
          res.status(200).json({});
        }
        catch (err) {
          res.status(500).json({});
          console.log(err);
        }
      });
  }

}
