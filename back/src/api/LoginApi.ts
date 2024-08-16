import express from 'express';
import Semaphore from 'ts-semaphore';
import { Secrets } from '../tools/Secrets';
import Guid from 'guid';
import { ApiKeyApi } from './ApiKeyApi';
import { ApiKey } from '../model/ApiKey';

export class LoginApi {
  secrets:Secrets;
  static semaphore:Semaphore = new Semaphore(1);
  public route = express.Router();

  okResponse = (user:any) => {
    var newObject:any={};
    Object.assign(newObject,user);
    delete newObject['password'];
    return newObject;
  }
  
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
              user.apiKey=createApiKey(req.body.user);
              users[req.body.user]=btoa(JSON.stringify(user));
              secrets.write('kwirth.users',users);
              res.status(200).json(this.okResponse(user));
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
            user.apiKey=createApiKey(req.body.user);
            users[req.body.user]=btoa(JSON.stringify(user));
            secrets.write('kwirth.users',users);
            res.status(200).json(this.okResponse(user));
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

    function createApiKey(username:string) {
      var apiKey:ApiKey= {
        key: Guid.create().toString(),
        description: `Login user '${username}' at ${Date.now().toString()}`,
        expire: null
      };
      ApiKeyApi.apiKeys.push(apiKey);
      return apiKey.key;
    }
  }
}
