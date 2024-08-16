import { ApiKeyApi } from "../api/ApiKeyApi";

export const validKey = (req:any,res:any) => {
    if (req.headers.authorization && req.headers.authorization) {
      var key=req.headers.authorization.replaceAll('Bearer ','').trim();
      console.log(ApiKeyApi.apiKeys);
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
