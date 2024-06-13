import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Semaphore from 'ts-semaphore';

export class StoreApi {
  configMaps:ConfigMaps;
  static semaphore:Semaphore = new Semaphore(1);
  static namespace:string;

  public route = express.Router();

  constructor (config:ConfigMaps) {
    this.configMaps=config;

    this.route.route('/:user')
    .get(async (req, res) => {
      StoreApi.semaphore.use ( async () => {
        try {
          var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
          if (data===undefined)
            res.status(200).json([]);
          else
            res.status(200).json(Object.keys(data));
        }
        catch (err) {
          console.log('err');
          console.log(err);
          res.status(500).send();
        }
      });
    });

    this.route.route('/:user/:key')
    .get( async (req, res) => {
      StoreApi.semaphore.use ( async () => {
        try {
          var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
          res.status(200).json(data[req.params.key]);
        }      
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    })
    .delete( async (req, res) => {
      StoreApi.semaphore.use ( async () => {
        try {
          var data:any= await this.configMaps.read('kwirth.store.'+req.params.user);
          delete data[req.params.key];
          await this.configMaps.write('kwirth.store.'+req.params.user,data);
          res.status(200).json();
        }      
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    })
    .post( async (req, res) => {
      StoreApi.semaphore.use ( async () => {
        try {
          var data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{});
          data[req.params.key]=JSON.stringify(req.body);
          await this.configMaps.write('kwirth.store.'+req.params.user,data);
          res.status(200).send('');
        }
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    });
  }
}
