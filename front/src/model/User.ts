import { AccessKey } from "@jfvilas/kwirth-common"

class User {
    public id: string=''
    public name: string=''
    public password:string = ''
    public accessKey: AccessKey = new AccessKey()
    public resources: string = ''
}

export { User }