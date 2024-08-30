import { ApiKeyApi } from '../api/ApiKeyApi';
import { accessKeySerialize } from '../model/AccessKey';

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
                console.log(apiKey.expire, '>', Date.now(), '?');
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
    const levelScopes = ['','filter','container','pod','set','namespace','cluster'];
    return levelScopes.indexOf(scope);
}
