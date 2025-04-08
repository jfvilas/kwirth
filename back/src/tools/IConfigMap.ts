export interface IConfigMaps {
    write: (name:string, data:any) => any
    read: (name:string, defaultValue?:any) => any
}
