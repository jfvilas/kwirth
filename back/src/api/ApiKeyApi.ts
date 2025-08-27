import express, { Request, Response} from 'express'
import { accessKeyBuild, ApiKey } from '@jfvilas/kwirth-common'
import { AuthorizationManagement } from '../tools/AuthorizationManagement'
import { AccessKey, accessKeySerialize } from '@jfvilas/kwirth-common'
import * as crypto from 'crypto'
import { IConfigMaps } from '../tools/IConfigMap'

export class ApiKeyApi {
    public static apiKeys:ApiKey[]=[]
    public route = express.Router()

    configMaps: IConfigMaps
    masterKey:string=''

    constructor (configMaps: IConfigMaps, masterKey:string) {
        this.configMaps = configMaps
        this.masterKey = masterKey

        configMaps.read('kwirth.keys',[]).then( (result:ApiKey[]) => {
            result = AuthorizationManagement.cleanApiKeys(result)
            ApiKeyApi.apiKeys=result
        })

        this.route.route('/')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req, res, this))) return
                next()
            })
            .get( async (req:Request,res:Response) => {
                let storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                for (let apikey of ApiKeyApi.apiKeys)
                    if (!storedKeys.some(s => accessKeySerialize(s.accessKey) === accessKeySerialize(apikey.accessKey))) storedKeys.push(apikey)
                res.status(200).json(storedKeys)
            })
            .post( async (req:Request, res:Response) => {
                try {
                    /*
                        TYPE

                        VALUES
                        permanent
                        volatile
                        bearer
                    */
                    /*
                        RESOURCE

                        FORMAT:
                        scopes:namespaces:groups:pods:containers
                        
                        VALUES:
                        scope: cluster|api|filter|view|restart|... (or a CSV list)
                        namespace: names (comma separated name list)
                        group: {deployment|replica|daemon|stateful}+name (type of pod group, a plus sign, name of the group). it is also comma separated name list
                        pod: names (comma separated name list)
                        container: names (comma separated name list)

                        EXAMPLES:
                        cluster::::  // all the cluster logs
                        view,filter:default:::  // view all logs in 'default' namespace
                        restart::deployment+kwirth::  // restart deployment 'kwirth' in all namespaces
                        restart:default:replica+abcd::  // restart all pods in 'abcd' replicaset inside namespace 'default'
                        view,filter,stream:default:replica+abcd:abcd:  // view all pod logs with name 'abcd' inside namespace 'default'
                        filter:pre,dev::pod1:  // search pod named 'pod1' in namespaces 'pre' and 'dev'
                        filter:::pod2:  // search for all instances of 'pod2' (a-ny namespace)
                        filter::replica+rs1::  // all pods of replicaset 'rs1' in a-ny namespace
                        filter:default:replica+rs1::cont1  // 'container1' on replicaset 'rs1' on namespace 'default'
                        filter:pro:replica+rs1:pod1,pod2:  // scope 'filter', pods 'pod1' and 'pod2' on replicaset 'rs1' on namespace 'pro'
                    */
                    let description=req.body.description
                    let expire:number = req.body.expire  // an epoch
                    let days:number = req.body.days || (expire-Date.now())
                    let accessKey:AccessKey = req.body.accessKey as AccessKey
                    let apiKey:ApiKey={ accessKey, description, expire, days }

                    if (accessKey.type) {
                        if (accessKey.type==='permanent') {
                            let storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                            storedKeys = AuthorizationManagement.cleanApiKeys(storedKeys)
                            storedKeys.push(apiKey)
                            await configMaps.write('kwirth.keys',storedKeys)
                            ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type==='volatile'), ...storedKeys]
                        }
                        else if (accessKey.type==='volatile') {
                            ApiKeyApi.apiKeys.push(apiKey)
                        }
                        else {
                            // bearer
                            let input = this.masterKey + '|' + accessKey.resources + '|' + expire
                            let hash = crypto.createHash('md5').update(input).digest('hex')
                            accessKey.type = 'bearer:' + expire 
                            apiKey.accessKey = accessKeyBuild(hash, accessKey.type, accessKey.resources)
                        }
                        res.status(200).json(apiKey)
                    }
                    else {
                        res.status(500).json({})
                        console.log('No accessKey type present')
                    }
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })

        this.route.route('/:key')
            .all( async (req:Request,res:Response, next) => {
                if (! (await AuthorizationManagement.validKey(req,res, this))) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                let storedKeys=await configMaps.read('kwirth.keys', []) as ApiKey[]
                let key=storedKeys.filter(apiKey => apiKey.accessKey.id===req.params.key)
                if (key.length>0)
                    res.status(200).json(key[0])
                else
                    res.status(404).json({})
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
            .delete( async (req:Request, res:Response) => {
                try {
                    // remove api key from permanent store (if exists)
                    let storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                    storedKeys = AuthorizationManagement.cleanApiKeys(storedKeys)
                    storedKeys=storedKeys.filter(apiKey => apiKey.accessKey.id!==req.params.key)
                    await configMaps.write('kwirth.keys', storedKeys )
                    ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type === 'volatile'), ...storedKeys]
                    res.status(200).json({})
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
            .put( async (req:Request, res:Response) => {
                try {
                    let key=req.body as ApiKey;
                    let storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                    storedKeys = AuthorizationManagement.cleanApiKeys(storedKeys)
                    storedKeys = storedKeys.filter(k => k.accessKey.id!==key.accessKey.id)
                    storedKeys.push(key)
                    await configMaps.write('kwirth.keys',storedKeys)
                    ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type === 'volatile'), ...storedKeys]

                    res.status(200).json({})
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
    }

    refreshKeys = async () : Promise<void> => {
        let storedKeys = await this.configMaps.read('kwirth.keys', [])
        storedKeys = AuthorizationManagement.cleanApiKeys(storedKeys)
        await this.configMaps.write('kwirth.keys', storedKeys )
        ApiKeyApi.apiKeys = storedKeys
    }
    
}
