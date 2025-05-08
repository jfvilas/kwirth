import express, { Request, Response} from 'express'
import Semaphore from 'ts-semaphore'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { ApiKeyApi } from './ApiKeyApi'
import { ISecrets } from '../tools/ISecrets'

export class UserApi {
    secrets: ISecrets
    static semaphore: Semaphore = new Semaphore(1)

    public route = express.Router()

    constructor (secrets: ISecrets, apiKeyApi: ApiKeyApi) {
      this.secrets=secrets

      this.route.route('/')
        .all( async (req:Request,res:Response, next) => {
            if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
            next()
        })
        .get( (req:Request,res:Response) => {
            UserApi.semaphore.use ( async () => {
                try {
                    var users:any = await secrets.read('kwirth.users')
                    res.status(200).json(Object.keys(users))
                }
                catch (err) {
                    res.status(500).json()
                    console.log(err)
                }
            })
        })
        .post( (req:Request,res:Response) => {
            UserApi.semaphore.use ( async () => {
                try {
                    var users:any = await secrets.read('kwirth.users')
                    users[req.body.id]=btoa(JSON.stringify(req.body))
                    await this.secrets.write('kwirth.users',users)
                    res.status(200).json()
                }
                catch (err) {
                    res.status(500).json()
                    console.log(err)
                }
            })
        })

      this.route.route('/:user')
        .all( async (req:Request,res:Response, next) => {
            if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
            next()
        })
        .get( (req:Request,res:Response) => {
            UserApi.semaphore.use ( async () => {
                try {
                    var users:any = await secrets.read('kwirth.users')
                    res.status(200).send(atob(users[req.params.user]))
                }
                catch (err) {
                    res.status(500).send()
                    console.log(err)
                }
            })
        })
        .delete( (req:Request,res:Response) => {
            try {
                UserApi.semaphore.use ( async () => {
                    var users:any = await secrets.read('kwirth.users')
                    delete users[req.params.user]
                    await this.secrets.write('kwirth.users',users)
                    res.status(200).json()
                });
            }      
            catch (err) {
                res.status(500).json()
                console.log(err)
            }
        })
        .put( (req:Request,res:Response) => {
            UserApi.semaphore.use ( async () => {
                try {
                    var users:any = await secrets.read('kwirth.users')
                    users[req.body.id]=btoa(JSON.stringify(req.body))
                    await this.secrets.write('kwirth.users',users)
                    res.status(200).json()
                }
                catch (err) {
                    console.log(err)
                    res.status(500).json()
                }
            })
        })
    }
}
