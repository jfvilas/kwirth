import { IUser } from "@jfvilas/kwirth-common";
import { createContext } from "react";

export type SessionContextType = {
    user: IUser|undefined
    logged: boolean
    accessString: string
    backendUrl: string
}

export const SessionContext = createContext<SessionContextType|null>(null)