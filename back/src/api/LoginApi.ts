import express from 'express';
import Semaphore from 'ts-semaphore';
import { Secrets } from '../tools/Secrets';
import Guid from 'guid';

export class LoginApi {
  secrets:Secrets;
  static semaphore:Semaphore = new Semaphore(1);
  public route = express.Router();

  constructor (secrets:Secrets) {
    this.secrets = secrets;

    // authentication
    this.route.post('/', async (req:any,res:any) => {
      LoginApi.semaphore.use ( async () => {
        var users:any = (await secrets.read('kwirth.users') as any);
        var user:any=JSON.parse(atob(users[req.body.user]));
        if (user) {
          if (req.body.password===user.password) {
            if (user.password==='password')
              res.status(201).send('');
            else {
              user.apiKey=Guid.create().toString();
              users[req.body.user]=btoa(JSON.stringify(user));
              secrets.write('kwirth.users',users);
              res.status(200).json(user);
            }
          } 
          else {
            res.status(401).send('');
          }
        }
        else {
          res.status(403).send('');
        }
      });
    });

    this.route.post('/password', async (req:any,res:any) => { 
      LoginApi.semaphore.use ( async () => {
        var users:any = (await secrets.read('kwirth.users') as any);
        var user:any=JSON.parse (atob(users[req.body.user]));
        if (user) {
          if (req.body.password===user.password) {
            user.password = req.body.newpassword
            user.apiKey=Guid.create().toString();
            users[req.body.user]=btoa(JSON.stringify(user));
            secrets.write('kwirth.users',users);
            var x:any={};
            Object.assign(x,user);
            delete x['password'];
            res.status(200).json(x);
          }
          else {
            res.status(401).send('');
          }
        }
        else {
          res.status(403).send('');
        }
      });
    });

  }
}
