import express from 'express';
import { Secrets } from '../tools/Secrets';
import Semaphore from 'ts-semaphore';
import { validKey } from '../tools/AuthorizationManagement';

export class UserApi {
    secrets:Secrets;
    static semaphore:Semaphore = new Semaphore(1);
    //static namespace:string;

    public route = express.Router();

    constructor (secrets:Secrets) {
      this.secrets=secrets;

      this.route.route('/')
        .all( async (req,res, next) => {
          if (!validKey(req,res)) return;
          next();
        })
        .get( (req, res) => {
          UserApi.semaphore.use ( async () => {
            try {
              var users:any = (await secrets.read('kwirth.users') as any);
              res.status(200).json(Object.keys(users));
            }
            catch (err) {
              console.log(err);
              res.status(500).json();
            }
          });
        })
        .post( (req, res) => {
          UserApi.semaphore.use ( async () => {
            try {
              var users:any = (await secrets.read('kwirth.users') as any);
              users[req.body.id]=btoa(JSON.stringify(req.body));
              await this.secrets.write('kwirth.users',users);
              res.status(200).json();
            }
            catch (err) {
              console.log(err);
              res.status(500).json();
            }
          });
        });

      this.route.route('/:user')
        .all( async (req,res, next) => {
          if (!validKey(req,res)) return;
          next();
        })
        .get( (req, res) => {
          UserApi.semaphore.use ( async () => {
            try {
              var users:any = (await secrets.read('kwirth.users') as any);
              res.status(200).send(atob(users[req.params.user]));
            }      
            catch (err) {
              console.log(err);
              res.status(500).send();
            }
          });
        })
        .delete( (req, res) => {
            try {
              UserApi.semaphore.use ( async () => {
                var users:any = (await secrets.read('kwirth.users') as any);
                delete users[req.params.user];
                await this.secrets.write('kwirth.users',users);
                res.status(200).json();
              });
            }      
            catch (err) {
              res.status(500).json();
              console.log(err);
            }
        })
        .put( (req, res) => {
          UserApi.semaphore.use ( async () => {
            try {
              var users:any = (await secrets.read('kwirth.users') as any);
              users[req.body.id]=btoa(JSON.stringify(req.body));
              await this.secrets.write('kwirth.users',users);
              res.status(200).json();
            }
            catch (err) {
              console.log(err);
              res.status(500).json();
            }
          });
        });

    }
}
