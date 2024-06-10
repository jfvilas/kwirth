import { CoreV1Api } from '@kubernetes/client-node';
import express from 'express';
import Secrets from '../tools/Secrets';

export class StoreApi {
  static secrets:Secrets;
  static namespace:string;

  public route = express.Router();

  constructor (coreV1Api:CoreV1Api, namespace:string='default') {
    StoreApi.secrets=new Secrets(coreV1Api, namespace);

    this.route.route('/store/:key')
    .get( async (req, res) => {
      try {
        var content= await StoreApi.secrets.read(req.params.key);
        res.status(200).json();
      }
      catch (err) {
        res.status(500).json();
        console.log(err);
      }
    })
    .post( async (req, res) => {
      try {
        var content= await StoreApi.secrets.write(req.params.key, req.body);
        res.status(200).json();
      }
      catch (err) {
        res.status(500).json();
        console.log(err);
      }
    });
  }
}
