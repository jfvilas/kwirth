import { createContext } from "react";
import { User } from "./User";

export type SessionContextType = {
    user: User|undefined;
    logged: boolean;
    accessKey: string;
    backendUrl: string;
};

export const SessionContext = createContext<SessionContextType|null>(null);