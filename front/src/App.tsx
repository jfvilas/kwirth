import { useState, useRef, useEffect } from 'react'

// material & icons
import { AppBar, Box, Drawer, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person, BarChart, Terminal } from '@mui/icons-material'

// model
import { User } from './model/User'
import { Cluster } from './model/Cluster'

// components
import { RenameTab } from './components/RenameTab'
import { SaveBoard } from './components/board/SaveBoard'
import { SelectBoard }  from './components/board/SelectBoard'
import { ManageApiSecurity } from './components/security/ManageApiSecurity'
import { Login } from './components/Login'
import { ManageClusters } from './components/ManageClusters'
import { ManageUserSecurity } from './components/security/ManageUserSecurity'
import { ResourceSelector, IResourceSelected } from './components/ResourceSelector'
import { TabContent } from './components/TabContent'
import { SettingsUser } from './components/settings/SettingsUser'
import { SettingsCluster } from './components/settings/SettingsCluster'
import { MenuTab, MenuTabOption } from './menus/MenuTab'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { VERSION } from './version'
import { MsgBoxButtons, MsgBoxOk, MsgBoxOkError, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { KwirthData, MetricsConfigModeEnum, InstanceMessage, versionGreatThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageActionEnum, MetricsConfig, OpsConfig, OpsCommandEnum, OpsMessageResponse, parseResources, TrivyConfig, TrivyMessageResponse, TrivyMessage, TrivyCommandEnum } from '@jfvilas/kwirth-common'
import { ITabObject } from './model/ITabObject'

import { IMetricsMessage, MetricsEventSeverityEnum, MetricsObject } from './channels/metrics/MetricsObject'
import { MetricDescription } from './channels/metrics/MetricDescription'
import { SetupMetrics } from './channels/metrics/SetupMetrics'

import { SetupTrivy } from './channels/trivy/SetupTrivy'
import { TrivyObject } from './channels/trivy/TrivyObject'

import { OpsObject } from './channels/ops/OpsObject'
import { OPSWELCOMEMESSAGE } from './tools/Constants'

import { EchoChannel } from './channels/echo/EchoChannel'
import { AlertChannel } from './channels/alert/AlertChannel'

import { IBoard } from './model/IBoard'
import { FirstTimeLogin } from './components/FirstTimeLogin'
import { ChannelConstructor, IChannel, IChannelMessageAction, ISetupProps } from './channels/IChannel'
import { LogChannel } from './channels/log/LogChannel'

const App: React.FC = () => {
    var backendUrl='http://localhost:3883'
    const rootPath = window.__PUBLIC_PATH__ || ''
    if ( process.env.NODE_ENV==='production') backendUrl=window.location.protocol+'//'+window.location.host
    backendUrl=backendUrl+rootPath

    const [frontChannels] = useState<Map<string, ChannelConstructor>>(new Map())
    const [user, setUser] = useState<User>()
    const [logged,setLogged]=useState(false)
    const [firstLogin,setFirstLogin]=useState(false)
    const [accessString,setAccessString]=useState('')
    const [msgBox, setMsgBox] =useState(<></>)

    const [clusters, setClusters] = useState<Cluster[]>([])
    const clustersRef = useRef(clusters)
    clustersRef.current = clusters
    const [selectedClusterName, setSelectedClusterName] = useState<string>()

    const [tabs, setTabs] = useState<ITabObject[]>([])
    const [pendingTabs, setPendingTabs] = useState<ITabObject[]>([])
    const [pausedTabs, setPausedTabs] = useState<ITabObject[]>([])

    //+++ we should use the tab, not the tabname
    const [selectedTabName, setSelectedTabName] = useState<string>()
    const selectedTabRefName = useRef(selectedTabName)
    selectedTabRefName.current=selectedTabName
    let selectedTab = tabs.find(t => t.name===selectedTabName)
    let selectedTabIndex = tabs.findIndex(t => t.name===selectedTabName)

    const [refreshTabContent, setRefreshTabContent] = useState(0)

    // general
    const [settings, setSettings] = useState<Settings>()
    const settingsRef = useRef(settings)
    settingsRef.current = settings

    const [channels, setChannels] = useState<string[]>([])
    const channelsRef = useRef(channels)
    channelsRef.current= channels

    // menus/navigation
    const [anchorMenuTab, setAnchorMenuTab] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // boards
    const [boardLoaded, setBoardLoaded] = useState<boolean>(false)
    const [currentBoardName, setCurrentBoardName] = useState('')
    const [currentBoardDescription, setCurrentBoardDescription] = useState('')
    const [boards, setBoards] = useState<{name:string, description:string}[]>([])
    const [selectBoardAction, setSelectBoardAction] = useState('')

    // components
    const [showRenameTab, setShowRenameLog]=useState<boolean>(false)
    const [showManageClusters, setShowManageClusters]=useState<boolean>(false)
    const [showSaveBoard, setShowSaveBoard]=useState<boolean>(false)
    const [showSelectBoard, setShowSelectBoard]=useState<boolean>(false)
    const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false)
    const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false)
    const [showSettingsUser, setShowSettingsUser]=useState<boolean>(false)
    const [showSettingsCluster, setShowSettingsCluster]=useState<boolean>(false)
    const [initialMessage, setInitialMessage]=useState<string>('')
    const [showSetupMetrics, setShowSetupMetrics]=useState<boolean>(false)
    const [showSetupTrivy, setShowSetupTrivy]=useState<boolean>(false)

    const createChannelInstance = (type: string): IChannel | null => {
        const channelClass = frontChannels.get(type)
        return channelClass ? new channelClass() : null
    }

    useEffect( () => {
        // only firt time
        frontChannels.set('log', LogChannel)
        frontChannels.set('echo', EchoChannel)
        frontChannels.set('alert', AlertChannel)
    })

    useEffect ( () => {
        // only when user logs on / off
        if (logged) {
            if (clustersRef.current.length===0) getClusters()
            if (!settingsRef.current) readSettings()
        }
    },[logged])

    useEffect ( () => {
        // when loading a board and user logged on
        if (logged) {
            setBoardLoaded(false)
            if (tabs.length>0) {
                for(let tab of tabs) {
                    let clusterName = tab.channelObject?.clusterName
                    let cluster = clusters!.find(c => c.name === clusterName)

                    if (cluster) startSocket(tab, cluster, () => {
                        setKeepAlive(tab)
                        startChannel(tab)
                    })                    
                }
                onChangeTab(null, tabs[0].name)
            }
        }
    }, [boardLoaded])

    const getClusters = async () => {
        // get current cluster
        let response = await fetch(`${backendUrl}/config/cluster`, addGetAuthorization(accessString))
        let srcCluster = await response.json() as Cluster
        srcCluster.url = backendUrl
        srcCluster.accessString = accessString
        srcCluster.source = true
        srcCluster.enabled = true
        response = await fetch(`${backendUrl}/config/version`, addGetAuthorization(accessString))
        srcCluster.kwirthData = await response.json() as KwirthData
        if (versionGreatThan(srcCluster.kwirthData.version, srcCluster.kwirthData.lastVersion)) {
            setInitialMessage(`You have Kwirth version ${srcCluster.kwirthData.version} installed. A new version is available (${srcCluster.kwirthData.version}), it is recommended to update your Kwirth deployment. If you're a Kwirth admin and you're using 'latest' tag, you can update Kwirth from the main menu.`)
        }

        // get previously configured clusters
        let clusterList:Cluster[]=[]
        response = await fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addGetAuthorization(accessString))
        if (response.status===200) {
            clusterList = JSON.parse (await response.json())
            clusterList = clusterList.filter (c => c.name !== srcCluster.name)
        }
        clusterList.push(srcCluster)
        for (let cluster of clusterList)
            setClusterStatus(cluster)
        setClusters(clusterList)
    }

    const setClusterStatus = async (cluster:Cluster): Promise<void> => {
        if (await readClusterInfo(cluster)) {
            cluster.enabled = true
            if (cluster.channels.includes('metrics')) {
                await getMetricsNames(cluster)
                let data = await (await fetch (`${cluster.url}/metrics/config`, addGetAuthorization(cluster.accessString))).json()
                cluster.metricsInterval = data.metricsInterval
            }
        }
        else {
            cluster.enabled = false
        }
    }

    const readClusterInfo = async (cluster: Cluster): Promise<boolean> => {
        try {
            let response = await fetch(`${cluster.url}/config/version`, addGetAuthorization(cluster.accessString))
            if (response.status===200) {
                let  json = await response.json()
                if (json) {
                    cluster.kwirthData = json
                    return true
                }
            }
        }
        catch (error) {}
        return false
    }

    const readSettings = async () => {
        let resp = await fetch (`${backendUrl}/store/${user?.id}/settings/general`, addGetAuthorization(accessString))
        if (resp.status===200) {
            var json=await resp.json()
            if (json) {
                var readSettings:Settings=JSON.parse(json) as Settings
                setSettings(readSettings)
            }
        }
        else {
            setSettings(new Settings())
            writeSettings(new Settings())
        }
    }

    const writeSettings = async (newSettings:Settings) => {
        setSettings(newSettings)
        let payload=JSON.stringify(newSettings)
        fetch (`${backendUrl}/store/${user?.id}/settings/general`, addPostAuthorization(accessString, payload))
    }

    const onChangeCluster = (clusterName:string) => {
        if (!clusters) return
        let cluster = clusters.find(c => c.name === clusterName)
        if (cluster) {
            setSelectedClusterName(clusterName)
            let usableChannels = [...cluster.channels]
            usableChannels = usableChannels.filter(c => c === InstanceMessageChannelEnum.METRICS ||c === InstanceMessageChannelEnum.OPS || c === InstanceMessageChannelEnum.TRIVY || Array.from(frontChannels.keys()).includes(c))
            console.log('usableChannels',usableChannels)
            setChannels(usableChannels)
        }
    }

    const startSocket = (tab:ITabObject, cluster:Cluster, fn: () => void) => {
        tab.ws = new WebSocket(cluster.url)
        tab.ws.onopen = fn
    }

    const onResourceSelectorAdd = (selection:IResourceSelected) => {
        let cluster = clusters.find(c => c.name===selection.clusterName)
        if (!cluster) {
            setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at tab configuration ${selection.clusterName} does not exist.`, setMsgBox))
            return
        }

        let tabName = selection.suggestedName
        // create unduplicated (unique) name (adding a '-number' suffix)
        let index = -1
        while (tabs.find (t => t.name === tabName + index.toString())) index -= 1

        let newTab:ITabObject = {
            name: tabName+index.toString(),
            ws: undefined,
            keepaliveRef: 60,
            defaultTab: false,
            channel: undefined,
            channelId: selection.channel,
            channelObject: {
                clusterName: selection.clusterName,
                instanceId: '',
                view: selection.view as InstanceConfigViewEnum,
                namespace: selection.namespaces.join(','),
                group: selection.groups.join(','),
                pod: selection.pods.join(','),
                container: selection.containers.join(','),
                instanceConfig: undefined,
                uiConfig: undefined,
                uiData: undefined
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false
        }

        switch(selection.channel) {
            case InstanceMessageChannelEnum.METRICS:
                let metricsObject = new MetricsObject()
                metricsObject.interval = settingsRef.current?.metricsInterval || 60
                metricsObject.depth = settingsRef.current?.metricsDepth || 10
                metricsObject.width = settingsRef.current?.metricsWidth || 2
                metricsObject.chart = settingsRef.current?.metricsChart || 'line'
                metricsObject.mode = settingsRef.current?.metricsMode || MetricsConfigModeEnum.STREAM
                metricsObject.aggregate = settingsRef.current?.metricsAggregate || false
                metricsObject.merge = settingsRef.current?.metricsMerge || false
                metricsObject.stack = settingsRef.current?.metricsStack || false
                metricsObject.metrics = []
                newTab.channelObject.uiData = metricsObject
                break
            case InstanceMessageChannelEnum.OPS:
                let opsObject = new OpsObject()
                newTab.channelObject.uiData = opsObject
                opsObject.messages= []
                opsObject.shell = undefined
                opsObject.shells = []
                break
            case InstanceMessageChannelEnum.TRIVY:
                let trivyObject = new TrivyObject()
                newTab.channelObject.uiData = trivyObject
                trivyObject.maxCritical = settingsRef.current?.trivyMaxCritical || 2
                trivyObject.maxHigh = settingsRef.current?.trivyMaxHigh || 4
                trivyObject.maxMedium = settingsRef.current?.trivyMaxMedium || -1
                trivyObject.maxLow = settingsRef.current?.trivyMaxLow || -1
                break
            default:
                if (frontChannels.has(selection.channel)) {
                    newTab.channel = createChannelInstance(selection.channel)!
                    if (newTab.channel.initChannel(newTab.channelObject)) setRefreshTabContent(Math.random())
                }
                else {
                    console.log(`Error, invalid channel: `, selection.channel)
                    setMsgBox(MsgBoxOkError('Add resource', 'Channel is not supported', setMsgBox))
                }
                break
        }

        startSocket(newTab, cluster, () => {
            setKeepAlive(newTab)
        })
        setTabs((prev) => [...prev, newTab])
        setSelectedTabName(newTab.name)
    }

    const setKeepAlive = (tab:ITabObject) => {
        console.log(`WS connected: ${tab.ws?.url}`)
        tab.keepaliveRef = setInterval(() => {
            let instanceConfig:InstanceMessage = {
                action: InstanceMessageActionEnum.PING,
                channel: tab.channelId,
                flow: InstanceMessageFlowEnum.REQUEST,
                type: InstanceMessageTypeEnum.SIGNAL,
                instance: ''
            }

            if (tab.ws && tab.ws.readyState === WebSocket.OPEN) {
                tab.ws.send(JSON.stringify(instanceConfig))
            }
        }, (settings?.keepAliveInterval || 60) * 1000,'')  
    }

    const onChangeTab = (_event:any, tabName?:string)=> {
        let newTab = tabs.find(tab => tab.name === tabName)
        if (newTab) {
            if (newTab.channelObject) {
                newTab.channelPending = false
                setPendingTabs (pendingTabs.filter(t => t.channelObject && t.channelPending))
                setPausedTabs (pausedTabs.filter(t => t.channelObject && t.channelPaused))
                setRefreshTabContent(Math.random())
            }
            setSelectedTabName(tabName)
        }
    }

    const wsOnMessage = (wsEvent:any) => {
        let instanceMessage:InstanceMessage
        try {
            instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
        }
        catch (err:any) {
            console.log(err.stack)
            console.log(wsEvent.data)
            return
        }

        if (instanceMessage.action === InstanceMessageActionEnum.PING) {
            // nothing to do
            return
        }

        switch(instanceMessage.channel) {
            case InstanceMessageChannelEnum.NONE:
                // we receive keepalive responses through this channel
                break
            case InstanceMessageChannelEnum.METRICS:
                processMetricsMessage(wsEvent)
                break
            case InstanceMessageChannelEnum.OPS:
                processOpsMessage(wsEvent)
                break
            case InstanceMessageChannelEnum.TRIVY:
                processTrivyMessage(wsEvent)
                break
            default:
                if (frontChannels.has(instanceMessage.channel)) {
                    let tab = tabs.find(tab => tab.ws !== null && tab.ws === wsEvent.target)
                    if (!tab || !tab.channel || !tab.channelObject) return
                    if (tab.channel.processChannelMessage(tab.channelObject, wsEvent) === IChannelMessageAction.REFRESH) {
                        if (selectedTabRefName.current === tab.name) {
                            setRefreshTabContent(Math.random())
                        }
                        else {
                            setPendingTabs((prev)=> [...prev, tab!])
                        }
                    }
                }
                else {
                    console.log('Received invalid channel in message: ', instanceMessage)
                }
                break
        }
    }

    const getMetricsNames = async (cluster:Cluster) => {
        try {
            console.log(`Receiving metrics for cluster ${cluster.name}`)
            cluster.metricsList=new Map()
            var response = await fetch (`${cluster.url}/metrics`, addGetAuthorization(cluster.accessString))
            var json=await response.json() as MetricDescription[]
            json.map( jsonMetric => cluster.metricsList.set(jsonMetric.metric, jsonMetric))
            console.log(`Metrics for cluster ${cluster.name} have been received (${Array.from(cluster.metricsList.keys()).length})`)
        }
        catch (err) {
            console.log('Error obtaining metrics list')
            console.log(err)
        }
    }

    const processMetricsMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as IMetricsMessage
        var tab=tabs.find(tab => tab.ws !== null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        let metricsObject = tab.channelObject.uiData as MetricsObject
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                metricsObject.assetMetricsValues.push(msg)
                if (metricsObject.assetMetricsValues.length > metricsObject.depth) {
                    metricsObject.assetMetricsValues.shift()
                }
                if (!tab.channelPaused) setRefreshTabContent(Math.random())
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let instanceMessage = JSON.parse(wsEvent.data) as InstanceMessage
                if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.START) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    if (signalMessage.level === SignalMessageLevelEnum.INFO) {
                        tab.channelObject.instanceId = instanceMessage.instance
                    }
                    else {
                        metricsObject.events.push( { severity: (signalMessage.level as string) as MetricsEventSeverityEnum, text: signalMessage.text })
                        setRefreshTabContent(Math.random())
                    }
                }
                else if (instanceMessage.flow === InstanceMessageFlowEnum.RESPONSE && instanceMessage.action === InstanceMessageActionEnum.RECONNECT) {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: signalMessage.text })
                }
                else {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                        metricsObject.events.push( { severity: MetricsEventSeverityEnum.ERROR, text: signalMessage.text })
                        setRefreshTabContent(Math.random())
                    }
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
    }

    function cleanANSI(text: string): string {
        const regexAnsi = /\x1b\[[0-9;]*[mKHVfJrcegH]|\x1b\[\d*n/g;
        return text.replace(regexAnsi, '') // replace all matches with empty strings
    }

    const processOpsMessage = (wsEvent:any) => {
        let opsMessage = JSON.parse(wsEvent.data) as OpsMessageResponse
        let tab = tabs.find(tab => tab.ws !== null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        let opsObject = tab.channelObject.uiData as OpsObject
        switch (opsMessage.type) {
            case InstanceMessageTypeEnum.DATA:
                if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE) {
                    switch (opsMessage.command) {
                        case OpsCommandEnum.SHELL:
                            // it's a response for a shell session start, so we add shell session to shells array
                            let newShell = {
                                namespace: opsMessage.namespace,
                                pod: opsMessage.pod,
                                container: opsMessage.container,
                                lines: [],
                                connected: true,
                                id: opsMessage.id
                            }
                            let index = opsObject.shells.findIndex(s => s.connected === false)
                            if (index>=0)
                                opsObject.shells[index] = newShell
                            else
                                opsObject.shells.push (newShell)
                            opsObject.shell = opsObject.shells[opsObject.shells.length-1]
                            setRefreshTabContent(Math.random())
                            break
                        default:
                            if (typeof opsMessage.data !== 'string')
                                opsObject.messages.push(JSON.stringify(opsMessage.data))
                            else
                                opsObject.messages.push(opsMessage.data)
                                setRefreshTabContent(Math.random())
                                break
                        }
                }
                else {
                    let shell = opsObject.shells.find (s => s.id === opsMessage.id)
                    if (shell) {
                        shell.lines.push(cleanANSI(opsMessage.data))
                        if (opsObject.shell) setRefreshTabContent(Math.random())  //+++ and visible shell is destination shell
                    }
                    else {
                        opsObject.messages.push(opsMessage.data)
                        setRefreshTabContent(Math.random())
                    }
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                if (opsMessage.flow === InstanceMessageFlowEnum.RESPONSE && opsMessage.action === InstanceMessageActionEnum.COMMAND) {
                    if (opsMessage.command === OpsCommandEnum.SHELL) {
                        opsObject.shell = undefined
                        opsObject.messages.push(`Shell session to ${opsMessage.namespace}/${opsMessage.pod}/${opsMessage.container} ended`)
                        if (opsMessage.data) opsObject.messages.push(opsMessage.data)
                        let shell = opsObject.shells.find (c => c.namespace === opsMessage.namespace && c.pod === opsMessage.pod && c.container === opsMessage.container)
                        if (shell) shell.connected = false
                    }
                    else {
                        opsObject.messages.push(opsMessage.data)
                    }
                    setRefreshTabContent(Math.random())
                    return
                }
                let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                    tab.channelObject.instanceId = signalMessage.instance
                    opsObject.messages.push(signalMessage.text)
                    setRefreshTabContent(Math.random())
                }
                else {
                    console.log('wsEvent.data on ops')
                    console.log(wsEvent.data)                    
                }
                break
            default:
                console.log(`Invalid message type ${opsMessage.type}`)
                break
        }
    }

    const processTrivyMessage = (wsEvent:any) => {
        let trivyMessageResponse = JSON.parse(wsEvent.data) as TrivyMessageResponse
        let tab = tabs.find(tab => tab.ws !== null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        switch (trivyMessageResponse.type) {
            case InstanceMessageTypeEnum.DATA:
                if (trivyMessageResponse.flow === InstanceMessageFlowEnum.RESPONSE && trivyMessageResponse.action === InstanceMessageActionEnum.COMMAND) {
                    if (trivyMessageResponse.data) {
                        setRefreshTabContent(Math.random())
                        let trivyObject = tab.channelObject.uiData as TrivyObject
                        trivyObject.score = trivyMessageResponse.data.score
                    }
                }
                else if (trivyMessageResponse.flow === InstanceMessageFlowEnum.UNSOLICITED) {
                    let trivyObject = tab.channelObject.uiData as TrivyObject
                    console.log()
                    let asset = trivyMessageResponse.data
                    switch (trivyMessageResponse.msgsubtype) {
                        case 'score':
                            console.log('newscore',trivyMessageResponse.data.score)
                            trivyObject.score = trivyMessageResponse.data.score
                            break
                        case 'add':
                            trivyObject.known.push(asset)
                            break
                        case 'update':
                        case 'delete':
                            console.log(trivyObject.known)
                            console.log(asset)
                            trivyObject.known = (trivyObject.known as any[]).filter(a => a.namespace !== asset.namespace || a.name !== asset.name || a.container !== asset.container)
                            if (trivyMessageResponse.msgsubtype==='update') trivyObject.known.push(asset)
                            break
                        default:
                            console.log('Invalid msgsubtype: ', trivyMessageResponse.msgsubtype)
                    }
                    trivyObject.known = [...trivyObject.known]
                    setRefreshTabContent(Math.random())
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                if (signalMessage.flow === InstanceMessageFlowEnum.RESPONSE && signalMessage.action === InstanceMessageActionEnum.START) {
                    tab.channelObject.instanceId = signalMessage.instance
                    trivyRequestScore(tab)
                }
                else {
                    if (signalMessage.level!== SignalMessageLevelEnum.INFO) {
                        console.log('SIGNAL RECEIVED')
                        console.log(wsEvent.data)
                    }
                }
                break
            default:
                console.log(`Invalid message type ${trivyMessageResponse.type}`)
                break
        }
    }
    
    const trivyRequestScore = (tab:ITabObject) => {
        let triviMessage: TrivyMessage = {
            msgtype: 'trivymessage',
            id: '1',
            accessKey: accessString,
            instance: tab.channelObject.instanceId,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            command: TrivyCommandEnum.SCORE,
            action: InstanceMessageActionEnum.COMMAND,
            flow: InstanceMessageFlowEnum.REQUEST,
            type: InstanceMessageTypeEnum.DATA,
            channel: InstanceMessageChannelEnum.TRIVY
        }
        tab.ws?.send(JSON.stringify(triviMessage))
    }

    const onClickChannelStart = () => {
        switch (selectedTab?.channelId) {
            case InstanceMessageChannelEnum.METRICS:
                setShowSetupMetrics(true)
                break
            case InstanceMessageChannelEnum.OPS:
                startChannel(selectedTab)
                break
            case InstanceMessageChannelEnum.TRIVY:
                setShowSetupTrivy(true)
                break
            default:
                if (selectedTab && selectedTab.channel) {
                    selectedTab.channel.setSetupVisibility(true)
                }
                else {
                    console.log(`Unsupported channel ${selectedTab?.channelId}`)
                }
        }
    }

    const socketReconnect = (wsEvent:any, id:NodeJS.Timer) => {
        clearInterval(id)
        console.log('Reconnected, will reconfigure socket')
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return

        let instanceConfig:InstanceConfig = {
            channel: tab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.RECONNECT,
            instance: tab.channelObject.instanceId,
            scope: InstanceConfigScopeEnum.NONE,
            accessKey: '',
            view: InstanceConfigViewEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: InstanceMessageTypeEnum.SIGNAL
        }
        if (wsEvent.target) {
            tab.ws = wsEvent.target
            tab.ws!.onerror = (event) => socketDisconnect(event)
            tab.ws!.onmessage = (event) => wsOnMessage(event)
            tab.ws!.onclose = (event) => socketDisconnect(event)
            tab.ws!.send(JSON.stringify(instanceConfig))
        }
        else {
            console.log('Target not set on reconnect')
        }
    }

    const socketDisconnect = (wsEvent:any) => {
        console.log('Reconnecting...')
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return
        if (tab.ws) {
            tab.ws.onerror = null
            tab.ws.onmessage = null
            tab.ws.onclose = null
            tab.ws = undefined
        }
        let cluster = clusters.find(c => c.name === tab!.channelObject!.clusterName)
        if (!cluster) return

        switch (tab.channelId) {
            case InstanceMessageChannelEnum.METRICS:
                let metricsObject = tab.channelObject.uiData as MetricsObject
                metricsObject.events.push( { severity: MetricsEventSeverityEnum.INFO, text: '*** Lost connection ***' })
                break
            case InstanceMessageChannelEnum.OPS:
            case InstanceMessageChannelEnum.TRIVY:
                console.log('Reconnect not implemented')
                break
            default:
                if (selectedTab && selectedTab.channel) {
                    if (selectedTab.channel.socketDisconnected(selectedTab.channelObject)) setRefreshTabContent(Math.random())
                }
                else {
                    console.log('Unsuppported channel on disconnect:', tab.channelId)
                }
                break
        }
        setRefreshTabContent(Math.random())


        let selfId = setInterval( (url, tab) => {
            console.log(`Trying to reconnect using ${url} and ${tab.channelObject.instanceId}`)
            try {
                let ws = new WebSocket(url)
                tab.ws = ws
                ws.onopen = (event) => socketReconnect(event, selfId)
            }
            catch  {}
        }, 10000, cluster.url, tab)
    }
    
    const startChannel = (tab:ITabObject) => {
        if (!tab || !tab.channelObject) {
            console.log('No active tab found')
            return
        }
        let cluster = clusters.find(c => c.name === tab.channelObject.clusterName)
        if (!cluster) {
            setMsgBox(MsgBoxOk('Kwirth',`Cluster set at channel configuration (${tab.channelObject.clusterName}) does not exist.`, setMsgBox))
            return
        }

        if (tab.ws && tab.ws.readyState === WebSocket.OPEN) {
            tab.ws.onerror = (event) => socketDisconnect(event)
            tab.ws.onmessage = (event) => wsOnMessage(event)
            tab.ws.onclose = (event) => socketDisconnect(event)
    
            var instanceConfig: InstanceConfig = {
                channel: tab.channelId,
                objects: InstanceConfigObjectEnum.PODS,
                action: InstanceMessageActionEnum.START,
                flow: InstanceMessageFlowEnum.REQUEST,
                instance: '',
                accessKey: cluster.accessString,
                scope: InstanceConfigScopeEnum.NONE,
                view: tab.channelObject.view,
                namespace: tab.channelObject.namespace,
                group: tab.channelObject.group,
                pod: tab.channelObject.pod,
                container: tab.channelObject.container,
                type: InstanceMessageTypeEnum.SIGNAL
            }
            switch (tab.channelId) {
                case InstanceMessageChannelEnum.METRICS:
                    let metricsObject = tab.channelObject.uiData as MetricsObject
                    metricsObject.events = []
                    metricsObject.assetMetricsValues=[]
                    let metricsConfig:MetricsConfig = {
                        mode: metricsObject.mode,
                        aggregate: metricsObject.aggregate,
                        interval: metricsObject.interval,
                        metrics: metricsObject.metrics,
                    }
                    instanceConfig.scope = InstanceConfigScopeEnum.STREAM
                    instanceConfig.data = metricsConfig
                    break
                case InstanceMessageChannelEnum.OPS:
                    let opsObject = tab.channelObject.uiData as OpsObject
                    opsObject.accessKeyString = cluster.accessString
                    opsObject.messages.push(...OPSWELCOMEMESSAGE)
                    opsObject.shell = undefined
                    opsObject.shells = []
                    let opsConfig:OpsConfig = {
                    }
                    instanceConfig.scope = InstanceConfigScopeEnum.GET // we ask for minimum scope
                    instanceConfig.data = opsConfig
                    break
                case InstanceMessageChannelEnum.TRIVY:
                    let trivyObject = tab.channelObject.uiData as TrivyObject
                    trivyObject.accessKeyString = cluster.accessString
                    trivyObject.score = 0
                    trivyObject.known = []
                    trivyObject.unknown = []
                    let trivyConfig:TrivyConfig = {
                        maxCritical: trivyObject.maxCritical,
                        maxHigh: trivyObject.maxHigh,
                        maxMedium: trivyObject.maxMedium,
                        maxLow: trivyObject.maxLow
                    }
                    instanceConfig.scope = InstanceConfigScopeEnum.WORKLOAD
                    instanceConfig.data = trivyConfig
                    break
                default:
                if (selectedTab && selectedTab.channel) {
                        instanceConfig.scope = selectedTab.channel.getScope()
                        instanceConfig.data = tab.channelObject.instanceConfig
                        selectedTab.channel.startChannel(selectedTab.channelObject)
                    }
                    else {
                        console.log('Channel is not supported')
                    }
                    break
            }
            tab.ws.send(JSON.stringify(instanceConfig))
            tab.channelStarted = true
            tab.channelPaused = false
        }
        else {
            console.log('Tab web socket is not started')
        }
    }

    const onClickChannelStop = () => {
        setAnchorMenuTab(null)
        if (selectedTab && selectedTab.channelObject) stopChannel(selectedTab)
    }

    const stopChannel = (tab:ITabObject) => {
        if (!tab || !tab.channelObject) return
        let cluster = clusters.find(c => c.name === tab.channelObject.clusterName)

        if (!cluster) return
        let instanceConfig: InstanceConfig = {
            channel: tab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.STOP,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: tab.channelObject.instanceId,
            accessKey: cluster.accessString,
            view: tab.channelObject.view,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: '',
            type: InstanceMessageTypeEnum.SIGNAL
        }
        switch (tab.channelId) {
            case InstanceMessageChannelEnum.METRICS:
                break
            case InstanceMessageChannelEnum.OPS:
                let dataOps = tab.channelObject.uiData as OpsObject
                dataOps.messages.push('=========================================================================')
                setRefreshTabContent(Math.random())
                break
            case InstanceMessageChannelEnum.TRIVY:
                //let dataTrivy = tab.channelObject.data as TrivyObject
                setRefreshTabContent(Math.random())
                break
            default:
                if (selectedTab && selectedTab.channel) {
                    if (selectedTab.channel.stopChannel(selectedTab.channelObject)) setRefreshTabContent(Math.random())
                }
                else {
                    console.log('Channel is not supported on stop:',tab.channelId)
                }
                break
        }
        if (tab.ws) tab.ws.send(JSON.stringify(instanceConfig))
        tab.channelStarted = false
        tab.channelPaused = false
    }

    const onClickChannelPause = () => {
        setAnchorMenuTab(null)
        if (!selectedTab || !selectedTab.channelObject || !selectedTab.ws) return
        var cluster = clusters.find(c => c.name === selectedTab!.channelObject.clusterName)
        if(!cluster) return
        
        var instanceConfig:InstanceConfig = {
            channel: selectedTab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.PAUSE,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: selectedTab.channelObject?.instanceId,
            accessKey: cluster.accessString,
            scope: InstanceConfigScopeEnum.NONE,
            view: selectedTab.channelObject.view,
            namespace: selectedTab.channelObject.namespace,
            group: selectedTab.channelObject.group,
            pod: selectedTab.channelObject.pod,
            container: selectedTab.channelObject.container,
            type: InstanceMessageTypeEnum.SIGNAL
        }

        if (selectedTab.channelPaused) {
            selectedTab.channelPaused = false
            setPausedTabs(tabs.filter(t => t.channelPaused))
            instanceConfig.action = InstanceMessageActionEnum.CONTINUE
        }
        else {
            selectedTab.channelPaused = true
            setPausedTabs( (prev) => [...prev, selectedTab!])
            instanceConfig.action = InstanceMessageActionEnum.PAUSE
        }
        selectedTab.ws.send(JSON.stringify(instanceConfig))
    }

    const stopTab = (tab:ITabObject) => {
        if (tab.channelObject) stopChannel(tab)
    }

    const onClickTabRemove = () => {
        setAnchorMenuTab(null)
        if (!selectedTab) return

        if (selectedTab.channelObject) stopChannel(selectedTab)

        if (selectedTab.ws) {
            selectedTab.ws.onopen = null
            selectedTab.ws.onerror = null
            selectedTab.ws.onmessage = null
            selectedTab.ws.onclose = null
        }

        selectedTab.ws?.close()
        clearInterval(selectedTab.keepaliveRef)
        let current = tabs.findIndex(t => t === selectedTab)
        let newTabs= tabs.filter(t => t !== selectedTab)

        if (current >= newTabs.length) current--
        if (current>=0 && current<newTabs.length) {
            newTabs[current].channelPending = false
            setPendingTabs (pendingTabs.filter(t => t.channelObject && t.channelPending))
        setSelectedTabName(newTabs[current].name)
        }
        setTabs(newTabs)
    }

    const menuTabOptionSelected = (option: MenuTabOption) => {
        setAnchorMenuTab(null)
        switch(option) {
            case MenuTabOption.TabInfo:
                if (selectedTab) {
                    var a=`
                        <b>Tab type</b>: ${selectedTab.channelId}</br>
                        <b>Cluster</b>: ${selectedTab.channelObject.clusterName}</br>
                        <b>View</b>: ${selectedTab.channelObject.view}<br/>
                        <b>Namespace</b>: ${selectedTab.channelObject.namespace}<br/>
                        <b>Group</b>: ${selectedTab.channelObject.group}<br/>
                        <b>Pod</b>: ${selectedTab.channelObject.pod}<br/>
                        <b>Container</b>: ${selectedTab.channelObject.container}
                    `
                    setMsgBox(MsgBoxOk('Tab info',a,setMsgBox))
                }
                break
            case MenuTabOption.TabRename:
                setShowRenameLog(true)
                break
            case MenuTabOption.TabMoveLeft:
                if (selectedTab) {
                    tabs[selectedTabIndex]=tabs[selectedTabIndex-1]
                    tabs[selectedTabIndex-1]=selectedTab
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveRight:
                if (selectedTab) {
                    tabs[selectedTabIndex]=tabs[selectedTabIndex+1]
                    tabs[selectedTabIndex+1]=selectedTab
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveFirst:
                if (selectedTab) {
                    tabs.splice(selectedTabIndex, 1)
                    tabs.splice(0, 0, selectedTab)
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveLast:
                if (selectedTab) {
                    tabs.splice(selectedTabIndex, 1)
                    tabs.push(selectedTab)
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabRemove:
                onClickTabRemove()
                break
            case MenuTabOption.TabSetDefault:
                if (selectedTab && selectedTab.channelObject) selectedTab.defaultTab=true
                break
            case MenuTabOption.ChannelStart:
                onClickChannelStart()
                break
            case MenuTabOption.ChannelPause:
                onClickChannelPause()
                break
            case MenuTabOption.ChannelStop:
                onClickChannelStop()
                break
        }
    }

    const saveBoard = (name:string, description:string) => {
        var newTabs:ITabObject[] = []
        for (var tab of tabs) {
            var newTab:ITabObject = {
                name: tab.name,
                defaultTab: tab.defaultTab,
                ws: undefined,
                keepaliveRef: 0,
                channel: undefined,
                channelId: tab.channelId,
                channelObject: JSON.parse(JSON.stringify(tab.channelObject)),
                channelStarted: false,
                channelPaused: false,
                channelPending: false
            }
            switch(tab.channelId) {
                case InstanceMessageChannelEnum.METRICS:
                    (newTab.channelObject.uiData as MetricsObject).assetMetricsValues = []
                    break
                case InstanceMessageChannelEnum.OPS:
                    break
                case InstanceMessageChannelEnum.TRIVY:
                    break
                default:
                    if (selectedTab && selectedTab.channel) {
                        // we only need uiConfig and instanceConfig
                        delete newTab.channelObject.uiData
                    }
                    else {
                        console.log('Channel not supported on saveBoard:',tab.channelId)
                    }
                    break

            }
            newTabs.push(newTab)
        }
        let board:IBoard = {
            name,
            description,
            tabs: newTabs
        }
        var payload=JSON.stringify( board )
        fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addPostAuthorization(accessString, payload))
        if (currentBoardName !== name) {
            setCurrentBoardName(name)
            setCurrentBoardDescription(description)
        }
    }

    const onSaveBoardClosed = (name?:string, description?:string) => {
        setShowSaveBoard(false)
        if (name) saveBoard(name, description||'No description')
    }

    const onSelectBoardClosed = async (action:string, name?:string) => {
        setShowSelectBoard(false)
        if (name) {
            if (action === 'delete') {
                setMsgBox(MsgBoxYesNo('Delete board',`Are you sure you want to delete board ${name} (you cannot undo this action)?`, setMsgBox, (button) => {
                    if (button===MsgBoxButtons.Yes) {
                        fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addDeleteAuthorization(accessString))
                        if (name === currentBoardName) {
                            setCurrentBoardName('untitled')
                            setCurrentBoardDescription('No description yet')                            
                        }
                    }
                }))
            }
            else if (action === 'load') {
                clearTabs()
                var boardDef = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addGetAuthorization(accessString))).json()
                var board = JSON.parse(boardDef) as IBoard
                let errors = ''
                for (let t of board.tabs) {
                    let clusterName = t.channelObject.clusterName
                    if (!clusters.find(c => c.name === clusterName)) {
                        errors += `Cluster '${clusterName}' used in tab ${t.name} does not exsist<br/><br/>`
                    }
                }
                if (errors!=='') setMsgBox(MsgBoxOkError('Kwirth',`Some errors have been detected when loading board:<br/><br/>${errors}`, setMsgBox))
                setTabs(board.tabs)
                setCurrentBoardName(name)
                setCurrentBoardDescription(board.description)
                setBoardLoaded(true)
            }
        }
    }

    const showNoBoards = () => {
        setMsgBox(MsgBoxOk('Board management','You have no boards stored in your personal Kwirth space', setMsgBox))
    }

    const getBoards = async () => {
        var allBoards:IBoard[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards?full=true`, addGetAuthorization(accessString))).json()
        if (allBoards.length===0) {
            showNoBoards()
            return undefined
        }
        else {
            var values = allBoards.map( b => {
                let name=Object.keys(b)[0]
                let board = JSON.parse((b as any)[name]) as IBoard
                return { name: board.name,  description: board.description }
            })
            return values
        }
    }

    const clearTabs = () => {
        for (var tab of tabs) {
            stopTab(tab)
        }
        setTabs([])
    }

    const menuDrawerOptionSelected = async (option:MenuDrawerOption) => {
        setMenuDrawerOpen(false)
        switch(option) {
            case MenuDrawerOption.NewBoard:
                clearTabs()
                setCurrentBoardName('untitled')
                setCurrentBoardDescription('No description yet')
                break
            case MenuDrawerOption.SaveBoard:
                if (currentBoardName !== '' && currentBoardName !== 'untitled')
                    saveBoard(currentBoardName, currentBoardDescription)
                else {
                    setShowSaveBoard(true)
                }
                break
            case MenuDrawerOption.SaveBoardAs: {
                    let values = await getBoards()
                    if (values) {
                        setBoards(values)
                        setShowSaveBoard(true)
                }}
                break
            case MenuDrawerOption.LoadBoard: {
                let values = await getBoards()
                if (values) {
                    setBoards(values)
                    setSelectBoardAction ('load')
                    setShowSelectBoard(true)
                }}
                break
            case MenuDrawerOption.DeleteBoard: {
                let values = await getBoards()
                if (values) {
                    setBoards( values )
                    setSelectBoardAction ('delete')
                    setShowSelectBoard(true)
                }}
                break
            case MenuDrawerOption.ManageCluster:
                setShowManageClusters(true)
                break
            case MenuDrawerOption.ApiSecurity:
                setShowApiSecurity(true)
                break
            case MenuDrawerOption.UserSecurity:
                setShowUserSecurity(true)
                break
            case MenuDrawerOption.ExportBoards:
                var boardsToExport:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
                if (boardsToExport.length===0) {
                    showNoBoards()
                }
                else {
                    var content:any={}
                    for (var boardName of boardsToExport) {
                        var readBoard = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addGetAuthorization(accessString))).json()
                        content[boardName]=JSON.parse(readBoard)
                    }
                    handleDownload(JSON.stringify(content),`${user?.id}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`)
                }
                break
            case MenuDrawerOption.ImportBoards:
                // nothing to do, the menuitem launches the handleUpload
                break
            case MenuDrawerOption.SettingsUser:
                setShowSettingsUser(true)
                break
            case MenuDrawerOption.SettingsCluster:
                setShowSettingsCluster(true)
                break
            case MenuDrawerOption.UpdateKwirth:
                setMsgBox(MsgBoxYesNo('Update Kwirth',`This action will restart the Kwirth instance and users won't be able to work during 7 to 10 seconds. In addition, all volatile API keys will be deleted. Do you want to continue?`,setMsgBox, (button) => {
                    if (button===MsgBoxButtons.Yes) {
                        fetch (`${backendUrl}/managekwirth/restart`, addGetAuthorization(accessString))
                    }
                }))
                break
            case MenuDrawerOption.InstallTrivy:
                let result = await (await fetch (`${backendUrl}/config/trivy?action=install`, addGetAuthorization(accessString))).text()
                console.log(result)
                break
            case MenuDrawerOption.RemoveTrivy:
                let result2 = await (await fetch (`${backendUrl}/config/trivy?action=remove`, addGetAuthorization(accessString))).text()
                console.log(result2)
                break
            case MenuDrawerOption.Exit:
                setLogged(false)
                break
        }
    }

    const handleDownload = (content:string, filename:string,  mimeType:string='text/plain') => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const handleUpload = (event:any) => {
        setMenuDrawerOpen(false)        
        const file = event.target.files[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e:any) => {
                var allBoards=JSON.parse(e.target.result)
                for (var boardName of Object.keys(allBoards)) {
                    var payload=JSON.stringify(allBoards[boardName])
                    fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addPostAuthorization(accessString, payload))
                }
            }
            reader.readAsText(file)
        }
    }

    const onSettingsUserClosed = (newSettings:Settings|undefined) => {
        setShowSettingsUser(false)
        if (newSettings) writeSettings(newSettings)
    }

    const onSettingsClusterClosed = (readMetricsInterval:number|undefined) => {
        setShowSettingsCluster(false)
        
        if (!readMetricsInterval) return
        if (readMetricsInterval) {
            var cluster = clusters.find(c => c.name === selectedClusterName)
            if (cluster)  {
                cluster.metricsInterval = readMetricsInterval
                let payload = JSON.stringify( { metricsInterval: readMetricsInterval } )
                fetch (`${cluster.url}/metrics/config`, addPostAuthorization(cluster.accessString, payload))
            }
        }
    }

    const onSetupMetricsClosed = (metrics:string[], mode:MetricsConfigModeEnum, depth:number, width:number, interval:number, aggregate:boolean, merge:boolean, stack:boolean, type:string) => {
        setShowSetupMetrics(false)
        setAnchorMenuTab(null)
        if (metrics.length===0) return

        let tab=tabs.find(t => t.name===selectedTabRefName.current)
        if (!tab || !tab.channelObject) return

        let metricsObject = tab.channelObject.uiData as MetricsObject

        metricsObject.metrics = metrics
        metricsObject.mode = mode
        metricsObject.depth = depth
        metricsObject.width = width
        metricsObject.interval = interval
        metricsObject.aggregate = aggregate
        metricsObject.merge = merge
        metricsObject.stack = stack
        metricsObject.chart = type
        startChannel(tab)
    }

    const onSetupTrivyClosed = (maxCritical:number, maxHigh:number, maxMedium:number, maxLow:number) => {
        setShowSetupTrivy(false)
        setAnchorMenuTab(null)

        if (maxCritical<0 && maxHigh<0 && maxMedium<0 && maxLow<0) return

        let tab=tabs.find(t => t.name===selectedTabRefName.current)
        if (!tab || !tab.channelObject) return

        let trivyObject = tab.channelObject.uiData as TrivyObject
        trivyObject.maxCritical = maxCritical
        trivyObject.maxHigh = maxHigh
        trivyObject.maxMedium = maxMedium
        trivyObject.maxLow = maxLow
        startChannel(tab)
    }

    const onChannelSetupClosed = (channel:IChannel, start:boolean) => {
        channel.setSetupVisibility(false)
        setRefreshTabContent(Math.random())  // we force rendering because react doesn't detect changes inside one channel inside frontChannels
        if (start && selectedTab) startChannel(selectedTab)
    }

    const onRenameTabClosed = (newname:string|undefined) => {
        setShowRenameLog(false)
        if (!selectedTab || !newname) return

        selectedTab.name=newname
        setSelectedTabName(newname)
    }

    const onManageClustersClosed = (cc:Cluster[]) => {
        setShowManageClusters(false)
        let otherClusters = cc.filter (c => !c.source)
        var payload=JSON.stringify(otherClusters)
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addPostAuthorization(accessString, payload))
        for (var c of otherClusters) {
            setClusterStatus(c)
        }
        setClusters(cc)
    }

    const onLoginClose = (user:User|undefined, firstTime:boolean) => {
        if (user) {
            setLogged(true)
            setFirstLogin(firstTime)
            setUser(user)
            setAccessString(user.accessKey.id + '|' + user.accessKey.type + '|' + user.accessKey.resources)
            setCurrentBoardName('untitled')
            setCurrentBoardDescription('No description yet')
            clearTabs()
        }
    }

    const onFirstTimeLoginClose = (exit:boolean) => {
        setFirstLogin(false)
        if (exit) setLogged(false)
    }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessString: accessString, logged, backendUrl }}>
                <Login onClose={onLoginClose}></Login>
            </SessionContext.Provider>
        </div>
    </>)

    const showChannelSetup = () => {
        if (!selectedTab || !selectedTab.channel || !selectedTab.channel.getSetupVisibility()) return 
        const SetupDialog = selectedTab.channel.SetupDialog
        let props:ISetupProps = {
            channel: selectedTab.channel,
            onChannelSetupClosed: onChannelSetupClosed,
            channelObject: selectedTab?.channelObject
        }
        return <SetupDialog {...props} />
    }

    const formatTabName = (tab : ITabObject) => {
        if (!tab.name) return <>undefined</>

        let icon = <Box sx={{minWidth:'24px'}}/>
        if (tab.channelId === InstanceMessageChannelEnum.METRICS) icon = <BarChart sx={{mr:2}}/>
        else if (tab.channelId === InstanceMessageChannelEnum.OPS) icon = <Terminal sx={{mr:1}}/>
        else {
            if (tab.channel) {
                icon = tab.channel.getChannelIcon()
            }
        }
        let name = tab.name
        if (name.length>20) name = tab.name.slice(0, 8) + '...' + tab.name.slice(-8)
        return <>{icon}{name}</>
    }

    return (<>
        <SessionContext.Provider value={{ user, accessString: accessString, logged, backendUrl }}>
            <AppBar position='sticky' elevation={0} sx={{ zIndex: 99, height:'64px' }}>
                <Toolbar>
                    <IconButton size='large' edge='start' color='inherit' sx={{ mr: 1 }} onClick={() => setMenuDrawerOpen(true)}><Menu /></IconButton>
                    <Typography sx={{ ml:1,flexGrow: 1 }}>KWirth</Typography>
                    <Tooltip title={<div style={{textAlign:'center'}}>{currentBoardName}<br/><br/>{currentBoardDescription}</div>} sx={{ mr:2}} slotProps={{popper: {modifiers: [{name: 'offset', options: {offset: [0, -12]}}]}}}>
                        <Typography variant='h6' component='div' sx={{mr:2, cursor:'default'}}>{currentBoardName}</Typography>
                    </Tooltip>
                    <Tooltip title={<div style={{textAlign:'center'}}>{user?.id}<br/>{user?.name}<br/>[{user && parseResources(user.accessKey.resources).map(r=>r.scopes).join(',')}]</div>} sx={{ mr:2 }} slotProps={{popper: {modifiers: [{name: 'offset', options: {offset: [0, -6]}}]}}}>
                        <Person/>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Drawer sx={{ flexShrink: 0, '& .MuiDrawer-paper': {mt: '64px'} }} anchor="left" open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)}>
                <Stack direction={'column'}>
                    <MenuDrawer optionSelected={menuDrawerOptionSelected} uploadSelected={handleUpload} selectedClusterName={selectedClusterName} user={user||new User()}/>
                    <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} channels={channels} onAdd={onResourceSelectorAdd} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedTabName} onChange={onChangeTab} variant='scrollable' scrollButtons='auto' sx={{ml:1}}>
                        { tabs.length>0 && tabs.map(tab => {
                            if (tab === selectedTab) {
                                return <Tab key={tab.name} label={formatTabName(tab)} value={tab.name} icon={<IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (pendingTabs.includes(tab)?'pink':pausedTabs.includes(tab)?'#cccccc':'')}}/>
                            }
                            else {
                                return <Tab key={tab.name} label={formatTabName(tab)} value={tab.name} icon={<Box sx={{minWidth:'36px'}}/>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (pendingTabs.includes(tab)?'pink':pausedTabs.includes(tab)?'#cccccc':'')}}/>
                            }
                        })}
                    </Tabs>

                    <Typography sx={{ flexGrow: 1 }}></Typography>
                </Stack>

                { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs} selectedTab={selectedTab} selectedTabIndex={selectedTabIndex} />}
                <TabContent channel={selectedTab?.channel} webSocket={selectedTab?.ws} channelObject={selectedTab?.channelObject} refreshTabContent={refreshTabContent} />
            </Box>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs} oldname={selectedTab?.name}/> }
            { showSaveBoard && <SaveBoard onClose={onSaveBoardClosed} name={currentBoardName} description={currentBoardDescription} values={boards} /> }
            { showSelectBoard && <SelectBoard onSelect={onSelectBoardClosed} values={boards} action={selectBoardAction}/> }
            { showManageClusters && <ManageClusters onClose={onManageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }

            { showSetupMetrics && clusters && <SetupMetrics onClose={onSetupMetricsClosed} channelObject={selectedTab?.channelObject} metrics={clusters.find(c => c.name === selectedTab!.channelObject.clusterName)?.metricsList!} /> }
            { showSetupTrivy && <SetupTrivy onClose={onSetupTrivyClosed} channelObject={selectedTab?.channelObject} /> }
            { showChannelSetup() }

            { showSettingsUser && <SettingsUser onClose={onSettingsUserClosed} settings={settings} /> }
            { showSettingsCluster && clusters && <SettingsCluster onClose={onSettingsClusterClosed} clusterName={selectedClusterName} clusterMetricsInterval={clusters.find(c => c.name===selectedClusterName)?.metricsInterval} /> }
            { initialMessage !== '' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            { firstLogin && <FirstTimeLogin onClose={onFirstTimeLoginClose}/> }

            { msgBox }
        </SessionContext.Provider>
    </>)
}

export default App