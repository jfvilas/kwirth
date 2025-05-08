import { ApiKeyApi } from '../api/ApiKeyApi'
import { AccessKey, accessKeyDeserialize, accessKeySerialize, InstanceConfig, InstanceMessageChannelEnum, parseResource, parseResources } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import * as crypto from 'crypto'
import { IChannel } from '../channels/IChannel'
import { Request, Response } from 'express'
import { AppsV1Api, CoreV1Api, V1Pod } from '@kubernetes/client-node'
import { access } from 'fs'

export class AuthorizationManagement {
    public static cleanApiKeys = (apiKeys:ApiKey[]) => {
        apiKeys=apiKeys.filter(a => a.expire >= Date.now())
        return apiKeys
    }    

    public static validBearerKey = (masterKey:string, accessKey:AccessKey): boolean => {
        let expire = accessKey.type.split(':')[1]
        let input = masterKey + '|' + accessKey.resources + '|' + expire
        var hash = crypto.createHash('md5').update(input).digest('hex')
        return hash === accessKey.id
    }
    
    public static validKey = async (req:Request,res:Response, apiKeyApi: ApiKeyApi): Promise<boolean> => {
        if (req.headers.authorization) {
            var receivedAccessString = req.headers.authorization.replaceAll('Bearer ','').trim()
            var receivedAccessKey = accessKeyDeserialize(receivedAccessString)
            let computedExpire = 0
            if (receivedAccessKey.type && receivedAccessKey.type.startsWith('bearer:')) {
                if (!AuthorizationManagement.validBearerKey(apiKeyApi.masterKey, receivedAccessKey))
                    console.log('Hashes do not match')            
                else
                    computedExpire = +receivedAccessKey.type.split(':')[1]
            }
            else {
                var key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                if (!key) {
                    await apiKeyApi.refreshKeys()
                    key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                    if (!key) {
                        console.log('Inexistent key: '+receivedAccessString)
                        res.status(403).json()
                        return false
                    }            
                }
                else {
                    computedExpire = key.expire
                }
            }
            if (computedExpire>0) {
                if (computedExpire<Date.now())
                    console.log('Expired key: '+receivedAccessString)
                else
                    return true
            }
            res.status(403).json()
            return false
        }
        else {
            console.log('No valid key present in headers')
            res.status(403).json()
            return false
        }
    }
    
    public static getKey = async (req:Request,res:Response, apiKeyApi: ApiKeyApi): Promise<AccessKey|undefined> => {
        if (req.headers.authorization) {
            var receivedAccessString = req.headers.authorization.replaceAll('Bearer ','').trim()
            var receivedAccessKey = accessKeyDeserialize(receivedAccessString)
            let computedExpire = 0
            if (receivedAccessKey.type && receivedAccessKey.type.startsWith('bearer:')) {
                if (!AuthorizationManagement.validBearerKey(apiKeyApi.masterKey, receivedAccessKey))
                    console.log('Hashes do not match')            
                else
                    computedExpire = +receivedAccessKey.type.split(':')[1]
            }
            else {
                var key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                if (!key) {
                    await apiKeyApi.refreshKeys()
                    key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                    if (!key) {
                        console.log('Inexistent key: '+receivedAccessString)
                        res.status(403).json()
                        return undefined
                    }            
                }
                else {
                    computedExpire = key.expire
                }
            }
            if (computedExpire>0) {
                if (computedExpire<Date.now())
                    console.log('Expired key: '+receivedAccessString)
                else
                    return receivedAccessKey
            }
            res.status(403).json()
            return undefined
        }
        else {
            console.log('No valid key present in headers')
            res.status(403).json()
            return undefined
        }
    }
    
    public static getScopeLevel = (channels:Map<string, IChannel>, instanceConfigChannel:string, scopes:string, def:number): number => {
        let higherScope = -1
        if (channels.has(instanceConfigChannel)) {
            // we return the higher scope from all valid scopes
            for (let sc of scopes.split(',')) {
                let scLevel = channels.get(instanceConfigChannel)!.getChannelScopeLevel(sc)
                if (scLevel<0) console.log(`***************** Inexistent scope ${sc} on channel ${instanceConfigChannel} *****************`)
                if (scLevel>higherScope) higherScope = scLevel
            }
        }
        if (higherScope<0) higherScope = def
        return higherScope
    }
    
    public static validAuth = (req:Request, res:Response, channels:Map<string, IChannel>, reqScope:string, instanceConfig: InstanceConfig, namespace:string, group:string, pod:string, container:string): boolean => {
        if (!req.headers.authorization) return false
        
        let key = req.headers.authorization.replaceAll('Bearer ','').trim()
        let accessKey = accessKeyDeserialize(key)
        let resId = parseResource(accessKey.resources)
    
        if (resId.scopes === 'cluster') return true
        
        let haveLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, resId.scopes, Number.MIN_VALUE)
        let requestedLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, instanceConfig.scope, Number.MAX_VALUE)
        if (haveLevel < requestedLevel) {
            console.log('Insufficient scope level')
            return false
        }
        if ((namespace !== '') && (namespace !== resId.namespaces)) {
            console.log('Insufficient namespace capabilities')
            return false
        }
        if ((group !== '') && (group !== resId.groups)) {
            console.log('Insufficient group capabilities')
            return false
        }
        if ((pod !== '') && (pod !== resId.pods)) {
            console.log('Insufficient pod capabilities')
            return false
        }
        if ((container !== '') && (container !== resId.containers)) {
            console.log('Insufficient container capabilities')
            return false
        }
        console.log('Authorized!')
        return true
    }
    
    public static getValidValues = (values:string[], regexes:string[]) => {
        let result:string[] = []
        for (let value of values) {
            if (regexes.some(r => new RegExp(r).test(value))) result.push(value)
        }
        result = [...new Set(result)]
        return result
    }

    public static getAllowedNamespaces = async (coreApi:CoreV1Api, accessKey:AccessKey): Promise<string[]> => {
        let resources = parseResources(accessKey.resources)
        let response = await coreApi.listNamespace()
        let clusterNamespaces = response.body.items.map (n => n!.metadata!.name!)
        let result:string[] = []

        for (let resid of resources) {
            result.push (...AuthorizationManagement.getValidValues(clusterNamespaces, resid.namespaces.split(',')))
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getValidNamespaces = async (coreApi: CoreV1Api, accessKey:AccessKey, requestedNamespaces:string[]): Promise<string[]> => {
        let result:string[] = []

        let allowedNamespaces = await this.getAllowedNamespaces(coreApi, accessKey)
        console.log('allowedNamespaces', allowedNamespaces)
        console.log('requestedNamespaces', requestedNamespaces)
        if (requestedNamespaces.length === 0 || (requestedNamespaces.length === 1 && requestedNamespaces[0]==='')) {
            result.push(...allowedNamespaces)
        }
        else {
            let x = this.getValidValues(allowedNamespaces, requestedNamespaces.map(ns => '^'+ns+'$'))
            result.push(...x)
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getGroupNames = async (appsApi:AppsV1Api, namespace:string, gtype:string): Promise<string[]> => {
        let result:string[] = []
    
        let groupNames:string[]
        switch (gtype) {
            case 'deployment':
                groupNames = (await appsApi.listNamespacedDeployment(namespace)).body.items.map (n => n?.metadata?.name!)
                result.push( ...groupNames)
                break
            case 'replicaset':
                groupNames = (await appsApi.listNamespacedReplicaSet(namespace)).body.items.filter(r => r.status?.replicas!>0).map (n => n?.metadata?.name!)
                result.push( ...groupNames)
                break
            case 'daemonset':
                groupNames = (await appsApi.listNamespacedDaemonSet(namespace)).body.items.map (n => n?.metadata?.name!)
                result.push( ...groupNames)
                break
            case 'statefulset':
                groupNames = (await appsApi.listNamespacedStatefulSet(namespace)).body.items.filter(r => r.status?.replicas!>0).map (n => n?.metadata?.name!)
                result.push( ...groupNames)
                break
        }
        result = [ ...new Set(result)]
        return result
    }
    
    public static getAllowedGroups = async (appsApi:AppsV1Api, namespace:string, accessKey:AccessKey): Promise<{[name:string]:any}[]> => {
        let resources = parseResources(accessKey!.resources)
        let result:{[name:string]:any}[] = []
    
        for (let gtype of ['deployment','replicaset','daemonset','statefulset']) {
            let glist = await AuthorizationManagement.getGroupNames(appsApi, namespace, gtype)
    
            // we prune glist according to resources and namespaces
            for (let resource of resources) {
                if (resource.groups !== '' && AuthorizationManagement.getValidValues([namespace], resource.namespaces.split(',')).length>0) {
                    let regexes = resource.groups.split(',').filter(g => g.startsWith(gtype)).map(g => g.split('+')[1])
                    glist = [ ...new Set(AuthorizationManagement.getValidValues(glist, regexes)) ]
                }
            }
            result.push (...glist.map (gname => { return { name:gname, type:gtype}}))
        }
        result = [...new Set(result)]
        return result
    }

    public static getValidGroups = async (appsApi: AppsV1Api, accessKey:AccessKey, namespaces:string[], requestedGroups:string[]): Promise<string[]> => {
        let result:string[] = []
        let allowedGroups:string[] =  []

        for (let ns of namespaces) {
            let x:{[name:string]:any}[] = await this.getAllowedGroups(appsApi,ns, accessKey)
            let y = x.map(g => g.type+'+'+g.name)
            allowedGroups.push(...y)
        }

        console.log('allowedGroups', allowedGroups)
        console.log('requestedGroups', requestedGroups)
        if (requestedGroups.length === 0 || (requestedGroups.length === 1 && requestedGroups[0]==='')) {
            result.push(...allowedGroups)
        }
        else {
            let x = this.getValidValues(allowedGroups, requestedGroups.map(g => '^'+g.replaceAll('+','\\+')+'$'))
            result.push(...x)
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getPodsFromGroup = async (coreApi: CoreV1Api, appsApi: AppsV1Api, namespace:string, gtype:string, gname:string, accessKey:AccessKey): Promise<string[]> => {
        let pods:V1Pod[] = []
        let result:string[]=[]
    
        let resources = parseResources(accessKey!.resources)
        let response= await coreApi.listNamespacedPod(namespace)
        if (gtype === 'deployment') {
            for (let pod of response.body.items) {
                let owner = pod.metadata?.ownerReferences?.[0]
                if (owner) {
                    let rs = (await appsApi.readNamespacedReplicaSet(owner.name, namespace)).body
                    const rsOwner = rs.metadata?.ownerReferences?.[0]
                    if (rsOwner && rsOwner.kind === 'Deployment' && rsOwner.name === gname) pods.push(pod)
                }
            }
        }
        else {
            pods = response.body.items.filter (n => n?.metadata?.ownerReferences![0].name===gname).filter(p => p.status?.phase?.toLowerCase()==='running')
        }
    
        for (let pod of pods) {
            for (let resid of resources) {
                // for each resourceid, we first check if namespace is right
                if (AuthorizationManagement.getValidValues([pod.metadata!.namespace!], resid.namespaces.split(',')).length>0) {
                    result.push(pod.metadata?.name!)
                }
            }
        }
        result = [...new Set(result)]
        return result
    }
    
    private static getAllowedPods = async (coreApi: CoreV1Api, namespace:string, accessKey:AccessKey): Promise<string[]> => {
        let pods:V1Pod[] = []
        let result:string[]=[]
    
        let resources = parseResources(accessKey!.resources)
        let response = await coreApi.listNamespacedPod(namespace)
        pods = response.body.items
    
        for (let pod of pods) {
            for (let resid of resources) {
                // for each resourceid, we first check if namespace is right (namespace of resource must match with pod namespace ofr th eresource to be usable)
                if (AuthorizationManagement.getValidValues([pod.metadata!.namespace!], resid.namespaces.split(',')).length>0) {
                    result.push(pod.metadata?.name!)
                }
            }
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getValidPods = async (coreApi: CoreV1Api, namespaces:string[], accessKey:AccessKey, requestedPods:string[]): Promise<string[]> => {
        let result:string[]=[]
        let allowedPods = []

        for (let ns of namespaces) {
            allowedPods.push (...await this.getAllowedPods(coreApi, ns, accessKey))
        }

        console.log('allowedPods', allowedPods)
        console.log('requestedPods', requestedPods)
        if (requestedPods.length === 0 || (requestedPods.length === 1 && requestedPods[0]==='')) {
            result.push(...allowedPods)
        }
        else {
            let x = this.getValidValues(allowedPods, requestedPods.map(pod => '^'+pod+'$'))
            result.push(...x)
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getContainers = async (coreApi:CoreV1Api, namespace:string, pod:string, accessKey:AccessKey): Promise<string[]> => {
        let resources = parseResources(accessKey.resources)
        let searchPod = (await coreApi.readNamespacedPod(pod, namespace)).body
        if (!searchPod) return []
    
        let containers = searchPod.spec?.containers.map(c => c.name)
        if (!containers) return []
    
        let result:string[] = []
        for (let resource of resources) {
            if (AuthorizationManagement.getValidValues(searchPod.metadata!.namespace!.split(','), resource.namespaces.split(',')).length>0) {
                let conts = AuthorizationManagement.getValidValues(containers, resource.containers.split(','))
                result.push(...conts)
            }
        }
        result = [...new Set(result)]
        return result
    }

    public static getAllowedContainers = async (coreApi:CoreV1Api, accessKey:AccessKey, namespace:string, pod:string): Promise<string[]> => {
        let result:string[] = []    
        let resources = parseResources(accessKey!.resources)

        console.log('cont ****************')
        let x = (await coreApi.readNamespacedPod(pod, namespace)).body
        if (!x.spec) return result
    

        console.log('namespace',namespace)
        console.log('pod',pod)
        for (let cont of x.spec.containers) {
            for (let resid of resources) {
                console.log('contname', cont.name)
                console.log('resid.containers.split',resid.containers.split(','))
                // we check if the resource is applicable to the container we are evaluating (namespace and pod of the resource must match)
                if (AuthorizationManagement.getValidValues([x.metadata!.namespace!], resid.namespaces.split(',')).length>0) {
                    if (AuthorizationManagement.getValidValues([x.metadata!.name!], resid.pods.split(',')).length>0) {
                        let xx = AuthorizationManagement.getValidValues([cont.name], resid.containers.split(','))
                        result.push(...xx)
                    }
                }
            }
        }
        console.log('allcont', result)
        result = [...new Set(result)]
        return result
    }

    public static getValidContainers = async (coreApi:CoreV1Api, accessKey:AccessKey, namespaces:string[], pods:string[], requestedContainers:string[]): Promise<string[]> => {
        let result:string[] = []
        let allowedContainers = []

        console.log('requestedContainers', requestedContainers)
        for (let ns of namespaces) {
            let pods = (await coreApi.listNamespacedPod(ns)).body.items
            for (let pod of pods) {
                let x = await this.getAllowedContainers(coreApi, accessKey, ns, pod.metadata?.name!)
                allowedContainers.push(...x.map(c => pod.metadata?.name+ '+' + c))
            }
        }
        console.log('allowedcon', allowedContainers)
        console.log('reqdcon', requestedContainers)

        if (requestedContainers.length === 0 || (requestedContainers.length === 1 && requestedContainers[0]==='')) {
            result.push(...allowedContainers)
        }
        else {
            let x = this.getValidValues(allowedContainers, requestedContainers.map(g => '^'+g.replaceAll('+','\\+')+'$'))
            result.push(...x)
        }
        console.log('result', result)
        result = [...new Set(result)]
        return result
    }

}

