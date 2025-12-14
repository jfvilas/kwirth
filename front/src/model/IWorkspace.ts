import { ITabObject } from "./ITabObject"

interface IWorkspace {
    name: string
    description:string
    tabs:ITabObject[]
}

interface IWorkspaceSummary {
    name: string
    description:string
}

export type { IWorkspace,  IWorkspaceSummary }