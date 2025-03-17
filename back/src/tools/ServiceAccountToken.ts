import { CoreV1Api } from '@kubernetes/client-node'

export class ServiceAccountToken {
    coreApi:CoreV1Api
    namespace:string

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi
        this.namespace=namespace
    }

    public createToken = async (serviceAccountName: string, namespace: string) => {
        const secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: `${serviceAccountName}-kwirthtoken`,
                namespace: namespace,
                annotations: {
                    'kubernetes.io/service-account.name': serviceAccountName,
                },
            },
            type: 'kubernetes.io/service-account-token'
        }

        // we firt delete it if it exists, we cannot use a previous token, it may be expired
        try {
            await this.coreApi.readNamespacedSecret(serviceAccountName+'-kwirthtoken', namespace)
            await this.deleteToken(serviceAccountName, namespace)
        }
        catch (err) {
            console.log('token does not exists. we will create')
        }

        // we now create it
        try {
            await this.coreApi.createNamespacedSecret(namespace, secret)
            console.log('SA token created')
        }
        catch (err:any) {
            console.log('Error creating SA token')
            console.log(`  Code: ${err.body?.code}`)
            console.log(`  Reason: ${err.body?.reason}`)
            console.log(`  Message: ${err.body?.message}`)
        }
    }
    
    public extractToken = async (serviceAccountName: string, namespace: string) => {
        try {
            const response = await this.coreApi.readNamespacedSecret(serviceAccountName+'-kwirthtoken', namespace)
            const token = Buffer.from(response.body.data!.token, 'base64').toString('utf-8')
            return token
        }
        catch (err) {
            console.log('Error extracting token')
            console.log(err)
        }
        return null
    }
    
    public deleteToken = async (serviceAccountName: string, namespace: string) => {
        try {
            const response = await this.coreApi.deleteNamespacedSecret(serviceAccountName+'-kwirthtoken', namespace)
            console.log('SA token deleted')
        }
        catch (err) {
            console.log('Error deleting SA token')
            console.log(err)
        }
    }
    
}