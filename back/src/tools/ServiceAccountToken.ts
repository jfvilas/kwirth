import { CoreV1Api } from "@kubernetes/client-node";

export class ServiceAccountToken {
    coreApi:CoreV1Api;
    namespace:string;

    constructor (coreApi: CoreV1Api, namespace:string) {
        this.coreApi=coreApi;
        this.namespace=namespace;
    }

    private createToken = async (serviceAccountName: string, namespace: string) => {
        const secret = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: `${serviceAccountName}-token`,
                namespace: namespace,
                annotations: {
                    'kubernetes.io/service-account.name': serviceAccountName,
                },
            },
            type: 'kubernetes.io/service-account-token',
        };
    
        try {
            const response = await this.coreApi.createNamespacedSecret(namespace, secret);
            console.log(response.body)
        } catch (err) {
            console.error('Error creando el token:', err);
        }
        console.log('Token created')
    }
    
    private extractToken = async (secretName: string, namespace: string) => {
        try {
            const response = await this.coreApi.readNamespacedSecret(secretName+'-token', namespace)
            console.log(response.body)
            const token = Buffer.from(response!.body!.data!.token, 'base64').toString('utf-8')
            console.log(token)
            return token
        } catch (err) {
            console.error('Error obteniendo el token:', err)
        }
        return null
    }
    
    private removeToken = async (secretName: string, namespace: string) => {
        try {
            const response = await this.coreApi.deleteNamespacedSecret(secretName+'-token', namespace)
        } catch (err) {
            console.error('Error borrando el token:', err)
        }
    }
    
    public getToken = async (sa:string,ns:string) => {
        await this.createToken(sa,ns)
        var token = await this.extractToken(sa, ns)
        //this.removeToken(sa,ns)
        return token
        // USE: curl -k -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjNwUFpiTUJxWDZsM05VVndqYlN4ZkQxVW41UlVPRnpES3pEZE45cjdWTmMifQ.eyJpc3MiOiJrdWJlcm5ldGVzL3NlcnZpY2VhY2NvdW50Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9uYW1lc3BhY2UiOiJkZWZhdWx0Iiwia3ViZXJuZXRlcy5pby9zZXJ2aWNlYWNjb3VudC9zZWNyZXQubmFtZSI6Imt3aXJ0aC1zYS10b2tlbiIsImt1YmVybmV0ZXMuaW8vc2VydmljZWFjY291bnQvc2VydmljZS1hY2NvdW50Lm5hbWUiOiJrd2lydGgtc2EiLCJrdWJlcm5ldGVzLmlvL3NlcnZpY2VhY2NvdW50L3NlcnZpY2UtYWNjb3VudC51aWQiOiJhMWEwODVkOS1hY2NhLTRlZWQtOTBiYi1iZDFjMDhjZWU5Y2IiLCJzdWIiOiJzeXN0ZW06c2VydmljZWFjY291bnQ6ZGVmYXVsdDprd2lydGgtc2EifQ.w4Rz6jMRXXENKyahqN-oWMAk3E6glZQgf20xLn4vppkRqQuJNhigcMLWiWkNAmrlic9UWkJb5b-VCnuAzuB_fjzBnmjnfW1JA5QTtqVM6dmgaFmrEHSiU4Es01_veSFPNvLgJHcX0_of2A2b50UyEQxjkvDgHvIjadkZPXNrCButWlOlEuQ8_Zk9ILH4dnwE1M0sqDybE3KanjhvZDv9Apr3-MU4ivkK_DSxkwgvAB-7afSMd8F6JdT4acQXAkcgHlli5ATECPduGgIPFrAID1LccxFh90L_w1SECDZ1gG3Zz_jPonXCA1vieVwrzBxy3iVcyBkEyz065LkczA59Eg" https://172.19.0.3:10250/metrics
    }

}