import { ISdsfMessageResponse, ISdsfRequest } from './SdsfTypes'

/*
    Where a session gets its data from. The browser answers it over the tab's websocket (front/SdsfBackSource);
    a tn3270 server would answer it calling the channel directly. The session never knows which.

    It rejects when the question could not be asked or was never answered (no socket, a timeout); an answer
    that says no — not authorised, not found — RESOLVES, with ok:false and its error code.
*/
export interface ISdsfDataSource {
    request(request: ISdsfRequest): Promise<ISdsfMessageResponse>
}
