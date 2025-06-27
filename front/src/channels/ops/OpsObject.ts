export interface IShell {
    namespace: string 
    pod: string 
    container: string 
    lines: string[]
    id: string
    connected: boolean
    pending: string
}

export interface IOpsObject {
    messages: string[]
    shells: IShell[]
    shell: IShell|undefined
}

export class OpsObject implements IOpsObject{
    messages:string[] = []
    shells:IShell[] = []
    shell:IShell|undefined = undefined
}
