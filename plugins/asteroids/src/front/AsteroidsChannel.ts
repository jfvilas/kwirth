import { EInstanceConfigScope, EInstanceMessageType, EInstanceMessageFlow, EInstanceMessageAction, ENotifyLevel, ESignalMessageLevel, IInstanceMessage, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { IChannel, IChannelObject, IChannelRequirements, IChannelMessageAction, IContentProps, ISetupProps, EChannelRefreshAction } from '@kwirthmagnify/kwirth-common-front'
import { FC } from 'react'
import { AsteroidsGame, GameStatus } from './core'
import { AsteroidsConfig, AsteroidsInstanceConfig, IAsteroidsConfig } from './AsteroidsConfig'
import { AsteroidsData, IAsteroidsData } from './AsteroidsData'
import { AsteroidsSetup, AsteroidsIcon } from './AsteroidsSetup'
import { AsteroidsTabContent } from './AsteroidsTabContent'
import { IAsteroidsInstanceConfig } from './AsteroidsTypes'
import { BackScoreStore, LocalScoreStore, MSG_SCORES, sanitizeEntries, socketSender } from './AsteroidsScores'

/**
 * Asteroids channel.
 *
 * The IChannel contract already brings start/pause/continue/stop, which is
 * exactly the life cycle a game needs. Here it is only translated:
 * start creates or restarts the game, pause and continue freeze and
 * resume it, stop discards it.
 *
 * The animation loop does NOT live here but in the TabContent, because it depends on the
 * canvas. What lives here is the state, which is what has to survive.
 */
export class AsteroidsChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = AsteroidsSetup
    TabContent: FC<IContentProps> = AsteroidsTabContent
    channelId = 'asteroids'
    requirements: IChannelRequirements = {
        accessString: true,
        clusterUrl: true,
        clusterInfo: false,
        exit: false,
        frontChannels: false,
        metrics: false,
        notifier: true,
        notifications: false,
        setup: true,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true,
        backChannels: false,
    }

    getScope() { return EInstanceConfigScope.NONE }
    getChannelIcon(): JSX.Element { return AsteroidsIcon }

    getSetupVisibility(): boolean { return this.setupVisible }
    setSetupVisibility(visibility: boolean): void { this.setupVisible = visibility }

    /**
     * The socket is opened and managed by the Kwirth front end: there is one per tab and
     * it is handed over already open in `channelObject.webSocket` when the channel starts.
     *
     * The game does not travel over it (it runs entirely in the browser), but the back end
     * DOES answer the start with a SIGNAL/RESPONSE/START that carries the instance
     * id. It has to be kept: the front end later uses it to address the
     * pause and the stop (App.tsx reads it from channelObject.instanceId). Without this the
     * channel starts but is stopped blindly.
     */
    processChannelMessage(channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction {
        const msg: IInstanceMessage = JSON.parse(wsEvent.data)

        const asteroidsData: IAsteroidsData = channelObject.data

        /*
            The core rejects things by sending a SIGNAL of level ERROR, and until now this channel
            ignored them: the rejection got lost and the failure showed up much later, disguised as
            something else. The real case: starting with a view other than 'none' returned
            "Channel 'asteroids' can only be started with the 'none' view", the channel swallowed it,
            stored instance:'' as if it had started fine, and the user only saw, at the end of
            a game, that the score could not be saved.

            It is checked BEFORE the START: a START response with level ERROR is not a start.
        */
        const signal = msg as ISignalMessage
        if (msg.type === EInstanceMessageType.SIGNAL && signal.level === ESignalMessageLevel.ERROR) {
            channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR,
                signal.text || 'The channel reported an error')
            return { action: EChannelRefreshAction.NONE }
        }

        if (msg.type === EInstanceMessageType.SIGNAL
            && msg.flow === EInstanceMessageFlow.RESPONSE
            && msg.action === EInstanceMessageAction.START) {
            // No instance means no start: accepting it empty is what masked the failure.
            if (!msg.instance) {
                channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR,
                    'The channel did not start: the server returned no instance.')
                return { action: EChannelRefreshAction.NONE }
            }
            channelObject.instanceId = msg.instance
            // With the instance already registered in the back end, the table can be requested.
            this.attachScoreStore(channelObject)
            void asteroidsData.scoreStore?.load().then((entries) => {
                asteroidsData.scores = entries
                asteroidsData.highScore = Math.max(asteroidsData.highScore, entries[0]?.score ?? 0)
                asteroidsData.revision++
            })
            return { action: EChannelRefreshAction.REFRESH }
        }

        // New table sent by the back end, whether it is a reply to us or a notice that
        // another player has scored.
        if ((msg as any).msgtype === MSG_SCORES) {
            const entries = sanitizeEntries((msg as any).scores)
            asteroidsData.scores = entries
            asteroidsData.highScore = Math.max(asteroidsData.highScore, entries[0]?.score ?? 0)
            asteroidsData.revision++
            const store = asteroidsData.scoreStore
            if (store instanceof BackScoreStore) store.resolve(entries)
            return { action: EChannelRefreshAction.REFRESH }
        }

        // No message from the back end alters the game, so there is no repaint:
        // the TabContent already runs on requestAnimationFrame.
        return { action: EChannelRefreshAction.NONE }
    }

    /**
     * Chooses the store depending on whether there is a socket or not. The Kwirth front end leaves the socket in
     * channelObject.webSocket because the channel declares webSocket:true.
     *
     * ⚠️ The socket is read ON EVERY SEND, it is never captured when the store is created. Stopping and starting the
     * channel opens a NEW websocket, and a store that had kept the previous one would keep
     * sending to a closed socket: readyState is no longer OPEN, the send returns false and the
     * score is lost. The symptom is cruel, because stopping and starting is exactly what people
     * do to "fix it", and it is precisely what broke it.
     */
    private attachScoreStore(channelObject: IChannelObject): void {
        const asteroidsData: IAsteroidsData = channelObject.data

        if (!channelObject.webSocket) {
            // No socket: local safety net. If one shows up later, it is replaced.
            if (!asteroidsData.scoreStore) asteroidsData.scoreStore = new LocalScoreStore()
            return
        }
        if (asteroidsData.scoreStore instanceof BackScoreStore) return

        asteroidsData.scoreStore = new BackScoreStore(
            socketSender(() => channelObject.webSocket),
            () => channelObject.instanceId ?? '',
            () => channelObject.accessString ?? ''
        )
    }

    async initChannel(channelObject: IChannelObject): Promise<boolean> {
        channelObject.instanceConfig = new AsteroidsInstanceConfig()
        channelObject.config = new AsteroidsConfig()
        const asteroidsData: IAsteroidsData = channelObject.data = new AsteroidsData()

        // The table is NOT loaded here: initChannel runs before the
        // websocket exists. Loading is triggered on receiving the SIGNAL/RESPONSE/START,
        // which is the moment the back end already has the instance registered and
        // therefore accepts commands.
        asteroidsData.scores = []
        return false
    }

    startChannel(channelObject: IChannelObject): boolean {
        const asteroidsData: IAsteroidsData = channelObject.data
        const asteroidsConfig: IAsteroidsInstanceConfig = channelObject.instanceConfig

        if (!asteroidsData.game) {
            const game = new AsteroidsGame()
            try {
                game.aspectRatio = asteroidsConfig?.aspectRatio ?? 1.6
            }
            catch {
                game.aspectRatio = 1.6
            }
            asteroidsData.game = game
        }
        else if (asteroidsData.game.state.status === GameStatus.Finished) {
            asteroidsData.game.reset()
        }

        asteroidsData.started = true
        asteroidsData.paused = false
        asteroidsData.gameOver = false
        asteroidsData.pendingScore = false
        asteroidsData.revision++
        return true
    }

    pauseChannel(channelObject: IChannelObject): boolean {
        const asteroidsData: IAsteroidsData = channelObject.data
        asteroidsData.paused = true
        asteroidsData.revision++
        return true
    }

    continueChannel(channelObject: IChannelObject): boolean {
        const asteroidsData: IAsteroidsData = channelObject.data
        asteroidsData.paused = false
        asteroidsData.revision++
        return true
    }

    /**
     * Stop discards the game. Switching tabs does NOT call this, which is
     * precisely what lets the state survive the unmount.
     */
    stopChannel(channelObject: IChannelObject): boolean {
        const asteroidsData: IAsteroidsData = channelObject.data
        const asteroidsConfig: IAsteroidsConfig = channelObject.config
        if (asteroidsData.game && asteroidsData.game.state.score > asteroidsData.highScore) {
            asteroidsData.highScore = asteroidsData.game.state.score
        }
        void asteroidsConfig
        // The table (asteroidsData.scores) is NOT touched here: it is persistent and
        // survives the channel stop.
        asteroidsData.pendingScore = false
        asteroidsData.game = undefined
        asteroidsData.started = false
        asteroidsData.paused = false
        asteroidsData.score = 0
        asteroidsData.lives = 0
        asteroidsData.level = 0
        asteroidsData.gameOver = false
        asteroidsData.revision++
        return true
    }

    socketDisconnected(_channelObject: IChannelObject): boolean { return false }
    socketReconnect(_channelObject: IChannelObject): boolean { return false }
}
