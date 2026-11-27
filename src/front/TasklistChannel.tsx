import { FC } from 'react'
import { IChannel, IChannelRequirements, IChannelObject, IContentProps, ISetupProps, EChannelRefreshAction, IChannelMessageAction } from '@kwirthmagnify/kwirth-common-front'
import { EInstanceMessageAction, EInstanceMessageFlow, EInstanceMessageType, ENotifyLevel, ESignalMessageLevel, IInstanceMessage, IExtensionScope, ISignalMessage } from '@kwirthmagnify/kwirth-common'
import { TasklistSetup, TasklistIcon } from './TasklistSetup'
import { TasklistTabContent } from './TasklistTabContent'
import { ITasklistData, TasklistData } from './TasklistData'
import { ETasklistScope, ITasklistMessageResponse, TASKLIST_SCOPES } from '../common/TasklistTypes'
import { TasklistBackSource } from './TasklistBackSource'
import { TasklistSession } from './TasklistSession'

export class TasklistChannel implements IChannel {
    private setupVisible = false
    SetupDialog: FC<ISetupProps> = TasklistSetup
    TabContent: FC<IContentProps> = TasklistTabContent
    channelId = 'tasklist'

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
        // nothing to ask: the Task Manager opens as XP did, on the Processes tab
        setup: false,
        settings: false,
        palette: false,
        userSettings: false,
        webSocket: true,
    }

    // The scope the instance is opened with: the lowest that lets the Task Manager open.
    getScope = (): string => ETasklistScope.READ
    getScopeCatalog = (): IExtensionScope[] => TASKLIST_SCOPES
    getChannelIcon = (): JSX.Element => TasklistIcon
    getSetupVisibility = (): boolean => this.setupVisible
    setSetupVisibility = (v: boolean): void => { this.setupVisible = v }

    processChannelMessage = (channelObject: IChannelObject, wsEvent: MessageEvent): IChannelMessageAction => {
        const msg = JSON.parse(wsEvent.data) as IInstanceMessage
        const data = channelObject.data as ITasklistData
        if (msg.type === EInstanceMessageType.SIGNAL) {
            const signal = msg as ISignalMessage
            // A rejection from the core or the channel (no permission, for one): say it, do not swallow it.
            if (signal.level === ESignalMessageLevel.ERROR) {
                channelObject.notify?.(channelObject.channelId, ENotifyLevel.ERROR, signal.text || 'The Task Manager reported an error')
                return { action: EChannelRefreshAction.NONE }
            }
            if (signal.flow === EInstanceMessageFlow.RESPONSE && signal.action === EInstanceMessageAction.START && signal.instance) {
                channelObject.instanceId = signal.instance
                // the instance exists now: the session can ask for its first snapshot
                data.session?.connected()
                return { action: EChannelRefreshAction.REFRESH }
            }
            return { action: EChannelRefreshAction.NONE }
        }
        // An answer to the session: it repaints by itself through its listeners, nothing to refresh here.
        const response = msg as ITasklistMessageResponse
        if (response.msgtype === 'tasklistmessageresponse') data.source?.resolve(response)
        return { action: EChannelRefreshAction.NONE }
    }

    initChannel = async (channelObject: IChannelObject): Promise<boolean> => {
        channelObject.data = new TasklistData()
        channelObject.instanceConfig = {}
        channelObject.config = {}
        return false
    }

    startChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as ITasklistData
        // Restarting keeps nothing from the previous session.
        this.endSession(data, 'The channel was restarted.')
        data.source = new TasklistBackSource(channelObject)
        data.session = new TasklistSession(channelObject.clusterName || 'Kwirth', data.source)
        data.started = true
        return true
    }

    stopChannel = (channelObject: IChannelObject): boolean => {
        const data = channelObject.data as ITasklistData
        this.endSession(data, 'The channel was stopped.')
        data.started = false
        return true
    }

    // Another cluster is another machine: nothing of the old one stays (its PIDs, its graphs).
    onClusterSwitch = (channelObject: IChannelObject): void => {
        const data = channelObject.data as ITasklistData
        if (!data.session) return
        const state = data.session.state
        this.endSession(data, 'The cluster was switched.')
        data.source = new TasklistBackSource(channelObject)
        data.session = new TasklistSession(channelObject.clusterName || 'Kwirth', data.source)
        // how the window is set is the user's, not the cluster's
        data.session.state = state
    }

    private endSession = (data: ITasklistData, reason: string): void => {
        data.source?.rejectAll(reason)
        data.session?.dispose()
        data.session = undefined
        data.source = undefined
    }

    pauseChannel = (_channelObject: IChannelObject): boolean => true
    continueChannel = (_channelObject: IChannelObject): boolean => true
    // Nobody will answer what was asked over a socket that is gone: the session gets its error now, not in 30 s.
    socketDisconnected = (channelObject: IChannelObject): boolean => {
        (channelObject.data as ITasklistData).source?.rejectAll('The connection to Kwirth was lost.')
        return false
    }
    socketReconnect = (_channelObject: IChannelObject): boolean => false
}
