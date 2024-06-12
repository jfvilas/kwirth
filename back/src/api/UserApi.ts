import express from 'express';
import { Secrets } from '../tools/Secrets';
import Semaphore from 'ts-semaphore';

export class UserApi {
  secrets:Secrets;
  static semaphore:Semaphore = new Semaphore(1);
  static namespace:string;

  public route = express.Router();

  constructor (secrets:Secrets, namespace:string='default') {
    this.secrets=secrets;

    this.route.route('/')
    .get( (req, res) => {
      UserApi.semaphore.use ( async () => {
        try {
          var data:any= await this.secrets.read('kwirth.users');
          console.log(data);
          res.status(200).json(Object.keys(data));
        }
        catch (err) {
          console.log('err');
          console.log(err);
          res.status(500).send();
        }
      });
    })
    .post( (req, res) => {
      UserApi.semaphore.use ( async () => {
        try {
          var data:any= await this.secrets.read('kwirth.users');
          data[req.body.id]=btoa(JSON.stringify(req.body));
          await this.secrets.write('kwirth.users',data);
          res.status(200).send('');
        }
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    });

    this.route.route('/:user')
    .get( (req, res) => {
      UserApi.semaphore.use ( async () => {
        try {
          var data:any= await this.secrets.read('kwirth.users');
          console.log(atob(data[req.params.user]));
          res.status(200).send(atob(data[req.params.user]));
        }      
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    })
    .delete( (req, res) => {
      UserApi.semaphore.use ( async () => {
        try {
          var data:any= await this.secrets.read('kwirth.users');
          delete data[req.params.user];
          await this.secrets.write('kwirth.users',data);
          res.status(200).json();
        }      
        catch (err) {
          res.status(500).json();
          console.log(err);
        }
      });
    })
  }
}
