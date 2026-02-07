import express, { Request, Response} from 'express'
import Semaphore from 'ts-semaphore'
import { ApiKeyApi } from './ApiKeyApi'
import { ApiKey, ILoginResponse, IUser } from '@jfvilas/kwirth-common'
import { accessKeyCreate } from '@jfvilas/kwirth-common'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { ISecrets } from '../tools/ISecrets'
import { IConfigMaps } from '../tools/IConfigMap'

export class LoginApi {
    secrets: ISecrets
    configMaps: IConfigMaps
    apiKeyApi: ApiKeyApi
    static semaphore:Semaphore = new Semaphore(1)
    public route = express.Router()

    constructor (secrets: ISecrets, configMaps: IConfigMaps, apiKeyApi:ApiKeyApi) {
        this.secrets = secrets
        this.configMaps = configMaps
        this.apiKeyApi = apiKeyApi

        // authentication (login)
        this.route.post('/', async (req:Request,res:Response) => {
            LoginApi.semaphore.use ( async () => {
                let users = await this.readUsersSecret(this.secrets)
                if (!users) {
                    console.error('Cannot access kwirth users on /')
                    res.status(401).json()
                    return
                }

                if (!users[req.body.user]) {
                    res.status(401).json()
                    return
                }
                let user:IUser = JSON.parse(atob(users[req.body.user]))
                if (user) {
                    if (req.body.password === user.password) {
                        if (user.id === 'admin' && user.password === 'password')
                            res.status(201).send()
                        else {
                            let ip = (req as any).clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress
                            user.accessKey = (await this.createApiKey(user, ip, this.apiKeyApi)).accessKey
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
                let users = await this.readUsersSecret(this.secrets)
                if (!users) {
                    console.error('Cannot access kwirth users for changini password')
                    res.status(401).json()
                    return
                }

                if (!users[req.body.user]) {
                    res.status(401).json()
                    return
                }

                let user:IUser = JSON.parse (atob(users[req.body.user]))
                if (user) {
                    if (req.body.password===user.password) {
                        user.password = req.body.newpassword
                        let ip = (req as any).clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress
                        user.accessKey=(await this.createApiKey(user, ip, this.apiKeyApi)).accessKey
                        users[req.body.user]=btoa(JSON.stringify(user))
                        await secrets.write('kwirth-users',users)
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

    readUsersSecret = async (secrets: ISecrets) => {
        let users:{ [username:string]:string }
        try {
            users = await secrets.read('kwirth-users')
            return users
        }
        catch (err) {
            try {
                users = await secrets.read('kwirth.users')
            }
            catch (err) {
                console.log(`*** Cannot read 'kwirth-users' secret on source ***`)
                return undefined
            }
            return users
        }
    }

    createApiKey = async (user:IUser, ip:string, apiKeyApi:ApiKeyApi) : Promise<ApiKey> => {
        //let ip = (req as any).clientIp || req.headers['x-forwarded-for'] || req.socket.remoteAddress
        let apiKey:ApiKey = {
            accessKey: accessKeyCreate('permanent', user.resources),
            description: `Login user '${user.id}' from ${ip}`,
            expire: Date.now() + 24*60*60*1000,
            days: 1
        }
        let storedKeys = await this.configMaps.read('kwirth.keys', [])
        storedKeys = AuthorizationManagement.cleanApiKeys(storedKeys)
        storedKeys.push(apiKey)
        this.configMaps.write('kwirth.keys', storedKeys )
        apiKeyApi.apiKeys = storedKeys
        return apiKey
    }

    okResponse = (user:IUser) => {
        var response:ILoginResponse = {
            id: user.id,
            name: user.name,
            accessKey: user.accessKey
        }
        return response
    }
    
}
