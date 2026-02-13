export interface ISecrets {
    write: (name:string, content:{}) => Promise<void>
    read: (name:string) => Promise<any>
}
