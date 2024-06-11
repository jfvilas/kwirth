import express from 'express';
import { ConfigMaps } from '../tools/ConfigMaps';
import Semaphore from 'ts-semaphore';

export class StoreApi {
  configMaps:ConfigMaps;
  static semaphore:Semaphore = new Semaphore(1);
  static namespace:string;

  public route = express.Router();

  constructor (config:ConfigMaps, namespace:string='default') {
    this.configMaps=config;

    this.route.route('/store/:user/:key')
    .get( async (req, res) => {
      try {
        StoreApi.semaphore.use ( async () => {
          var content:any= await this.configMaps.read('kwirth.store.'+req.params.user);
          res.status(200).json(content.data['key']);
        });
      }
      catch (err) {
        res.status(500).json();
        console.log(err);
      }
    })
    .post( async (req, res) => {
      try {
        StoreApi.semaphore.use ( async () => {
          var content:any= await this.configMaps.read('kwirth.store.'+req.params.user);
          content.data[req.params.key]=req.body;
          await this.configMaps.write('kwirth.store.'+req.params.user,content);
          res.status(200).send('');
          });
      }
      catch (err) {
        res.status(500).json();
        console.log(err);
      }
    });
  }
}
