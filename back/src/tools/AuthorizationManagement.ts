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

export const validAuth = (req:any,res:any, scope:string, namespace:string, set:string, pod:string, container:string) => {
    var key=req.headers.authorization.replaceAll('Bearer ','').trim();
    var accessKey=accessKeyDeserialize(key);
    var resId=parseResource(accessKey.resource);

    if (!(resId.scope==='cluster' || scope===resId.scope)) return false;
    if (!(namespace==='' || namespace===resId.namespace)) return false;
    if (!(set==='' || set===resId.set)) return false;
    if (!(pod==='' || pod===resId.pod)) return false;
    if (!(container==='' || container===resId.container)) return false;
    return true;
}
