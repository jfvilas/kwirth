import { ApiKeyApi } from '../api/ApiKeyApi';
import { accessKeySerialize } from '../model/AccessKey';

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
        var key=req.headers.authorization.replaceAll('Bearer ','').trim();
        //if (ApiKeyApi.apiKeys.some(apiKey => accessKeySerialize(apiKey.accessKey)===key)) return true;
        var apiKey=ApiKeyApi.apiKeys.find(apiKey => accessKeySerialize(apiKey.accessKey)===key);
        if (!apiKey) {
            console.error('Inexistent key: '+key);
        }
        else {
            if (apiKey.expire<Date.now()) {
                console.error('Expired key: '+key);
            }
            else {
                console.log(apiKey.expire, '>', Date.now(), '?');
                return true;
            }
        }
        res.status(403).json({});
        return false;
    }
    else {
        console.error('No valid key present in headers');
        res.status(403).json({});
        return false;
    }
}

export const getScopeLevel = (scope:string) => {
    const levelScopes = ['','filter','container','pod','set','namespace','cluster'];
    return levelScopes.indexOf(scope);
}
