import { CoreV1Api, V1ConfigMap } from '@kubernetes/client-node'

export class ConfigMaps {
    coreApi:CoreV1Api
    namespace:string

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi
        this.namespace=namespace
    }

    public write = async (name:string, data:any) =>{
        try {
            var configMap:V1ConfigMap = {
                metadata: {
                    name: name,
                    namespace: this.namespace
                },
                data: { data: JSON.stringify(data) }
            };
            try {
                await this.coreApi?.replaceNamespacedConfigMap(name,this.namespace, configMap)
                return {}
            }
            catch (err:any) {
                console.log(`Error replacing (${err.response.body.message}) try to create`)
                try {
                    await this.coreApi?.createNamespacedConfigMap(this.namespace, configMap)
                    return {}
                }
                catch (err:any) {
                    console.log(`Error creating (${err.response.body.message}).`)
                    console.log(err)
                    return {}
                }
            }
        }
        catch (err) {
            console.log(err)
            return undefined
        }
    
    }
    
    public read = async (name:string, defaultValue:any=undefined) => {
        try {
            var ct = await this.coreApi?.readNamespacedConfigMap(name,this.namespace)
            if (ct.body.data===undefined) ct.body.data={ data: defaultValue }
            return JSON.parse(ct.body.data.data)
        }
        catch(err:any){
            if (err.statusCode===404) {
                return defaultValue
            }
            else {
                console.log(err)
                return undefined
            }
        }
    }
}
