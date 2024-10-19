import { ApiKeyApi } from '../api/ApiKeyApi'
import { accessKeyDeserialize, accessKeySerialize, parseResource } from '@jfvilas/kwirth-common'
import { ApiKey } from '@jfvilas/kwirth-common'
import { ServiceConfigTypeEnum } from '@jfvilas/kwirth-common';

export const cleanApiKeys = (apiKeys:ApiKey[]) => {
    apiKeys=apiKeys.filter(a => a.expire>=Date.now());
    return apiKeys;
}

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
        var receivedAccessString=req.headers.authorization.replaceAll('Bearer ','').trim();
        var key=ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===receivedAccessString);
        if (!key) {
            console.log('Inexistent key: '+receivedAccessString);
        }
        else {
            if (key.expire<Date.now()) {
                console.log('Expired key: '+receivedAccessString);
            }
            else {
                return true;
            }
        }
        res.status(403).json();
        return false;
    }
    else {
        console.log('No valid key present in headers');
        res.status(403).json();
        return false;
    }
}

const getLogScopeLevel = (scope:string) => {
    const levelScopes = ['','filter','view','restart','api','cluster'];
    return levelScopes.indexOf(scope);
}

const getMetricsScopeLevel = (scope:string) => {
    const levelScopes = ['','snapshot','stream','cluster']
    return levelScopes.indexOf(scope);
}

export const getServiceScopeLevel = (serviceConfigType:ServiceConfigTypeEnum, scope:string) => {
    switch (serviceConfigType) {
        case ServiceConfigTypeEnum.LOG:
            return getLogScopeLevel(scope)
        case ServiceConfigTypeEnum.METRICS:
            return getMetricsScopeLevel(scope)
        default:
            return 0
    }
}

export const validAuth = (req:any, res:any, reqScope:string, serviceConfigType: ServiceConfigTypeEnum, namespace:string, group:string, pod:string, container:string) => {
    var key=req.headers.authorization.replaceAll('Bearer ','').trim();
    var accessKey=accessKeyDeserialize(key);
    var resId=parseResource(accessKey.resource);

    console.log('presented resourceId',resId);
    console.log('requested access', reqScope, namespace, group, pod, container);
    if (resId.scope==='cluster') return true;
    if (getServiceScopeLevel(serviceConfigType, reqScope) < getServiceScopeLevel(serviceConfigType, resId.scope)) {
        console.log('insufficient scope level');
        return false;
    }
    if ((namespace !== '') && (namespace !== resId.namespace)) {
        console.log('insufficient namespace capabilities');
        return false;
    }
    if ((group !== '') && (group !== resId.set)) {
        console.log('insufficient group capabilities');
        return false;
    }
    if ((pod !== '') && (pod !== resId.pod)) {
        console.log('insufficient pod capabilities');
        return false;
    }
    if ((container !== '') && (container !== resId.container)) {
        console.log('insufficient container capabilities');
        return false;
    }
    console.log('authorized');
    return true;
}
