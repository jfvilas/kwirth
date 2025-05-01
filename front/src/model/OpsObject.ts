export interface IShell {
    namespace: string 
    pod: string 
    container: string 
    lines: string[]
    id: string
    connected: boolean
}

export class OpsObject {
    public accessKey: string = ''
    public messages: string[] = []
    public shells: IShell[] = []
    public shell: IShell|undefined = undefined
}
