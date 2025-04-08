import { CoreV1Api } from '@kubernetes/client-node'
import { ISecrets } from './ISecrets'
import fs from 'fs'

export class DockerSecrets implements ISecrets {
    path:string

    constructor (_coreApi: CoreV1Api, namespace:string) {
        if (!namespace.endsWith('/')) namespace+='/'
        this.path = namespace
    }

    public write = async (name:string, data:{}) => {
        try {
            fs.writeFileSync(this.path + name, JSON.stringify(data))
        }
        catch (err:any) {
            console.log(`Error writing secret (${err}).`)
            console.log(err)
            return {}
        }
    }
    
    public read = async (name:string, defaultValue?:any) => {
        try {
            let data:any = fs.readFileSync(this.path+name, 'utf-8')
            var jdata=JSON.parse(data)
            return jdata
        }
        catch (err) {
            console.log(`Error reading secret ${name}. Return default value.`)
            console.log(err)
            return defaultValue
        }
    }  

}
