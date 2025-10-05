import { ApiKeyApi } from '../api/ApiKeyApi'
import { AccessKey, accessKeyDeserialize, accessKeySerialize, InstanceConfig, parseResource, parseResources, ResourceIdentifier } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import * as crypto from 'crypto'
import { IChannel } from '../channels/IChannel'
import { Request, Response } from 'express'
import { AppsV1Api, CoreV1Api, V1Pod } from '@kubernetes/client-node'

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
                if (!AuthorizationManagement.validBearerKey(apiKeyApi.masterKey, receivedAccessKey)) {
                    res.status(403).json()
                    console.log('Hashes do not match validating key')
                    return false
                }
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
                if (!AuthorizationManagement.validBearerKey(apiKeyApi.masterKey, receivedAccessKey)) {
                    console.log('Hashes do not match getting key')
                    return undefined
                }
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

    public static checkResource = (resource:ResourceIdentifier, podNamespace:string, podName:string, containerName:string) => {
       if (resource.namespaces !== '') {
            let x = AuthorizationManagement.getValidValues([podNamespace], resource.namespaces.split(','))
            if (x.length===0) return false
        }
        if (resource.groups !== '') {
            //+++
        }
        if (resource.pods !== '') {
            let x = AuthorizationManagement.getValidValues([podName], resource.pods.split(','))
            if (x.length===0) return false
        }
        if (resource.containers !== '') {
            let x = AuthorizationManagement.getValidValues([containerName], resource.containers.split(','))
            if (x.length===0) return false
        }
        return true
    }

    public static checkAkr = (channels:Map<string, IChannel>, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) => {
        let accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resources)
        let valid=false
        console.log('checkAkr')
        for (let akr of accessKeyResources) {
            let haveLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, akr.scopes, Number.MIN_VALUE)
            let requestedLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, instanceConfig.scope, Number.MAX_VALUE)
            if (haveLevel<requestedLevel) {
                console.log(`Insufficent level '${akr.scopes}' (${haveLevel}) < '${instanceConfig.scope}' (${requestedLevel}) for object`)
                continue
            }
            console.log(`Level is enough for object: '${akr.scopes}'(${haveLevel}) >= '${instanceConfig.scope}' (${requestedLevel}),  let's check regexes...`)

            if (!this.checkResource(akr, podNamespace, podName, containerName)) continue

            valid = true
            console.log(`Found AKR: ${JSON.stringify(akr)}`)
            break
        }
        return valid
    }



    // public static checkAkr = (channels:Map<string, IChannel>, instanceConfig:InstanceConfig, podNamespace:string, podName:string, containerName:string) => {
    //     let accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resources)
    //     let valid=false
    //     console.log('checkAkr')
    //     for (let akr of accessKeyResources) {
    //         let haveLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, akr.scopes, Number.MIN_VALUE)
    //         let requestedLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, instanceConfig.scope, Number.MAX_VALUE)
    //         if (haveLevel<requestedLevel) {
    //             console.log(`Insufficent level ${akr.scopes}(${haveLevel}) < ${instanceConfig.scope} (${requestedLevel}) for object`)
    //             continue
    //         }
    //         console.log(`Level is enough for object: ${akr.scopes}(${haveLevel}) >= ${instanceConfig.scope} (${requestedLevel}),  let's check regexes...`)

    //         if (akr.namespaces !== '') {
    //             let x = AuthorizationManagement.getValidValues([podNamespace], akr.namespaces.split(','))
    //             if (x.length===0) continue
    //         }
    //         if (akr.groups !== '') {
    //             //+ ++
    //         }
    //         if (akr.pods !== '') {
    //             let x = AuthorizationManagement.getValidValues([podName], akr.pods.split(','))
    //             if (x.length===0) continue
    //         }
    //         if (akr.containers !== '') {
    //             let x = AuthorizationManagement.getValidValues([containerName], akr.containers.split(','))
    //             if (x.length===0) continue
    //         }
    //         valid = true
    //         console.log(`Found AKR: ${JSON.stringify(akr)}`)
    //         break
    //     }
    //     return valid
    // }


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
        try {
            for (let value of values) {
                if (regexes.some(r => new RegExp(r).test(value))) result.push(value)
            }
            result = [...new Set(result)]
            return result
        }
        catch (err) {
            console.log('getValidValues error', err)
            return []
        }
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
                    let resGroups = resource.groups.split(',').filter(g => g.startsWith(gtype+'+'))
                    if (resGroups.length!==0) {
                        let regexes = resGroups.map(g => g.split('+')[1])
                        glist = [ ...new Set(AuthorizationManagement.getValidValues(glist, regexes)) ]
                    }
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
    
    static readReplicaSet = async (appsApi: AppsV1Api, namespace:string, name:string) => {
        try {
            let rs = (await appsApi.readNamespacedReplicaSet(name, namespace)).body
            return rs
        }
        catch (err) {
            return undefined
        }
    }

    public static getPodsFromGroup = async (coreApi: CoreV1Api, appsApi: AppsV1Api, namespace:string, gtype:string, gname:string, accessKey:AccessKey): Promise<string[]> => {
        let pods:V1Pod[] = []
        let result:string[]=[]
    
        let resources = parseResources(accessKey!.resources)
        let response= await coreApi.listNamespacedPod(namespace)
        if (gtype === 'deployment') {
            for (let pod of response.body.items) {
                let controllerName = await this.getPodControllerName(appsApi, pod, true)
                if (controllerName === gname || pod.metadata?.name?.startsWith(gname)) pods.push(pod)
            }
        }
        else {
            // we find for pod whose controller is gname
            let filteredPods = response.body.items.filter (pod => {
                let podController  = pod?.metadata?.ownerReferences?.find(cont => cont.controller)
                if (podController && podController.name===gname) return pod
            })
            // we then filter for running pods
            filteredPods = filteredPods.filter(p => p.status?.phase?.toLowerCase()==='running')
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
    
    public static getPodLabelSelectorsFromGroup = async (coreApi:CoreV1Api, appsApi:AppsV1Api, namespace:string, gTypeName:string) => {
        let response:any
        let groupName, groupType
        let emptyResult = { pods:[],labelSelector:'' };
        [groupType, groupName] = gTypeName.toLowerCase().split('+')
    
        try {
            switch (groupType) {
                case 'deployment': {
                        let x = await appsApi.listNamespacedDeployment(namespace)
                        let names = x.body.items.map (rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedDeployment(groupName, namespace)
                    }
                    break
                case'replicaset': {
                        let x = await appsApi.listNamespacedReplicaSet(namespace)
                        let names = x.body.items.map (rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedReplicaSet(groupName, namespace)
                    }
                    break
                case'daemonset': {
                        let x = await appsApi.listNamespacedDaemonSet(namespace)
                        let names = x.body.items.map (rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedDaemonSet(groupName, namespace)
                    }
                    break
                case'statefulset': {
                        let x = await appsApi.listNamespacedStatefulSet(namespace)
                        let names = x.body.items.map (rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedStatefulSet(groupName, namespace)
                    }
                    break
            }    
        }
        catch (error) {
            console.log('Error reading namespaced group: ', error)
            return emptyResult
        }
    
        const matchLabels = response.body.spec?.selector.matchLabels
        const labelSelector = Object.entries(matchLabels || {}).map(([key, value]) => `${key}=${value}`).join(',')
        const pods = (await coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)).body.items
        return  { pods, labelSelector }
    }

    // gets controller name including (or not) deployment (aside form replica, daemon and stateful)
    static getPodControllerName = async (appsApi:AppsV1Api, pod:V1Pod, includeDeployment:boolean): Promise<string|undefined> => {
        if (!pod || !pod.metadata || !pod.metadata.namespace || !pod.metadata.ownerReferences) return
        let controller = pod.metadata.ownerReferences.find(or => or.controller)
        if (controller) {
            if (!includeDeployment || controller.kind !== 'ReplicaSet') return controller.name

            let rs = await AuthorizationManagement.readReplicaSet(appsApi, pod.metadata.namespace, controller.name)
            if (rs?.metadata?.ownerReferences) {
                let rsController = rs.metadata?.ownerReferences.find(rsor => rsor.controller)
                if (rsController && rsController.kind === 'Deployment') return rsController.name
            }
            else {
                return controller.name
            }
        }
    }

    public static getAllowedPods = async (coreApi: CoreV1Api, appsApi:AppsV1Api, namespace:string, group:string, accessKey:AccessKey): Promise<string[]> => {
        let pods:V1Pod[] = []
        let result:string[]=[]
    
        let resources = parseResources(accessKey!.resources)
        let response = await coreApi.listNamespacedPod(namespace)
        pods = response.body.items
    
        for (let pod of pods) {
            for (let resource of resources) {
                if (!pod.metadata?.name || !pod.metadata.namespace) continue

                if (AuthorizationManagement.getValidValues([pod.metadata.namespace], resource.namespaces.split(',')).length>0) {
                    let validPodNames = AuthorizationManagement.getValidValues([pod.metadata.name], resource.pods.split(','))
                    if (validPodNames.includes(pod.metadata.name)) {
                        if (group==='') {
                            result.push(pod.metadata.name)
                        }
                        else {
                            if (pod.metadata.ownerReferences) {
                                let controllerName = await this.getPodControllerName(appsApi, pod, true)
                                if (controllerName === group || pod.metadata.name.startsWith(group)) result.push(pod.metadata.name)
                            }
                        }
                    }
                }
            }
        }
        result = [...new Set(result)]
        return result
    }
    
    public static getValidPods = async (coreApi: CoreV1Api, appsApi:AppsV1Api, namespaces:string[], accessKey:AccessKey, requestedPods:string[]): Promise<string[]> => {
        let result:string[]=[]
        let allowedPods = []

        for (let ns of namespaces) {
            allowedPods.push (...await this.getAllowedPods(coreApi, appsApi, ns, '', accessKey))
        }
        console.log('allowedPods')
        console.log(allowedPods)
        console.log('reqpod')
        console.log(requestedPods)

        if (requestedPods.length === 0 || (requestedPods.length === 1 && requestedPods[0]==='')) {
            result.push(...allowedPods)
        }
        else {
            console.log('calculate gvv')
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

        let x = (await coreApi.readNamespacedPod(pod, namespace)).body
        if (!x.spec) return result
    
        for (let cont of x.spec.containers) {
            for (let resid of resources) {
                // we check if the resource is applicable to the container we are evaluating (namespace and pod of the resource must match)
                if (AuthorizationManagement.getValidValues([x.metadata!.namespace!], resid.namespaces.split(',')).length>0) {
                    if (AuthorizationManagement.getValidValues([x.metadata!.name!], resid.pods.split(',')).length>0) {
                        let xx = AuthorizationManagement.getValidValues([cont.name], resid.containers.split(','))
                        result.push(...xx)
                    }
                }
            }
        }
        result = [...new Set(result)]
        return result
    }

    public static getValidContainers = async (coreApi:CoreV1Api, accessKey:AccessKey, namespaces:string[], pods:string[], requestedContainers:string[]): Promise<string[]> => {
        let result:string[] = []
        let allowedContainers = []

        for (let ns of namespaces) {
            let pods = (await coreApi.listNamespacedPod(ns)).body.items
            for (let pod of pods) {
                let x = await this.getAllowedContainers(coreApi, accessKey, ns, pod.metadata?.name!)
                allowedContainers.push(...x.map(c => pod.metadata?.name+ '+' + c))
            }
        }

        if (requestedContainers.length === 0 || (requestedContainers.length === 1 && requestedContainers[0]==='')) {
            result.push(...allowedContainers)
        }
        else {
            let x = this.getValidValues(allowedContainers, requestedContainers.map(g => '^'+g.replaceAll('+','\\+')+'$'))
            result.push(...x)
        }
        result = [...new Set(result)]
        return result
    }
}
