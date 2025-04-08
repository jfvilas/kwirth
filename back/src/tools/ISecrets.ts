export interface ISecrets {
    write: (name:string, content:{}) => void
    read: (name:string) => void
}
