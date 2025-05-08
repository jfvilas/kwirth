import { AccessKey } from "@jfvilas/kwirth-common"

class User {
    public id: string=''
    public name: string=''
    public accessKey: AccessKey = new AccessKey()
}

export { User }