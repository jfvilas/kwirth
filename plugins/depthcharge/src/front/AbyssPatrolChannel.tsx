import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceConfigScope, EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ENotifyLevel, ESignalMessageLevel, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { AbyssPatrolIcon } from './icons'
import { AbyssPatrolTabContent } from './AbyssPatrolTabContent'
import { AbyssPatrolConfig, AbyssPatrolInstanceConfig } from './AbyssPatrolConfig'
import { IAbyssPatrolData, AbyssPatrolData } from './AbyssPatrolData'
import { AbyssPatrolGame, EGameStatus } from './core/AbyssPatrolGame'

/**
 * The IChannel life cycle maps onto the game: start creates (or restarts) it, pause and continue
 * freeze it, stop discards it. The animation loop lives in the TabContent because it needs the canvas.
 */
export class AbyssPatrolChannel implements IChannel {
    private setupVisible = false
    // Nothing to set up: with requirements.setup false the core starts the channel straight away and never
    // opens this. The IChannel contract still asks for a component.
    SetupDialog: FC<ISetupProps> = () => null
    TabContent: FC<IContentProps> = AbyssPatrolTabContent
    channelId = 'depthcharge'

    requirements: IChannelRequirements = {
        accessString: true,
        clusterUrl: true,
        clusterInfo: false,
        exit: false,
        frontChannels: false,
        backChannels: false,
        metrics: false,
        notifier: true,
        notifications: false,
        setup: false,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true,
    }

    getScope = () => EInstanceConfigScope.NONE
    getChannelIcon = (): JSX.Element => AbyssPatrolIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    /*
        Nothing the back end sends alters the game. What matters is the START response: it carries the
        instance id the front end later uses to pause and stop, and a SIGNAL of level ERROR is a
        rejection that must reach the user instead of being swallowed.
    */
    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as ISignalMessage
        if (msg.type !== EInstanceMessageType.SIGNAL) return { action: EChannelRefreshAction.NONE }

        if (msg.level === ESignalMessageLevel.ERROR) {
            channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR, msg.text || 'The channel reported an error')
            return { action: EChannelRefreshAction.NONE }
        }
        if (msg.flow === EInstanceMessageFlow.RESPONSE && msg.action === EInstanceMessageAction.START) {
            if (!msg.instance) {
                channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR, 'The channel did not start: the server returned no instance.')
                return { action: EChannelRefreshAction.NONE }
            }
            channelObject.instanceId = msg.instance
            return { action: EChannelRefreshAction.REFRESH }
        }
        return { action: EChannelRefreshAction.NONE }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new AbyssPatrolData()
        channelObject.instanceConfig = new AbyssPatrolInstanceConfig()
        channelObject.config = new AbyssPatrolConfig()
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IAbyssPatrolData
        if (!data.game) data.game = new AbyssPatrolGame()
        else if (data.game.status === EGameStatus.Over) data.game.reset()
        data.started = true
        data.paused = false
        return true
    }

    pauseChannel = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IAbyssPatrolData).paused = true
        return true
    }

    continueChannel = (channelObject: IChannelObject): boolean => {
        (channelObject.data as IAbyssPatrolData).paused = false
        return true
    }

    /** Switching tabs does NOT call this, which is what lets the game survive the unmount. */
    stopChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as IAbyssPatrolData
        if (data.game) data.best = Math.max(data.best, data.game.score)
        data.game = undefined
        data.started = false
        data.paused = false
        return true
    }

    socketDisconnected = (_channelObject: IChannelObject): boolean => false
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
