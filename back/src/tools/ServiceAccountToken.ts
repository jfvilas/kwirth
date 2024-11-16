import { CoreV1Api } from '@kubernetes/client-node'

export class ServiceAccountToken {
    coreApi:CoreV1Api
    namespace:string

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi
        this.namespace=namespace
    }

    private createToken = async (serviceAccountName: string, namespace: string) => {
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
            //this.deleteToken(serviceAccountName, namespace)
        }
        catch (err) {
            console.log('token does not exists. we will create')
            // token does not exist
        }

        // we now create it
        try {
            await this.coreApi.createNamespacedSecret(namespace, secret)
            console.log('token created')
        }
        catch (err:any) {
            console.log('Error creating token')
            console.log(err.body)
        }
    }
    
    private extractToken = async (serviceAccountName: string, namespace: string) => {
        try {
            const response = await this.coreApi.readNamespacedSecret(serviceAccountName+'-kwirthtoken', namespace)
            console.log(response)
            const token = Buffer.from(response!.body!.data!.token, 'base64').toString('utf-8')
            return token
        }
        catch (err) {
            console.log('Error extracting token')
            console.log(err)
        }
        return null
    }
    
    private deleteToken = async (serviceAccountName: string, namespace: string) => {
        try {
            const response = await this.coreApi.deleteNamespacedSecret(serviceAccountName+'-kwirthtoken', namespace)
            console.log('token deleted')
        }
        catch (err) {
            console.log('Error deleting token')
            console.log(err)
        }
    }
    
    public getToken = async (serviceAccountName:string, namespace:string) => {
        await this.createToken(serviceAccountName,namespace)
        var token = await this.extractToken(serviceAccountName, namespace)
        //this.deleteToken(serviceAccountName, namespace)
        return token
        // USE: curl -k -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IkVORkI4ZkRSckl2YjhHR08yaUpwTUtsWng4S19NSVhsYjhUX0plTTM0TjQifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJkZWZhdWx0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Imt3aXJ0aC1zYS10b2tlbiIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJrd2lydGgtc2EiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiJlNzljYTU5My02ZTMzLTQ2MjYtOGVlYS0xMTk4ODU1YTkwZDAiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6ZGVmYXVsdDprd2lydGgtc2EifQ.sba8_0CoS1WXC2f6Kllev35hZ4utHvJR6ga4WxvFkAmrRcqeWI3n1J1_BLzGtxwgS-PPSdFvPMzT6g_LSuErxaIPoymdGpoFxg4LjguFcJ_x-9MC9VsnoCKg5qa73l97NjETSf2mVGzM0PwAb0Hw1KOGL2lpW_AqZvYtlq_8l9CEKR1FOhY49x2W0JELuBOXJFHLn2ttawZ7I_OjWA6JnHWLf69_lzNSGlQHU45em2ApZ5v0x8TmJqrm7wz59NOk-AU4FKHI89aPXk64pF--vW2--Awj5J_l7x0Fdy1ezlegYpCQPLE1QbVn_EjuwH2Dj_s8edN3i8vk4nm5zdQ7-g" https://172.19.0.3:10250/metrics
    }

}