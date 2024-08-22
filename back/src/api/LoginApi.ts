import express from 'express';
import Semaphore from 'ts-semaphore';
import { Secrets } from '../tools/Secrets';
import { ApiKeyApi } from './ApiKeyApi';
import { ApiKey } from '../model/ApiKey';
import { ConfigMaps } from '../tools/ConfigMaps';
import { accessKeyCreate } from '../model/AccessKey';

export class LoginApi {
    secrets:Secrets;
    configMaps:ConfigMaps;
    static semaphore:Semaphore = new Semaphore(1);
    public route = express.Router();

    createApiKey = async (req:any, username:string) : Promise<ApiKey> => {
        var ip=req.clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        var apiKey:ApiKey={
            accessKey: accessKeyCreate('permanent', 'cluster:::::'),
            description: `Login user '${username}' at ${new Date().toISOString()} from ${ip}`,
            expire: Date.now() + 24*60*60*1000  // 24h
        };
        var storedKeys = await this.configMaps.read('kwirth.keys', []);
        storedKeys.push(apiKey);
        this.configMaps.write('kwirth.keys', storedKeys );
        ApiKeyApi.apiKeys=storedKeys;
        return apiKey;
    }

    okResponse = (user:any) => {
        var newObject:any={};
        Object.assign(newObject,user);
        delete newObject['password'];
        return newObject;
    }
    
    constructor (secrets:Secrets, configMaps:ConfigMaps) {
        this.secrets = secrets;
        this.configMaps = configMaps;

        // authentication (login)
        this.route.post('/', async (req:any,res:any) => {
            LoginApi.semaphore.use ( async () => {
                var users:any = (await secrets.read('kwirth.users') as any);
                var user:any=JSON.parse(atob(users[req.body.user]));
                if (user) {
                    if (req.body.password===user.password) {
                        if (user.password==='password')
                        res.status(201).send('');
                        else {
                        user.accessKey=(await this.createApiKey(req, req.body.user)).accessKey;
                        res.status(200).json(this.okResponse(user));
                        }
                    } 
                    else {
                        res.status(401).json();
                    }
                }
                else {
                    res.status(403).send('');
                }
            });
        });

        // change password
        this.route.post('/password', async (req:any,res:any) => { 
            LoginApi.semaphore.use ( async () => {
                var users:any = (await secrets.read('kwirth.users') as any);
                var user:any=JSON.parse (atob(users[req.body.user]));
                if (user) {
                    if (req.body.password===user.password) {
                        user.password = req.body.newpassword
                        user.accessKey=(await this.createApiKey(req, req.body.user)).accessKey;
                        users[req.body.user]=btoa(JSON.stringify(user));
                        await secrets.write('kwirth.users',users);
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

    }
}
