import { ITabObject } from "./ITabObject"

interface IBoard {
    name: string
    description:string
    tabs:ITabObject[]
}

interface IBoardSummary {
    name: string
    description:string
}

export type { IBoard,  IBoardSummary }