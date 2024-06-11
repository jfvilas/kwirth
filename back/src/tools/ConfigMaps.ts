import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch } from '@kubernetes/client-node';

export class  ConfigMaps {
    coreApi:CoreV1Api;
    namespace:string;

    constructor (coreApi: CoreV1Api, namespace:string='default') {
        this.coreApi=coreApi;
        this.namespace=namespace;
    }

    public write = (name:string, content:{}): Promise<{}> =>{
        return new Promise(
            (resolve, reject) => {
                try {
                    var secret = {
                        metadata: {
                            name: name,
                            namespace: this.namespace
                        },
                        data: content
                    };
                    try {
                        this.coreApi?.replaceNamespacedConfigMap(name,this.namespace, secret);
                        resolve ({});
                    }
                    catch (err) {
                        this.coreApi?.createNamespacedConfigMap(this.namespace, secret);
                        resolve ({});
                    }
                }
                catch (err) {
                    reject (undefined);
                }
            }
        );
    }
    
    public read = async (name:string):Promise<{}> =>{
        return new Promise(
            async (resolve,reject) => {
                try {
                    var ct = await this.coreApi?.readNamespacedConfigMap(name,this.namespace);
                    resolve(ct.body);
                }
                catch(err){
                    reject (undefined);
                }
            }
        );
    }  
}
