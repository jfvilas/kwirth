import express, { Request, Response} from 'express'
import Semaphore from 'ts-semaphore'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { ApiKeyApi } from './ApiKeyApi'
import { IConfigMaps } from '../tools/IConfigMap'

export class StoreApi {
    configMaps: IConfigMaps
    static semaphore:Semaphore = new Semaphore(1)

    public route = express.Router()

    constructor (config: IConfigMaps, apiKeyApi: ApiKeyApi) {
        this.configMaps=config

        // A group is implemented by prepending 'groupname-' (the group name and a dash) to key name

        // get groups
        this.route.route('/:user')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get(async (req:Request, res:Response) => {
                StoreApi.semaphore.use ( async () => {
                    try {
                        let data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{})
                        if (data===undefined)
                            res.status(200).json([])
                        else {
                            let allGroupNames=Object.keys(data).map(k => k.substring(0,k.indexOf('-')))
                            let uniqueGroups = [...new Set(allGroupNames)]
                            res.status(200).json(uniqueGroups)
                        }
                    }
                    catch (err) {
                        res.status(500).json()
                        console.log(err)
                    }
                })
            })

        // get an array of object names in a group
        // if parameter full is present we return an array containing all the objects
        this.route.route('/:user/:group')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res,apiKeyApi))) return
                next()
            })
            .get(async (req:Request, res:Response) => {
                StoreApi.semaphore.use ( async () => {
                    try {
                        let data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{})
                        if (data === undefined)
                            res.status(200).json([])
                        else {
                            if (req.query.full) {
                                let selectedGroupObjects = Object.keys(data).filter(k => k.startsWith(req.params.group+'-'))
                                let objects = selectedGroupObjects.map ( o => {
                                    return { [o.substring(o.indexOf('-')+1)]: data[o] }
                                })
                                res.status(200).json(objects)
                            }
                            else {
                                res.status(200).json(Object.keys(data).filter(k => k.startsWith(req.params.group+'-')).map(k => k.substring(k.indexOf('-')+1)))
                            }
                        }
                    }
                    catch (err) {
                        res.status(500).json()
                        console.log(err)
                    }
                })
            })

        // get an object
        this.route.route('/:user/:group/:key')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, apiKeyApi))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                StoreApi.semaphore.use ( async () => {
                    try {
                        let data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{})
                        if (!data || data[req.params.group+'-'+req.params.key]===undefined) {
                            res.status(404).json()
                        }
                        else {
                            res.status(200).json(data[req.params.group + '-' + req.params.key])
                        }
                    }      
                    catch (err) {
                        res.status(500).json()
                        console.log(err)
                    }
                })
            })
            .delete( async (req:Request, res:Response) => {
                StoreApi.semaphore.use ( async () => {
                    try {
                        let data:any= await this.configMaps.read('kwirth.store.'+req.params.user)
                        if (!data) data = {}
                        delete data[req.params.group+'-'+req.params.key]
                        await this.configMaps.write('kwirth.store.'+req.params.user,data)
                        res.status(200).json()
                    }      
                    catch (err) {
                        res.status(500).json()
                        console.log(err)
                    }
                })
            })
            .post( async (req:Request, res:Response) => {
                StoreApi.semaphore.use ( async () => {
                    try {
                        let data:any= await this.configMaps.read('kwirth.store.'+req.params.user,{})
                        if (!data) data={}
                        data[req.params.group+'-'+req.params.key]=JSON.stringify(req.body)
                        await this.configMaps.write('kwirth.store.'+req.params.user,data)
                        res.status(200).json()
                    }
                    catch (err) {
                        res.status(500).json()
                        console.log(err)
                    }
                })
            })
    }
}
