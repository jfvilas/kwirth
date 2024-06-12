import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Guid from 'guid';
import { Key } from '../model/Key';
import Semaphore from 'ts-semaphore';

export class KeyApi {
  public static keys:Key[]=[];
  configMaps:ConfigMaps;
  static semaphore:Semaphore = new Semaphore(1);
  public route = express.Router();

  constructor (configMaps:ConfigMaps) {
    this.configMaps = configMaps;
    configMaps.read('kwirth.keys',[]).then (  (resp) => {
      KeyApi.keys=resp;
    })
    .catch ((err) => {
      console.log('err reading keys');
      console.log(err);
    });


    this.route.route('/')
      .get( async (req, res) => {
        try {
          // store keys in secret
          res.status(200).json(KeyApi.keys);
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
          KeyApi.keys.push(key);
          console.log(KeyApi.keys);
          configMaps.write('kwirth.keys',KeyApi.keys);
          res.status(200).json(key);
        }
        catch (err) {
          res.status(200).json({});
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
          res.status(200).json([]);
          console.log(err);
        }
      })
      .delete( async (req, res) => {
        try {
          KeyApi.keys=KeyApi.keys.filter(k => k.key!==req.params.key);
          configMaps.write('kwirth.keys',KeyApi.keys);
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
          KeyApi.keys=KeyApi.keys.filter(k => k.key!==key.key);
          key.key=req.params.key;
          KeyApi.keys.push(key);
          configMaps.write('kwirth.keys',KeyApi.keys);
          res.status(200).json({});
        }
        catch (err) {
          res.status(200).json({});
          console.log(err);
        }
      });

  }

}
