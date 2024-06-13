import { CoreV1Api, AppsV1Api, KubeConfig, Log, Watch, V1ConfigMap } from '@kubernetes/client-node';

export class  ConfigMaps {
    coreApi:CoreV1Api;
    namespace:string;

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi;
        this.namespace=namespace;
    }

    public write = (name:string, data:any): Promise<{}> =>{
        return new Promise(
            async (resolve, reject) => {
                console.log(data);
                try {
                    var configMap:V1ConfigMap = {
                        metadata: {
                            name: name,
                            namespace: this.namespace
                        },
                        data: data
                    };
                    try {
                        console.log(configMap);
                        await this.coreApi?.replaceNamespacedConfigMap(name,this.namespace, configMap);
                        resolve ({});
                    }
                    catch (err) {
                        console.log('err replacing try to create');
                        try {
                            await this.coreApi?.createNamespacedConfigMap(this.namespace, configMap);
                            resolve ({});
                        }
                        catch (err) {
                            console.log(err);
                            reject ({});
                        }
                    }
                }
                catch (err) {
                    reject ({});
                }
            }
        );
    }
    
    public read = async (name:string, defaultValue:any=undefined):Promise<any> =>{
        return new Promise( async (resolve,reject) => {
            try {
                var ct = await this.coreApi?.readNamespacedConfigMap(name,this.namespace);
                resolve(ct.body.data);
            }
            catch(err:any){
                if (err.statusCode===404) {
                    resolve (defaultValue);
                }
                else {
                    console.log(err);
                    reject (undefined);
                }
            }
        });
    }  
}
