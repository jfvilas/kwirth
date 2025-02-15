import { ApiKeyApi } from '../api/ApiKeyApi'
import { AccessKey, accessKeyDeserialize, accessKeySerialize, parseResource } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import { ServiceConfigChannelEnum } from '@jfvilas/kwirth-common';
import * as crypto from 'crypto'

export const cleanApiKeys = (apiKeys:ApiKey[]) => {
    apiKeys=apiKeys.filter(a => a.expire>=Date.now());
    return apiKeys;
}

export const validBearerKey = (accessKey:AccessKey) : boolean => {
    console.log('validate bearer key:')
    console.log(accessKey)
    let masterKey = 'Kwirth4Ever'
    let expire = accessKey.type.split(':')[1]
    let input = masterKey + '|' + accessKey.resource + '|' + expire
    var hash = crypto.createHash('md5').update(input).digest('hex')
    console.log('hash',hash)
    console.log('id', accessKey.id)
    return hash === accessKey.id
}

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
        var receivedAccessString=req.headers.authorization.replaceAll('Bearer ','').trim()
        var receivedAccessKey = accessKeyDeserialize(receivedAccessString)
        let computedExpire = 0
        if (receivedAccessKey.type.startsWith('bearer:')) {
            if (validBearerKey(receivedAccessKey))
                console.log('Hashes do not match')
            else
                computedExpire = +receivedAccessKey.type.split(':')[1]
        }
        else {
            var key=ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
            if (!key)
                console.log('Inexistent key: '+receivedAccessString)
            else
                computedExpire = key.expire
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

const getLogScopeLevel = (scope:string) => {
    const levelScopes = ['','filter','view','restart','api','cluster']
    return levelScopes.indexOf(scope)
}

const getMetricsScopeLevel = (scope:string) => {
    const levelScopes = ['','snapshot','stream','cluster']
    return levelScopes.indexOf(scope)
}

export const getServiceScopeLevel = (serviceConfigChannel:ServiceConfigChannelEnum, scope:string) => {
    switch (serviceConfigChannel) {
        case ServiceConfigChannelEnum.LOG:
            return getLogScopeLevel(scope)
        case ServiceConfigChannelEnum.METRICS:
            return getMetricsScopeLevel(scope)
        default:
            return 0
    }
}

export const validAuth = (req:any, res:any, reqScope:string, serviceConfigChannel: ServiceConfigChannelEnum, namespace:string, group:string, pod:string, container:string) => {
    var key=req.headers.authorization.replaceAll('Bearer ','').trim()
    var accessKey=accessKeyDeserialize(key)
    var resId=parseResource(accessKey.resource)

    console.log('presented resourceId',resId)
    console.log('requested access', reqScope, namespace, group, pod, container)
    if (resId.scope==='cluster') return true
    if (getServiceScopeLevel(serviceConfigChannel, reqScope) < getServiceScopeLevel(serviceConfigChannel, resId.scope)) {
        console.log('insufficient scope level')
        return false
    }
    if ((namespace !== '') && (namespace !== resId.namespace)) {
        console.log('insufficient namespace capabilities')
        return false
    }
    if ((group !== '') && (group !== resId.set)) {
        console.log('insufficient group capabilities')
        return false
    }
    if ((pod !== '') && (pod !== resId.pod)) {
        console.log('insufficient pod capabilities')
        return false
    }
    if ((container !== '') && (container !== resId.container)) {
        console.log('insufficient container capabilities')
        return false
    }
    console.log('authorized')
    return true
}
