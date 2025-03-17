import { ApiKeyApi } from '../api/ApiKeyApi'
import { AccessKey, accessKeyDeserialize, accessKeySerialize, parseResource, ServiceConfigScopeEnum } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import { ServiceConfigChannelEnum } from '@jfvilas/kwirth-common';
import * as crypto from 'crypto'
import { IChannel } from '../model/IChannel';

export const cleanApiKeys = (apiKeys:ApiKey[]) => {
    apiKeys=apiKeys.filter(a => a.expire>=Date.now());
    return apiKeys;
}

export const validBearerKey = (accessKey:AccessKey) : boolean => {
    let masterKey = 'Kwirth4Ever'
    let expire = accessKey.type.split(':')[1]
    let input = masterKey + '|' + accessKey.resource + '|' + expire
    var hash = crypto.createHash('md5').update(input).digest('hex')
    return hash === accessKey.id
}

export const validKeyAsync = async (req:any,res:any, apiKeyApi: ApiKeyApi) => {
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
            var key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
            if (!key) {
                await apiKeyApi.refreshKeys()
                key = ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString)
                if (!key) console.log('Inexistent key: '+receivedAccessString)
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

export const getServiceScopeLevel = (channels:Map<string, IChannel>, serviceConfigChannel:string, scope:string) : number => {
    switch (serviceConfigChannel) {
        // case ServiceConfigChannelEnum.LOG:
        //     return getLogScopeLevel(scope)
        // case ServiceConfigChannelEnum.ALARM:
        //     return getAlarmScopeLevel(scope)
        // case ServiceConfigChannelEnum.METRICS:
        //     return getMetricsScopeLevel(scope)
        default:
            if (channels.has(serviceConfigChannel)) {
                return channels.get(serviceConfigChannel)!.getServiceScopeLevel(serviceConfigChannel)
            }
            else {
                return 0
            }
    }
}

export const validAuth = (req:any, res:any, channels:Map<string, IChannel>, reqScope:string, serviceConfigChannel: ServiceConfigChannelEnum, namespace:string, group:string, pod:string, container:string) => {
    var key=req.headers.authorization.replaceAll('Bearer ','').trim()
    var accessKey=accessKeyDeserialize(key)
    var resId=parseResource(accessKey.resource)

    if (resId.scope==='cluster') return true
    if (getServiceScopeLevel(channels, serviceConfigChannel, reqScope) < getServiceScopeLevel(channels, serviceConfigChannel, resId.scope)) {
        console.log('Insufficient scope level')
        return false
    }
    if ((namespace !== '') && (namespace !== resId.namespace)) {
        console.log('Insufficient namespace capabilities')
        return false
    }
    if ((group !== '') && (group !== resId.set)) {
        console.log('Insufficient group capabilities')
        return false
    }
    if ((pod !== '') && (pod !== resId.pod)) {
        console.log('Insufficient pod capabilities')
        return false
    }
    if ((container !== '') && (container !== resId.container)) {
        console.log('Insufficient container capabilities')
        return false
    }
    console.log('Authorized!')
    return true
}
