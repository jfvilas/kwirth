import { ApiKeyApi } from "../api/ApiKeyApi";
import { ResourceIdentifier } from "../model/ResourceIdentifier";

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
      var key=req.headers.authorization.replaceAll('Bearer ','').trim();
      if (ApiKeyApi.apiKeys.some(k => k.key===key)) return true;
      console.log('Invalid key: '+key);
      res.status(403).json({});
      return false;
    }
    else {
      console.log('No valid key present in headers');
      res.status(403).json({});
      return false;
    }
  }

export const extractResource = (key:string) : ResourceIdentifier => {
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