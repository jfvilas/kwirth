import { ApiKeyApi } from '../api/ApiKeyApi';
import { ResourceIdentifier } from "../model/ResourceIdentifier";
import { accessKeySerialize } from 'common/dist';

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

export const parseResource = (key:string) : ResourceIdentifier => {
    var parts=key.split(':');
    return {
        scope:parts[0],
        namespace:parts[1],
        setType:parts[2],
        setName:parts[3],
        pod:parts[4],
        container:parts[5]
    }
}

export const getScopeLevel = (scope:string) => {
    const levelScopes = ['','container','pod','set','namespace','cluster'];
    return levelScopes.indexOf(scope);
}
