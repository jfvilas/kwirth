import { ApiKeyApi } from '../api/ApiKeyApi'
import { AccessKey, accessKeyDeserialize, accessKeySerialize, IInstanceConfig, parseResource, parseResources, ResourceIdentifier } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import * as crypto from 'crypto'
import { IChannel } from '../channels/IChannel'
import { Request, Response } from 'express'
import { AppsV1Api, BatchV1Api, CoreV1Api, V1Pod } from '@kubernetes/client-node'

export class AuthorizationManagement {
    
    public static cleanApiKeys = (apiKeys:ApiKey[]) => {
        if (!apiKeys) return []
        apiKeys = apiKeys.filter(a => a.expire >= Date.now())
        return apiKeys
    }    

    public static validBearerKey = (masterKey:string, accessKey:AccessKey): boolean => {
        let expire = accessKey.type.split(':')[1]
        let input = masterKey + '|' + accessKey.resources + '|' + expire
        var hash = crypto.createHash('md5').update(input).digest('hex')
        return hash === accessKey.id
    }
    
    public static validKey = async (req:Request,res:Response, apiKeyApi: ApiKeyApi): Promise<boolean> => {
        try {
            if (req.headers.authorization) {
                var receivedAccessKeyStr = req.headers.authorization.replaceAll('Bearer ','').trim()
                var receivedAccessKey = accessKeyDeserialize(receivedAccessKeyStr)
                let computedExpire = 0
                if (receivedAccessKey.type && receivedAccessKey.type.startsWith('bearer:')) {
                    if (!AuthorizationManagement.validBearerKey(apiKeyApi.masterKey, receivedAccessKey)) {
                        res.status(403).json({})
                        console.log('Hashes do not match validating key')
                        return false
                    }
                    else
                        computedExpire = +receivedAccessKey.type.split(':')[1]
                }
                else {
                    let key = apiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessKeyStr)
                    if (!key) {
                        if (!apiKeyApi.isElectron) await apiKeyApi.refreshKeys()
                        key = apiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessKeyStr)
                        if (!key) {
                            console.log('Inexistent key on validKey: '+receivedAccessKeyStr)
                            res.status(403).json({})
                            return false
                        }            
                    }
                    else {
                        computedExpire = key.expire
                    }
                }
                if (computedExpire>0) {
                    if (computedExpire>=Date.now())
                        return true
                    else
                        console.log('Expired key: '+receivedAccessKeyStr)
                }
            }
            else {
                console.log('No valid key present in headers')
            }
        }
        catch (err) {
            console.log('Error validating Key', err)
        }
        res.status(403).json({})
        return false
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
                var key = apiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                if (!key) {
                    if (!apiKeyApi.isElectron) await apiKeyApi.refreshKeys()
                    key = apiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                    if (!key) {
                        console.log('Inexistent key on getKey: '+receivedAccessString)
                        res.status(403).json({})
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
            res.status(403).json({})
            return undefined
        }
        else {
            console.log('No valid key present in headers')
            res.status(403).json({})
            return undefined
        }
    }
    
    public static getScopeLevel = (channels:Map<string, IChannel>, instanceConfigChannel:string, scopes:string, def:number): number => {
        let higherScope = -1
        if (channels.has(instanceConfigChannel)) {
            // we return the higher scope from all valid scopes
            for (let sc of scopes.split(',')) {
                let scLevel = channels.get(instanceConfigChannel)!.getChannelScopeLevel(sc)
                if (scLevel<0) console.log(`***************** Inexistent scope '${sc}' on channel '${instanceConfigChannel}' *****************`)
                if (scLevel>higherScope) higherScope = scLevel
            }
        }
        if (higherScope<0) higherScope = def
        return higherScope
    }

    public static checkResource = (resource:ResourceIdentifier, podNamespace:string, podName:string, containerName:string): boolean => {
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

    public static checkAkr = (channels:Map<string, IChannel>, instanceConfig:IInstanceConfig, podNamespace:string, podName:string, containerName:string): boolean => {
        let accessKeyResources = parseResources(accessKeyDeserialize(instanceConfig.accessKey).resources)
        let valid=false
        for (let akr of accessKeyResources) {
            let haveLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, akr.scopes, Number.MIN_VALUE)
            let requestedLevel = AuthorizationManagement.getScopeLevel(channels, instanceConfig.channel, instanceConfig.scope, Number.MAX_VALUE)
            if (haveLevel<requestedLevel) {
                console.log(`Insufficent level '${akr.scopes}' (${haveLevel}) < '${instanceConfig.scope}' (${requestedLevel}) for object`)
                continue
            }
            console.log(`Level is enough for object (${podNamespace}/${podName}/${containerName}): '${akr.scopes}'(${haveLevel}) >= '${instanceConfig.scope}' (${requestedLevel}),  let's check regexes...`)

            if (!this.checkResource(akr, podNamespace, podName, containerName)) continue

            valid = true
            console.log(`Found AKR: ${JSON.stringify(akr)}`)
            break
        }
        return valid
    }

    public static validAuth = (req:Request, res:Response, channels:Map<string, IChannel>, reqScope:string, instanceConfig: IInstanceConfig, namespace:string, group:string, pod:string, container:string): boolean => {
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
    
    public static getValidValues = (values:string[], regexes:string[]): string[] => {
        //if (this.isElectron) return values
        let result:string[] = []
        try {
            for (let value of values) {
                if (regexes.some(r => new RegExp(r).test(value))) result.push(value)
            }
            return [...new Set(result)]
        }
        catch (err) {
            console.log('getValidValues error', err)
            return []
        }
    }

    public static getAllowedNamespaces = async (coreApi:CoreV1Api, accessKey:AccessKey): Promise<string[]> => {
        try {
            let resources = parseResources(accessKey.resources)
            let response = await coreApi.listNamespace()
            let clusterNamespaces = response.items.map (ns => ns!.metadata!.name!)
            let result:string[] = []

            for (let resid of resources) {
                result.push (...AuthorizationManagement.getValidValues(clusterNamespaces, resid.namespaces.split(',')))
            }
            return [...new Set(result)]
        }
        catch (err) {
            console.log('Cannot list namespaces', err)
            return []
        }
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
    
    public static getControllerNames = async (coreApi:CoreV1Api, appsApi:AppsV1Api, batchApi: BatchV1Api, namespace:string, gtype:string): Promise<string[]> => {
        let result:string[] = []
    
        let groupNames:string[] = []
        switch (gtype) {
            case 'Deployment':
                groupNames = (await appsApi.listNamespacedDeployment({namespace})).items.map (n => n?.metadata?.name!)
                break
            case 'ReplicaSet':
                groupNames = (await appsApi.listNamespacedReplicaSet({namespace})).items.filter(rs => rs.status?.replicas!>0).map (n => n?.metadata?.name!)
                break
            case 'ReplicationController':
                groupNames = (await coreApi.listNamespacedReplicationController({namespace})).items.map (n => n?.metadata?.name!)
                break
            case 'DaemonSet':
                groupNames = (await appsApi.listNamespacedDaemonSet({namespace})).items.map (ds => ds?.metadata?.name!)
                break
            case 'StatefulSet':
                groupNames = (await appsApi.listNamespacedStatefulSet({namespace})).items.filter(ss => ss.status?.replicas!>0).map (n => n?.metadata?.name!)
                break
            case 'Job':
                console.log('job')
                groupNames = (await batchApi.listNamespacedJob({namespace})).items.map(j => j.metadata?.name!)       
                console.log(groupNames)
                break
        }
        result.push(...groupNames)        
        return [ ...new Set(result)]
    }
    
    public static getAllowedControllers = async (coreApi:CoreV1Api, appsApi:AppsV1Api, batchApi: BatchV1Api, namespace:string, accessKey:AccessKey): Promise<{[name:string]:any}[]> => {
        let resources = parseResources(accessKey!.resources)
        let result:{[name:string]:any}[] = []
    
        for (let gtype of ['Deployment','ReplicaSet','ReplicationController','DaemonSet','StatefulSet','Job']) {
            let glist = await AuthorizationManagement.getControllerNames(coreApi, appsApi, batchApi, namespace, gtype)

            // we prune glist according to resources and namespaces
            for (let resource of resources) {
                if (resource.groups !== '' && AuthorizationManagement.getValidValues([namespace], resource.namespaces.split(',')).length>0) {
                    let resControllers = resource.groups.split(',').filter(g => g.startsWith(gtype+'+'))
                    if (resControllers.length!==0) {
                        let regexes = resControllers.map(g => g.split('+')[1])
                        glist = [ ...new Set(AuthorizationManagement.getValidValues(glist, regexes)) ]
                    }
                }
            }
            result.push (...glist.map (gname => { return { name:gname, type:gtype } }))
        }
        return [...new Set(result)]
    }

    public static getValidControllers = async (coreApi: CoreV1Api, appsApi: AppsV1Api, batchApi:BatchV1Api, accessKey:AccessKey, namespaces:string[], requestedControllers:string[]): Promise<string[]> => {
        let result:string[] = []
        let allowedControllers:string[] =  []

        for (let ns of namespaces) {
            let x:{[name:string]:any}[] = await this.getAllowedControllers(coreApi, appsApi, batchApi, ns, accessKey)
            let y = x.map(g => g.type+'+'+g.name)
            allowedControllers.push(...y)
        }

        if (requestedControllers.length === 0 || (requestedControllers.length === 1 && requestedControllers[0]==='')) {
            result.push(...allowedControllers)
        }
        else {
            let x = this.getValidValues(allowedControllers, requestedControllers.map(g => '^'+g.replaceAll('+','\\+')+'$'))
            result.push(...x)
        }
        return [...new Set(result)]
    }
    
    static readReplicaSet = async (appsApi: AppsV1Api, namespace:string, name:string) => {
        try {
            let rs = (await appsApi.readNamespacedReplicaSet({name, namespace}))
            return rs
        }
        catch (err) {
            return undefined
        }
    }

    public static getPodsFromController = async (coreApi: CoreV1Api, appsApi: AppsV1Api, namespace:string, ctype:string, cname:string, accessKey:AccessKey): Promise<string[]> => {
        let pods:V1Pod[] = []
        let result:string[]=[]
    
        let resources = parseResources(accessKey!.resources)
        let response= await coreApi.listNamespacedPod({namespace})
        if (ctype === 'deployment') {
            for (let pod of response.items) {
                let controllerName = await this.getPodControllerName(appsApi, pod, true)
                if (controllerName === cname || pod.metadata?.name?.startsWith(cname)) pods.push(pod)
            }
        }
        else if (ctype === 'job') {
            for (let pod of response.items) {
                let controllerName = await this.getPodControllerName(appsApi, pod, true)
                if (controllerName === cname || pod.metadata?.name?.startsWith(cname)) pods.push(pod)
            }
        }
        else {
            // we find for pod whose controller is gname
            let filteredPods = response.items.filter (pod => {
                let podController  = pod?.metadata?.ownerReferences?.find(cont => cont.controller)
                if (podController && podController.name===cname) return pod
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
        return [...new Set(result)]
    }
    
    public static getPodLabelSelectorsFromController = async (coreApi:CoreV1Api, appsApi:AppsV1Api, batchApi: BatchV1Api, namespace:string, groupTypeName:string): Promise<{pods:V1Pod[],labelSelector:string}> => {
        let response:any
        let groupName, groupType
        let emptyResult = { pods:[] as V1Pod[],labelSelector:'' };
        [groupType, groupName] = groupTypeName.toLowerCase().split('+')
    
        try {
            switch (groupType) {
                case 'deployment': {
                        let x = await appsApi.listNamespacedDeployment({namespace})
                        let names = x.items.map (d => d.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedDeployment({ name: groupName, namespace: namespace })
                    }
                    break
                case'replicaset': {
                        let x = await appsApi.listNamespacedReplicaSet({namespace})
                        let names = x.items.map (rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedReplicaSet({ name: groupName, namespace: namespace })
                    }
                    break
                case'replicationcontroller': {
                        let x = (await coreApi.listNamespacedReplicationController({namespace}))
                        let names = x.items.map(rs => rs.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await coreApi.readNamespacedReplicationController({ name: groupName, namespace: namespace })
                    }
                    break
                case'daemonset': {
                        let x = await appsApi.listNamespacedDaemonSet({namespace})
                        let names = x.items.map (ds => ds.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedDaemonSet({ name: groupName, namespace: namespace })
                    }
                    break
                case'statefulset': {
                        let x = await appsApi.listNamespacedStatefulSet({namespace})
                        let names = x.items.map (ss => ss.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await appsApi.readNamespacedStatefulSet({ name: groupName, namespace: namespace })
                    }
                    break
                case'job': {
                        let x = await batchApi.listNamespacedJob({namespace})
                        let names = x.items.map (j => j.metadata?.name)
                        if (!names.includes(groupName)) return emptyResult
                        response = await batchApi.readNamespacedJob({ name: groupName, namespace: namespace })
                    }
                    break
            }    
        }
        catch (error) {
            console.log('Error reading namespaced group: ', error)
            return emptyResult
        }
    
        if (response) {
            const matchLabels = response.spec?.selector.matchLabels
            const labelSelector = Object.entries(matchLabels || {}).map(([key, value]) => `${key}=${value}`).join(',')
            const pods = (await coreApi.listNamespacedPod({namespace, labelSelector})).items
            return  { pods, labelSelector }
        }
        else {
            return { pods:[], labelSelector:'' }
        }
    }

    // gets controller name including (or not) deployment (aside form replica, daemon and stateful)
    static getPodControllerName = async (appsApi:AppsV1Api, pod:V1Pod, includeDeployment:boolean): Promise<string|undefined> => {
        if (!pod || !pod.metadata || !pod.metadata.namespace || !pod.metadata.ownerReferences) return
        let controller = pod.metadata.ownerReferences.find(or => or.controller)
        if (controller) {
            if (!includeDeployment || controller.kind !== 'ReplicaSet') return controller.name  // we return stateful, dameon & job

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
        let response = await coreApi.listNamespacedPod({namespace})
        pods = response.items
    
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
        return [...new Set(result)]
    }
    
    public static getValidPods = async (coreApi: CoreV1Api, appsApi:AppsV1Api, namespaces:string[], accessKey:AccessKey, requestedPods:string[]): Promise<string[]> => {
        let result:string[]=[]
        let allowedPods = []

        for (let ns of namespaces) {
            allowedPods.push (...await this.getAllowedPods(coreApi, appsApi, ns, '', accessKey))
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
        return [...new Set(result)]
    }
    
    public static getContainers = async (coreApi:CoreV1Api, namespace:string, pod:string, accessKey:AccessKey): Promise<string[]> => {
        let resources = parseResources(accessKey.resources)
        let searchPod = (await coreApi.readNamespacedPod({ name: pod, namespace: namespace }))
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
        return [...new Set(result)]
    }

    public static getAllowedContainers = async (coreApi:CoreV1Api, accessKey:AccessKey, namespace:string, pod:string): Promise<string[]> => {
        let result:string[] = []    
        let resources = parseResources(accessKey!.resources)

        try {
            let x = (await coreApi.readNamespacedPod({ name: pod, namespace: namespace }))
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
            return [...new Set(result)]
        }
        catch (err) {
            //Error can be 404 (since caller may be asking of a pod that is not present in a concrete namespace) or other erros
            return []
        }
    }

    public static getValidContainers = async (coreApi:CoreV1Api, accessKey:AccessKey, namespaces:string[], pods:string[], requestedContainers:string[]): Promise<string[]> => {
        let result:string[] = []
        let allowedContainers = []

        for (let namespace of namespaces) {
            let pods = (await coreApi.listNamespacedPod({namespace})).items
            for (let pod of pods) {
                let x = await this.getAllowedContainers(coreApi, accessKey, namespace, pod.metadata?.name!)
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
        return [...new Set(result)]
    }
}
