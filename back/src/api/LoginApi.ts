import express, { Request, Response} from 'express'
import Semaphore from 'ts-semaphore'
import { ApiKeyApi } from './ApiKeyApi'
import { ApiKey } from '@jfvilas/kwirth-common'
import { accessKeyCreate } from '@jfvilas/kwirth-common'
import { cleanApiKeys } from '../tools/AuthorizationManagement'
import { ISecrets } from '../tools/ISecrets'
import { IConfigMaps } from '../tools/IConfigMap'

export class LoginApi {
    secrets: ISecrets
    configMaps: IConfigMaps
    static semaphore:Semaphore = new Semaphore(1)
    public route = express.Router()

    constructor (secrets: ISecrets, configMaps: IConfigMaps) {
        this.secrets = secrets
        this.configMaps = configMaps

        // authentication (login)
        this.route.post('/', async (req:Request,res:Response) => {
            LoginApi.semaphore.use ( async () => {
                var users:any = (await secrets.read('kwirth.users') as any)
                var user:any=JSON.parse(atob(users[req.body.user]))
                if (user) {
                    if (req.body.password===user.password) {
                        if (user.password==='password')
                            res.status(201).send()
                        else {
                            user.accessKey=(await this.createApiKey(req, req.body.user)).accessKey
                            res.status(200).json(this.okResponse(user))
                        }
                    } 
                    else {
                        res.status(401).json()
                    }
                }
                else {
                    res.status(403).json()
                }
            })
        })

        // change password
        this.route.post('/password', async (req:Request,res:Response) => { 
            LoginApi.semaphore.use ( async () => {
                var users:any = (await secrets.read('kwirth.users') as any)
                var user:any=JSON.parse (atob(users[req.body.user]))
                if (user) {
                    if (req.body.password===user.password) {
                        user.password = req.body.newpassword
                        user.accessKey=(await this.createApiKey(req, req.body.user)).accessKey
                        users[req.body.user]=btoa(JSON.stringify(user))
                        await secrets.write('kwirth.users',users)
                        res.status(200).json(this.okResponse(user))
                    }
                    else {
                        res.status(401).send()
                    }
                }
                else {
                    res.status(403).send()
                }
            })
        })

    }

    createApiKey = async (req:Request, username:string) : Promise<ApiKey> => {
        var ip=(req as any).clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress
        var apiKey:ApiKey = {
            accessKey: accessKeyCreate('permanent', 'cluster:::::'),
            description: `Login user '${username}' at ${new Date().toISOString()} from ${ip}`,
            expire: Date.now() + 24*60*60*1000  // 24h
        }
        var storedKeys = await this.configMaps.read('kwirth.keys', [])
        storedKeys = cleanApiKeys(storedKeys)
        storedKeys.push(apiKey)
        this.configMaps.write('kwirth.keys', storedKeys )
        ApiKeyApi.apiKeys = storedKeys
        return apiKey
    }

    okResponse = (user:any) => {
        var newObject:any={}
        Object.assign(newObject,user)
        delete newObject['password']
        return newObject
    }
    
}
