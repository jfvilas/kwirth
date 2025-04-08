import { CoreV1Api } from '@kubernetes/client-node'
import { ISecrets } from './ISecrets'

export class KubernetesSecrets implements ISecrets {
    coreApi:CoreV1Api
    namespace:string

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi
        this.namespace=namespace
    }

    public write = async (name:string, content:{}) => {
        var secret = {
            metadata: {
                name: name,
                namespace: this.namespace
            },
            data: content
        };
        try {
            await this.coreApi?.replaceNamespacedSecret(name,this.namespace, secret)
            return {}
        }
        catch (err) {
            await this.coreApi?.createNamespacedSecret(this.namespace, secret)
            return {}
        }
    }
    
    public read = async (name:string, _defaultValue?:any) => {        
        var ct = await this.coreApi?.readNamespacedSecret(name,this.namespace)
        return ct.body.data
    }  

}
