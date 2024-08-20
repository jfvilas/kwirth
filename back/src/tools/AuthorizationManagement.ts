import { ApiKeyApi } from "../api/ApiKeyApi";
import { AccessKey } from "../model/AccessKey";
import { ResourceIdentifier } from "../model/ResourceIdentifier";

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
      var key=req.headers.authorization.replaceAll('Bearer ','').trim();
      if (ApiKeyApi.apiKeys.some(accessKey => accessKey.accessKey.toString()===key)) return true;
      console.error('Invalid key: '+key);
      res.status(403).json({});
      return false;
    }
    else {
      console.error('No valid key present in headers');
      res.status(403).json({});
      return false;
    }
  }

export const parseAccessKey = (key:string) : AccessKey => {
  var parts=key.split('|');
  return {
    id:parts[0],
    type:parts[1],
    resource:parts[2]
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
