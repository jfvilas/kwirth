import express, { Request, Response} from 'express'
import { ConfigMaps } from '../tools/ConfigMaps'
import { ApiKey } from '@jfvilas/kwirth-common'
import { cleanApiKeys, validKey } from '../tools/AuthorizationManagement'
import { AccessKey, accessKeyCreate, accessKeySerialize } from '@jfvilas/kwirth-common'

export class ApiKeyApi {
    configMaps:ConfigMaps;
    public static apiKeys:ApiKey[]=[]
    public route = express.Router()

    constructor (configMaps:ConfigMaps) {
        this.configMaps = configMaps

        configMaps.read('kwirth.keys',[]).then( result => {
            if (result) result=cleanApiKeys(result)
            ApiKeyApi.apiKeys=result
        });

        this.route.route('/')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return
                next()
            })
            .get( async (req:Request,res:Response) => {
                var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                for (var apikey of ApiKeyApi.apiKeys)
                    if (!storedKeys.some(s => accessKeySerialize(s.accessKey)===accessKeySerialize(apikey.accessKey))) storedKeys.push(apikey)
                res.status(200).json(storedKeys);
            })
            .post( async (req:Request, res:Response) => {
                try {
                    /*
                        TYPE

                        VALUES
                        permanent
                        volatile
                    */
                    /*
                        RESOURCE

                        FORMAT:
                        scope:namespace:group:pod:container
                        
                        VALUES:
                        scope: cluster|api|filter|view|restart
                        namespace: name
                        group: {deployment|replica|daemon|stateful}+name   (type of pod group, a plus sign, name of the group)
                        pod: name
                        container: name

                        EXAMPLES:
                        cluster::::  // all the cluster logs
                        view:default:::  // view all logs in 'default' namespace
                        restart::deployment+kwirth::  // restart deployment 'kwirth' in all namespaces
                        restart:default:replica+abcd::  // restart all pods in 'abcd' replicaset inside namespace 'default'
                        view:default:replica+abcd:abcd:  // view all pod logs with name 'abcd' inside namespace 'default'
                        filter:pre,dev::pod1:  // search pod named 'pod1' in namespaces 'pre' and 'dev'
                        filter:::pod2:  // search for all instances of 'pod2' (any namespace)
                        filter::replica+rs1::  // all pods of replicaset 'rs1' in any namespace
                        filter:default:replica+rs1::cont1  // 'container1' on replicaset 'rs1' on namespace 'default'
                    */
                    var type=req.body.type.toLowerCase()  // volatile or permanent
                    var resource=req.body.resource.toLowerCase()  // optional (mandatory if type is 'resource')
                    var description=req.body.description
                    var expire=req.body.expire
                    var accessKey:AccessKey=accessKeyCreate(type, resource)
                    var keyObject:ApiKey={ accessKey, description, expire }

                    if (type==='permanent') {
                        var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                        storedKeys=cleanApiKeys(storedKeys)
                        storedKeys.push(keyObject)
                        await configMaps.write('kwirth.keys',storedKeys)
                        ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type==='volatile'), ...storedKeys]
                    }
                    else {
                        ApiKeyApi.apiKeys.push(keyObject)
                    }

                    res.status(200).json(keyObject)
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                    }
                });

        this.route.route('/:key')
            .all( async (req,res, next) => {
                if (!validKey(req,res)) return
                next()
            })
            .get( async (req:Request, res:Response) => {
                try {
                var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                var key=storedKeys.filter(apiKey => apiKey.accessKey.id===req.params.key)
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
                    var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                    storedKeys=cleanApiKeys(storedKeys)
                    storedKeys=storedKeys.filter(apiKey => apiKey.accessKey.id!==req.params.key)
                    await configMaps.write('kwirth.keys', storedKeys )
                    ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type==='volatile'), ...storedKeys]
                    res.status(200).json({})
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
            .put( async (req:Request, res:Response) => {
                try {
                    var key=req.body as ApiKey;
                    var storedKeys=await configMaps.read('kwirth.keys',[]) as ApiKey[]
                    storedKeys=cleanApiKeys(storedKeys)
                    storedKeys=storedKeys.filter(k => k.accessKey.id!==key.accessKey.id)
                    storedKeys.push(key)
                    await configMaps.write('kwirth.keys',storedKeys)
                    ApiKeyApi.apiKeys=[...ApiKeyApi.apiKeys.filter(a => a.accessKey.type==='volatile'), ...storedKeys]

                    res.status(200).json({})
                }
                catch (err) {
                    res.status(500).json({})
                    console.log(err)
                }
            })
    }
}
