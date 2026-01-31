import { createContext } from 'react'
import { IUser } from '@jfvilas/kwirth-common'

export type SessionContextType = {
    user: IUser|undefined
    logged: boolean
    accessString: string
    backendUrl: string
}

export const SessionContext = createContext<SessionContextType|null>(null)