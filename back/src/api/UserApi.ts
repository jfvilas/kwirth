import express from 'express';
import { Secrets } from '../tools/Secrets';
import Semaphore from 'ts-semaphore';
import { validKey } from '../tools/AuthorizationManagement';

export class UserApi {
  public static users:any={};
  secrets:Secrets;
  static semaphore:Semaphore = new Semaphore(1);
  static namespace:string;

  public route = express.Router();

  constructor (secrets:Secrets) {
    this.secrets=secrets;
    secrets.read('kwirth.users').then (  (resp) => {
      UserApi.users=resp;
    })
    .catch ((err) => {
      console.log('err reading users');
      console.log(err);
    });

    this.route.route('/')
      .all( async (req,res, next) => {
        if (!validKey(req,res)) return;
        next();
      })
      .get( (req, res) => {
        UserApi.semaphore.use ( async () => {
          try {
            res.status(200).json(Object.keys(UserApi.users));
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
            UserApi.users[req.body.id]=btoa(JSON.stringify(req.body));
            await this.secrets.write('kwirth.users',UserApi.users);
            res.status(200).send('');
          }
          catch (err) {
            res.status(500).json();
            console.log(err);
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
            res.status(200).send(atob(UserApi.users[req.params.user]));
          }      
          catch (err) {
            res.status(500).json();
            console.log(err);
          }
        });
      })
      .delete( (req, res) => {
          try {
            UserApi.semaphore.use ( async () => {
              delete UserApi.users[req.params.user];
              await this.secrets.write('kwirth.users',UserApi.users);
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
            UserApi.users[req.body.id]=btoa(JSON.stringify(req.body));
            await this.secrets.write('kwirth.users',UserApi.users);
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
