import { ApiKeyApi } from '../api/ApiKeyApi';
import { accessKeyDeserialize, accessKeySerialize, parseResource } from '../model/AccessKey';

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
        var key=req.headers.authorization.replaceAll('Bearer ','').trim();
        var apiKey=ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===key);
        if (!apiKey) {
            console.log('Inexistent key: '+key);
        }
        else {
            if (apiKey.expire<Date.now()) {
                console.log('Expired key: '+key);
            }
            else {
                return true;
            }
        }
        res.status(403).json({});
        return false;
    }
    else {
        console.log('No valid key present in headers');
        res.status(403).json({});
        return false;
    }
}

export const getScopeLevel = (scope:string) => {
    const levelScopes = ['','filter','view','restart','api','cluster'];
    return levelScopes.indexOf(scope);
}

export const validAuth = (req:any,res:any, scope:string, namespace:string, group:string, pod:string, container:string) => {
    var key=req.headers.authorization.replaceAll('Bearer ','').trim();
    var accessKey=accessKeyDeserialize(key);
    var resId=parseResource(accessKey.resource);


    console.log('presented resourceId',resId);
    console.log('requested access',scope,namespace, group, pod, container);
    if (resId.scope==='cluster') return true;
    if (!(getScopeLevel(scope)>getScopeLevel(resId.scope))) {
        console.log('insufficeint scope level');
        return false;
    }
    if (!(namespace==='' || namespace===resId.namespace)) {
        console.log('insufficient namespace capabilities');
        return false;
    }
    if (!(group==='' || group===resId.set)) {
        console.log('insufficient group capabilities');
        return false;
    }
    if (!(pod==='' || pod===resId.pod)) {
        console.log('insufficient pod capabilities');
        return false;
    }
    if (!(container==='' || container===resId.container)) {
        console.log('insufficient container capabilities');
        return false;
    }
    console.log('authorized');
    return true;
}
