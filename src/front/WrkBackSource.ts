import { IChannelObject } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType } from '@kwirthmagnify/kwirth-common'
import { IWrkDataSource } from '../common/WrkDataSource'
import { IWrkactjobMessage, IWrkactjobMessageResponse, IWrkRequest } from '../common/WrkactjobTypes'

export const REQUEST_TIMEOUT_MS = 30000

interface IPending {
    resolve: (response: IWrkactjobMessageResponse) => void
    reject: (reason: Error) => void
    timer: ReturnType<typeof setTimeout>
}

/*
    The session's data source in the browser: the tab's websocket. Each request carries an id and waits for the
    response with that id, which processChannelMessage hands in.

    ⚠️ The socket and the instance are read on EVERY request, never kept: stopping and starting the channel opens a
    new websocket, and a source holding the old one would send into a closed socket.
*/
export class WrkBackSource implements IWrkDataSource {
    private readonly channelObject: IChannelObject
    private pending = new Map<string, IPending>()
    private sequence = 0

    constructor(channelObject: IChannelObject) {
        this.channelObject = channelObject
    }

    request = (request: IWrkRequest): Promise<IWrkactjobMessageResponse> => {
        const ws = this.channelObject.webSocket
        const instance = this.channelObject.instanceId
        if (!ws || ws.readyState !== WebSocket.OPEN || !instance) {
            return Promise.reject(new Error('The channel is not connected to Kwirth: start it again.'))
        }
        const id = `${Date.now()}-${++this.sequence}`
        const message: IWrkactjobMessage = {
            ...request,
            action: EInstanceMessageAction.COMMAND,
            flow: EInstanceMessageFlow.REQUEST,
            type: EInstanceMessageType.DATA,
            channel: 'wrkactjob',
            instance,
            msgtype: 'wrkactjobmessage',
            id,
            accessKey: this.channelObject.accessString ?? ''
        }
        return new Promise<IWrkactjobMessageResponse>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id)
                reject(new Error(`Kwirth did not answer in ${REQUEST_TIMEOUT_MS / 1000} seconds.`))
            }, REQUEST_TIMEOUT_MS)
            this.pending.set(id, { resolve, reject, timer })
            ws.send(JSON.stringify(message))
        })
    }

    // A response arrived: to whoever asked. Returns false when nobody was waiting for it (late or foreign).
    resolve = (response: IWrkactjobMessageResponse): boolean => {
        const pending = this.pending.get(response.id)
        if (!pending) return false
        clearTimeout(pending.timer)
        this.pending.delete(response.id)
        pending.resolve(response)
        return true
    }

    // The socket went away: nobody will answer what is pending.
    rejectAll = (reason: string): void => {
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer)
            pending.reject(new Error(reason))
        }
        this.pending.clear()
    }
}
