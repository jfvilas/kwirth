import { ITabObject } from "./ITabObject"

interface IBoard {
    name: string
    description:string
    tabs:ITabObject[]
}

export type { IBoard }