import { useState, useRef, useEffect } from 'react'

// material & icons
import { AppBar, Box, Drawer, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person, BarChart, Terminal, Warning, Subject } from '@mui/icons-material'

// model
import { User } from './model/User'
import { Cluster } from './model/Cluster'

// components
import RenameTab from './components/RenameTab'
import { SaveBoard } from './components/board/SaveBoard'
import { SelectBoard }  from './components/board/SelectBoard'
import { ManageApiSecurity } from './components/ManageApiSecurity'
import { Login } from './components/Login'
import { ManageClusters } from './components/ManageClusters'
import { ManageUserSecurity } from './components/ManageUserSecurity'
import { ResourceSelector, IResourceSelected } from './components/ResourceSelector'
import { TabContent } from './components/tab/TabContent'
import { SettingsUser } from './components/settings/SettingsUser'
import { SettingsCluster } from './components/settings/SettingsCluster'
import { MenuTab, MenuTabOption } from './menus/MenuTab'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { VERSION } from './version'
import { MsgBoxButtons, MsgBoxOk, MsgBoxOkError, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { KwirthData, MetricsConfigModeEnum, InstanceMessage, versionGreatThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageActionEnum, LogConfig, AlertConfig, MetricsConfig, OpsConfig, OpsCommandEnum, OpsMessageResponse } from '@jfvilas/kwirth-common'
import { ITabObject } from './model/ITabObject'
import { MetricDescription } from './model/MetricDescription'

import { ILogMessage, LogObject } from './model/LogObject'
import { AlertObject, AlertSeverityEnum, IAlertMessage } from './model/AlertObject'
import { IMetricsMessage, MetricsObject } from './model/MetricsObject'

import { SetupLog } from './components/channels/SetupLog'
import { SetupAlert } from './components/channels/SetupAlert'
import { SetupMetrics } from './components/channels/SetupMetrics'
import { IBoard } from './model/IBoard'
import { OpsObject } from './model/OpsObject'
import { OPSWELCOMEMESSAGE } from './tools/Constants'

const App: React.FC = () => {

    var backendUrl='http://localhost:3883'
    const rootPath = window.__PUBLIC_PATH__ || ''
    if ( process.env.NODE_ENV==='production') backendUrl=window.location.protocol+'//'+window.location.host
    backendUrl=backendUrl+rootPath

    const [user, setUser] = useState<User>()
    const [logged,setLogged]=useState(false)
    const [accessString,setAccessString]=useState('')
    const [msgBox, setMsgBox] =useState(<></>)

    const [clusters, setClusters] = useState<Cluster[]>([])
    const clustersRef = useRef(clusters)
    clustersRef.current = clusters
    const [selectedClusterName, setSelectedClusterName] = useState<string>()

    const [tabs, setTabs] = useState<ITabObject[]>([])
    const [highlightedTabs, setHighlightedTabs] = useState<ITabObject[]>([])
    const [pausedTabs, setPausedTabs] = useState<ITabObject[]>([])

    const [selectedTabName, setSelectedTabName] = useState<string>()
    const selectedTabRef = useRef(selectedTabName)
    selectedTabRef.current=selectedTabName
    var selectedTab = tabs.find(t => t.name===selectedTabName)
    var selectedTabIndex = tabs.findIndex(t => t.name===selectedTabName)

    const [refreshTabContent, setRefreshTabContent] = useState(0)

    // message list management
    const lastLineRef = useRef(null)

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
    const [showSetupLog, setShowSetupLog]=useState<boolean>(false)
    const [showSetupAlert, setShowSetupAlert]=useState<boolean>(false)
    const [showSetupMetrics, setShowSetupMetrics]=useState<boolean>(false)

    useEffect ( () => {
        //+++ when a board is loaded all messages are received: alarms should not be in effect until everything is received
        //+++ plan to use metrics channel for alarming based on resource usage (cpu > 80, freemem<10,....)
        //+++ add options to asterisk log lines containing a specific text (like 'password', 'pw', etc...)

        if (logged) {
            if (clustersRef.current.length===0) getClusters()
            if (!settingsRef.current) readSettings()
        }
    })

    useEffect ( () => {
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
        console.log('getc')
        // get current cluster
        let response = await fetch(`${backendUrl}/config/cluster`, addGetAuthorization(accessString))
        let srcCluster = await response.json() as Cluster
        srcCluster.url = backendUrl
        srcCluster.accessString = accessString
        srcCluster.source = true
        srcCluster.enabled = true
        response = await fetch(`${backendUrl}/config/version`, addGetAuthorization(accessString))
        srcCluster.kwirthData = await response.json() as KwirthData
        if (versionGreatThan(srcCluster.kwirthData.version,srcCluster.kwirthData.lastVersion)) {
            setInitialMessage(`You have Kwirth version ${srcCluster.kwirthData.version} installed. A new version is available (${srcCluster.kwirthData.version}), it is recommended to update your Kwirth deployment. If you're a Kwirth admin and you're using 'latest' tag, you can update Kwirth from the main menu.`)
        }

        // get previously configured clusters
        let clusterList:Cluster[]=[]
        response = await fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addGetAuthorization(accessString))
        if (response.status===200) {
            clusterList=JSON.parse (await response.json())
            clusterList=clusterList.filter (c => c.name !== srcCluster.name)
        }

        clusterList.push(srcCluster)
        setClusters(clusterList)

        for (let cluster of clusterList) {
            setClusterStatus(cluster)
        }
    }

    const setClusterStatus = async (cluster:Cluster): Promise<void> => {
        if (await readClusterInfo(cluster)) {
            cluster.enabled = true
            await readClusterChannels(cluster)
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

    const readClusterChannels = async (cluster: Cluster) => {
        let resp=await fetch (`${cluster.url}/config/channel`, addGetAuthorization(cluster.accessString))
        if (resp.status===200) {
            let json=await resp.json()
            if (json) cluster.channels = json
        }
        else {
            cluster.channels = []
        }
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

    const onChangeCluster = (cname:string) => {
        if (!clusters) return
        let cluster = clusters.find(c => c.name === cname)
        if (cluster) {
            setSelectedClusterName (cname)
            setChannels(cluster.channels)
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
            channelId: selection.channel,
            channelObject: {
                clusterName: selection.clusterName,
                data: undefined,
                instance: '',
                view: selection.view as InstanceConfigViewEnum,
                namespace: selection.namespaces.join(','),
                group: selection.groups.join(','),
                pod: selection.pods.join(','),
                container: selection.containers.join(',')
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false
        }

        switch(selection.channel) {
            case InstanceMessageChannelEnum.LOG:
                let logObject = new LogObject()
                logObject.follow = settingsRef.current?.logFollow || true
                logObject.maxMessages = settingsRef.current?.logMaxMessages || 1000
                logObject.previous = settingsRef.current?.logPrevious || false
                logObject.timestamp = settingsRef.current?.logTimestamp || true
                newTab.channelObject.data = logObject
                break
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
                newTab.channelObject.data = metricsObject
                break
            case InstanceMessageChannelEnum.ALERT:
                let alertObject = new AlertObject()
                alertObject.maxAlerts = settingsRef.current?.alertMaxAlerts || 40
                alertObject.regexInfo = []
                alertObject.regexWarning = []
                alertObject.regexError = []
                newTab.channelObject.data = alertObject
                break
            case InstanceMessageChannelEnum.OPS:
                let opsObject = new OpsObject()
                newTab.channelObject.data = opsObject
                break
            default:
                console.log(`Error, invalid channel: `, selection.channel)
                setMsgBox(MsgBoxOkError('Add resource', 'Channel is not supported', setMsgBox))
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
                setHighlightedTabs (highlightedTabs.filter(t => t.channelObject && t.channelPending))
                setPausedTabs (pausedTabs.filter(t => t.channelObject && t.channelPaused))
                setRefreshTabContent(Math.random())
            }
            setSelectedTabName(tabName)
        }
    }

    const wsOnMessage = (wsEvent:any) => {
        var instanceMessage:InstanceMessage
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
            case InstanceMessageChannelEnum.LOG:
                processLogMessage(wsEvent)
                break
            case InstanceMessageChannelEnum.ALERT:
                processAlertMessage(wsEvent)
                break
            case InstanceMessageChannelEnum.METRICS:
                processMetricsMessage(wsEvent)
                break
            case InstanceMessageChannelEnum.OPS:
                processOpsMessage(wsEvent)
                break
            default:
                console.log('Received invalid channel in message: ', instanceMessage)
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

    const processLogMessage = (wsEvent:any) => {
        // find the tab which this web socket belongs to, and add the new message
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return

        let logMessage = JSON.parse(wsEvent.data) as ILogMessage
        let logObject = tab.channelObject.data as LogObject

        switch (logMessage.type) {
            case InstanceMessageTypeEnum.DATA:
                logObject.messages.push(logMessage)
                if (logObject.messages.length > logObject.maxMessages) logObject.messages.splice(0, logObject.messages.length - logObject.maxMessages)

                // if current log is displayed (focused), add message to the screen
                if (selectedTabRef.current === tab.name) {
                    if (!tab.channelPaused) {
                        setRefreshTabContent(Math.random())
                        if (logObject.follow && lastLineRef.current) {
                            (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })
                        }
                    }
                }
                else {
                    // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
                    if (logObject.backgroundNotification && !tab.channelPaused) {
                        tab.channelPending = true
                        setHighlightedTabs((prev)=> [...prev, tab!])
                    }
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let icm = JSON.parse(wsEvent.data) as InstanceMessage
                if (icm.flow === InstanceMessageFlowEnum.RESPONSE && icm.action === InstanceMessageActionEnum.START) {
                    tab.channelObject.instance = icm.instance
                }
                logObject.messages.push(logMessage)
                setRefreshTabContent(Math.random())
                break
            default:
                console.log(`Invalid message type`, logMessage)
                break
        }
    }

    const processAlertMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as IAlertMessage
        var tab=tabs.find(tab => tab.ws !== null && tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return

        let alertObject = tab.channelObject.data as AlertObject
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                alertObject.firedAlerts.push ({
                    timestamp: msg.timestamp? new Date(msg.timestamp).getTime(): Date.now(),
                    severity: msg.severity,
                    text: msg.text,
                    namespace: msg.namespace,
                    group: '',
                    pod: msg.pod,
                    container: msg.container
                })
                if (alertObject.firedAlerts.length > alertObject.maxAlerts) alertObject.firedAlerts.splice(0, alertObject.firedAlerts.length - alertObject.maxAlerts)
                if (!tab.channelPaused) setRefreshTabContent(Math.random())
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let icm = JSON.parse(wsEvent.data) as InstanceMessage
                if (icm.flow === InstanceMessageFlowEnum.RESPONSE && icm.action === InstanceMessageActionEnum.START) {
                    tab.channelObject.instance = icm.instance
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
    }
    
    const processMetricsMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as IMetricsMessage
        var tab=tabs.find(tab => tab.ws !== null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        let metricsObject = tab.channelObject.data as MetricsObject
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                metricsObject.assetMetricsValues.push(msg)
                if (metricsObject.assetMetricsValues.length > metricsObject.depth) {
                    metricsObject.assetMetricsValues.shift()
                }
                if (!tab.channelPaused) setRefreshTabContent(Math.random())
                break
            case InstanceMessageTypeEnum.SIGNAL:
                let icm = JSON.parse(wsEvent.data) as InstanceMessage
                if (icm.flow === InstanceMessageFlowEnum.RESPONSE && icm.action === InstanceMessageActionEnum.START) {
                    tab.channelObject.instance = icm.instance
                }
                else {
                    let signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                    if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                        metricsObject.errors.push(signalMessage.text)
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
        return text.replace(regexAnsi, '') // replace all empty string matches
    }

    const processOpsMessage = (wsEvent:any) => {
        var opsMessage = JSON.parse(wsEvent.data) as OpsMessageResponse
        var tab = tabs.find(tab => tab.ws !== null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        let opsObject = tab.channelObject.data as OpsObject
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
                    let shell = opsObject.shells.find (s => s.id===opsMessage.id)
                    if (shell) {
                        shell.lines.push(cleanANSI(opsMessage.data))
                        if (opsObject.shell) setRefreshTabContent(Math.random())  //+++ and visible shell is destinatiopn shell
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
                    tab.channelObject.instance = signalMessage.instance
                    opsObject.messages.push(signalMessage.text)
                    setRefreshTabContent(Math.random())
                }
                else {
                    console.log('wsEvent.data')
                    console.log(wsEvent.data)                    
                }
                break
            default:
                console.log(`Invalid message type ${opsMessage.type}`)
                break
        }
    }
    
    const onClickChannelStart = () => {
        switch (selectedTab?.channelId) {
            case InstanceMessageChannelEnum.LOG:
                setShowSetupLog(true)
                break
            case InstanceMessageChannelEnum.ALERT:
                setShowSetupAlert(true)
                break
            case InstanceMessageChannelEnum.METRICS:
                setShowSetupMetrics(true)
                break
            case InstanceMessageChannelEnum.OPS:
                startChannel(selectedTab)
                break
            default:
                console.log(`Unsupported channel ${selectedTab?.channelId}`)
        }
    }

    const reconnectedSocket = (wsEvent:any, id:NodeJS.Timer) => {
        clearInterval(id)
        console.log('Reconnected, will reconfigure socket')
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return
        console.log(tab)
        let instanceConfig:InstanceConfig = {
            channel: tab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            flow: InstanceMessageFlowEnum.REQUEST,
            action: InstanceMessageActionEnum.RECONNECT,
            instance: tab.channelObject.instance,
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
            tab.ws!.onerror = (event) => reconnectSocket(event)
            tab.ws!.onmessage = (event) => wsOnMessage(event)
            tab.ws!.onclose = (event) => reconnectSocket(event)
            tab.ws!.send(JSON.stringify(instanceConfig))
        }
        else {
            console.log('Target not set')
        }
    }

    const reconnectSocket = (wsEvent:any) => {
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
            case InstanceMessageChannelEnum.LOG:
                let logObject = tab.channelObject.data as LogObject
                logObject.messages.push({
                    action: InstanceMessageActionEnum.NONE,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    channel: InstanceMessageChannelEnum.LOG,
                    type: InstanceMessageTypeEnum.DATA,
                    instance: '',
                    text: '*** Lost connection ***',
                    namespace: '',
                    pod: '',
                    container: '',
                    msgtype: 'logmessage'
                })
                break
            case InstanceMessageChannelEnum.ALERT:
                let alertObject = tab.channelObject.data as AlertObject
                alertObject.firedAlerts.push({
                    timestamp: Date.now(),
                    severity: AlertSeverityEnum.ERROR,
                    namespace:'',
                    container: '',
                    text: '*** Lost connection ***'
                })
                break
            case InstanceMessageChannelEnum.METRICS:
                let metricsObject = tab.channelObject.data as MetricsObject
                metricsObject.errors.push('*** Lost connection ***')
                break
            case InstanceMessageChannelEnum.METRICS:
                console.log('reconnect not implemented')
                break
        }
        setRefreshTabContent(Math.random())


        let selfId = setInterval( (url, tab) => {
            console.log(`Trying to reconnect using ${url} and ${tab.channelObject.instance}`)
            try {
                let ws = new WebSocket(url)
                tab.ws = ws
                ws.onopen = (event) => reconnectedSocket(event, selfId)
            }
            catch  {}
        }, 10000, cluster!.url, tab)
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
            tab.ws.onerror = (event) => reconnectSocket(event)
            tab.ws.onmessage = (event) => wsOnMessage(event)
            tab.ws.onclose = (event) => reconnectSocket(event)
    
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
                case InstanceMessageChannelEnum.LOG:
                    let logObject = tab.channelObject.data as LogObject
                    if (!cluster) {
                        setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at log configuration ${tab.channelObject.clusterName} does not exist.`, setMsgBox))
                        return
                    }
                    let logConfig:LogConfig = {
                        timestamp: logObject.timestamp,
                        previous: logObject.previous,
                        maxMessages: logObject.maxMessages,
                        fromStart: logObject.fromStart
                    }
                    instanceConfig.data = logConfig
                    break
                case InstanceMessageChannelEnum.ALERT:
                    let alertObject = tab.channelObject.data as AlertObject
                    alertObject.firedAlerts=[]
                    let alertConfig:AlertConfig ={
                        regexInfo: alertObject.regexInfo,
                        regexWarning: alertObject.regexWarning,
                        regexError: alertObject.regexError
                    }
                    instanceConfig.data = alertConfig
                    break
                case InstanceMessageChannelEnum.METRICS:
                    let metricsObject = tab.channelObject.data as MetricsObject
                    metricsObject.errors = []
                    metricsObject.assetMetricsValues=[]
                    let metricsConfig:MetricsConfig = {
                        mode: metricsObject.mode,
                        aggregate: metricsObject.aggregate,
                        interval: metricsObject.interval,
                        metrics: metricsObject.metrics,
                    }
                    instanceConfig.data = metricsConfig
                    break
                case InstanceMessageChannelEnum.OPS:
                    let dataOps = tab.channelObject.data as OpsObject
                    dataOps.accessKey = cluster.accessString
                    dataOps.messages = OPSWELCOMEMESSAGE
                    dataOps.shell = undefined
                    dataOps.shells = []
                    let opsConfig:OpsConfig = {}
                    instanceConfig.data = opsConfig
                    break
                default:
                    console.log('Channel is not supported')
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
            instance: tab.channelObject.instance,
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
            case InstanceMessageChannelEnum.LOG:
                let logObject = tab.channelObject.data as LogObject
                logObject.messages.push({
                    action: InstanceMessageActionEnum.NONE,
                    flow: InstanceMessageFlowEnum.UNSOLICITED,
                    text: '=========================================================================',
                    channel: InstanceMessageChannelEnum.LOG,
                    type: InstanceMessageTypeEnum.DATA,
                    instance: '',
                    namespace: '',
                    pod: '',
                    container: '',
                    msgtype: 'logmessage'
                }) 
                setRefreshTabContent(Math.random())
                break
            case InstanceMessageChannelEnum.ALERT:
                let alertObject = tab.channelObject.data as AlertObject
                alertObject.firedAlerts.push({
                    timestamp: Date.now(),
                    severity: AlertSeverityEnum.INFO,
                    namespace:'',
                    container: '',
                    text: '========================================================================='
                })
                setRefreshTabContent(Math.random())
                break
            case InstanceMessageChannelEnum.METRICS:
                break
            case InstanceMessageChannelEnum.OPS:
                let dataOps = tab.channelObject.data as OpsObject
                dataOps.messages.push('=========================================================================')
                setRefreshTabContent(Math.random())
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
            instance: selectedTab.channelObject?.instance,
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
            setHighlightedTabs (highlightedTabs.filter(t => t.channelObject && t.channelPending))
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
            // case MenuTabOption.TabManageRestart:
                // switch(selectedTab && selectedTab.logObject?.view) {
                //     case .GROUP:
                //         // restart a deployment
                //         fetch (`${backendUrl}/managecluster/restartdeployment/${selectedTab?.logObject?.namespace}/${selectedTab?.logObject?.group}`, addPostAuthorization(accessString))
                //         break
                //     case .POD:
                //         // restart a pod
                //         fetch (`${backendUrl}/managecluster/restartpod/${selectedTab?.logObject?.namespace}/${selectedTab?.logObject?.pod}`, addPostAuthorization(accessString))
                //         break
                // }
                // break
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
                channelId: tab.channelId,
                channelObject: JSON.parse(JSON.stringify(tab.channelObject)),
                channelStarted: false,
                channelPaused: false,
                channelPending: false
            }
            switch(tab.channelId) {
                case InstanceMessageChannelEnum.LOG:
                    (newTab.channelObject.data as LogObject).messages=[]
                    break
                case InstanceMessageChannelEnum.METRICS:
                    (newTab.channelObject.data as MetricsObject).assetMetricsValues = []
                    break
                case InstanceMessageChannelEnum.ALERT:
                    (newTab.channelObject.data as AlertObject).firedAlerts = []
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
                setMsgBox(MsgBoxYesNo('Delete board',`Are you sure you want to delete board ${name} (you cannot undo this action?`,setMsgBox, (button) => {
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

        let tab=tabs.find(t => t.name===selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        let metricsObject = tab.channelObject.data as MetricsObject

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

    const onSetupLogClosed = (maxMessages:number, previous:boolean, timestamp:boolean, follow:boolean, fromStart:boolean) => {
        setShowSetupLog(false)       
        setAnchorMenuTab(null)
        if (maxMessages === 0) return

        var tab = tabs.find(t => t.name === selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        let logObject = tab.channelObject.data as LogObject
        logObject.maxMessages = maxMessages
        logObject.fromStart = fromStart
        logObject.previous = previous
        logObject.timestamp = timestamp
        logObject.follow = follow
        logObject.messages = []
        startChannel(tab)
    }

    const onAlertSetupClosed = (regexInfo:string[], regexWarning:string[], regexError:string[], maxAlerts:number): void => {
        setShowSetupAlert(false)
        setAnchorMenuTab(null)
        if (regexInfo.length===0 && regexWarning.length===0 && regexError.length===0) return

        var tab=tabs.find(t => t.name === selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        let alertObject = tab.channelObject.data as AlertObject
        alertObject.regexInfo = regexInfo
        alertObject.regexWarning = regexWarning
        alertObject.regexError = regexError
        alertObject.maxAlerts = maxAlerts
        alertObject.firedAlerts = []
        startChannel(tab)
    }

    const onRenameTabClosed = (newname:string|undefined) => {
        setShowRenameLog(false)
        if (!selectedTab || !newname) return

        selectedTab.name=newname
        setSelectedTabName(newname)
    }

    // const pickList = (title:string, message:string, values:string[], onClose:(a:string) => void ) =>{
    //     var plc:PickListConfig=new PickListConfig()
    //     plc.title=title
    //     plc.message=message
    //     plc.values=values
    //     plc.originOnClose=onClose
    //     plc.onClose=pickListClosed
    //     setPickListConfig(plc)
    //     setShowPickList(true)
    // }

    // const pickListClosed = (a:string|null) => {
    //     setShowPickList(false)
    //     if (a!==null) pickListConfigRef?.current?.originOnClose(a)
    //     setPickListConfig(null)
    // }

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

    const onLoginClosed = (user:User|undefined, accessKey:string) => {
        if (user) {
            setLogged(true)
            setUser(user)
            setAccessString(accessKey)
            setCurrentBoardName('untitled')
            setCurrentBoardDescription('No description yet')
            clearTabs()
        }
    }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessKey: accessString, logged, backendUrl }}>
                <Login onClose={onLoginClosed}></Login>
            </SessionContext.Provider>
        </div>
    </>)

    const formatTabName = (tab : ITabObject) => {
        if (!tab.name) return <>undefined</>

        let icon = <Box sx={{minWidth:'24px'}}/>
        if (tab.channelId === InstanceMessageChannelEnum.LOG) icon = <Subject sx={{mr:1}}/>
        if (tab.channelId === InstanceMessageChannelEnum.ALERT) icon = <Warning sx={{mr:1}}/>
        if (tab.channelId === InstanceMessageChannelEnum.METRICS) icon = <BarChart sx={{mr:2}}/>
        if (tab.channelId === InstanceMessageChannelEnum.OPS) icon = <Terminal sx={{mr:1}}/>
        let name = tab.name
        if (name.length>20) name = tab.name.slice(0, 8) + '...' + tab.name.slice(-8)
        return <>{icon}{name}</>
    }

    return (<>
        <SessionContext.Provider value={{ user, accessKey: accessString, logged, backendUrl }}>
            <AppBar position="sticky" elevation={0} sx={{ zIndex: 99, height:'64px' }}>
                <Toolbar>
                    <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }} onClick={() => setMenuDrawerOpen(true)}><Menu /></IconButton>
                    <Typography sx={{ ml:1,flexGrow: 1 }}>KWirth</Typography>
                    <Tooltip title={<div style={{textAlign:'center'}}>{currentBoardName}<br/><br/>{currentBoardDescription}</div>} sx={{ mr:2}} slotProps={{popper: {modifiers: [{name: 'offset', options: {offset: [0, -12]}}]}}}>
                        <Typography variant="h6" component="div" sx={{mr:2, cursor:'default'}}>{currentBoardName}</Typography>
                    </Tooltip>
                    <Tooltip title={<div style={{textAlign:'center'}}>{user?.id}<br/>{user?.name}<br/>[{user?.scope}]</div>} sx={{ mr:2 }} slotProps={{popper: {modifiers: [{name: 'offset', options: {offset: [0, -6]}}]}}}>
                        <Person/>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            <Drawer sx={{ flexShrink: 0, '& .MuiDrawer-paper': {mt: '64px'} }} anchor="left" open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)}>
                <Stack direction={'column'}>
                    <MenuDrawer optionSelected={menuDrawerOptionSelected} uploadSelected={handleUpload} selectedClusterName={selectedClusterName} user={user}/>
                    <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} channels={channels} onAdd={onResourceSelectorAdd} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedTabName} onChange={onChangeTab} variant="scrollable" scrollButtons="auto" sx={{ml:1}}>
                        { tabs.length>0 && tabs.map(tab => {
                            if (tab===selectedTab) {
                                return <Tab key={tab.name} label={formatTabName(tab)} value={tab.name} icon={<IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedTabs.includes(tab)?'pink':pausedTabs.includes(tab)?'#cccccc':'')}}/>
                            }
                            else {
                                return <Tab key={tab.name} label={formatTabName(tab)} value={tab.name} icon={<Box sx={{minWidth:'36px'}}/>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedTabs.includes(tab)?'pink':pausedTabs.includes(tab)?'#cccccc':'')}}/>
                            }
                        })}
                    </Tabs>

                    <Typography sx={{ flexGrow: 1 }}></Typography>
                </Stack>

                { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs} selectedTab={selectedTab} selectedTabIndex={selectedTabIndex} />}
                <TabContent lastLineRef={lastLineRef} channel={selectedTab?.channelId} channelObject={selectedTab?.channelObject} refreshTabContent={refreshTabContent} webSocket={selectedTab?.ws}/>
            </Box>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs} oldname={selectedTab?.name}/> }
            { showSaveBoard && <SaveBoard onClose={onSaveBoardClosed} name={currentBoardName} description={currentBoardDescription} values={boards} /> }
            { showSelectBoard && <SelectBoard onSelect={onSelectBoardClosed} values={boards} action={selectBoardAction}/> }
            { showManageClusters && <ManageClusters onClose={onManageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }

            { showSetupLog && <SetupLog onClose={onSetupLogClosed} channelObject={selectedTab?.channelObject} /> }
            { showSetupAlert && <SetupAlert onClose={onAlertSetupClosed} channelObject={selectedTab?.channelObject} /> }
            { showSetupMetrics && clusters && <SetupMetrics onClose={onSetupMetricsClosed} channelObject={selectedTab?.channelObject} metrics={clusters.find(c => c.name === selectedTab!.channelObject.clusterName)?.metricsList!} /> }

            { showSettingsUser && <SettingsUser onClose={onSettingsUserClosed} settings={settings} /> }
            { showSettingsCluster && clusters && <SettingsCluster onClose={onSettingsClusterClosed} clusterName={selectedClusterName} clusterMetricsInterval={clusters.find(c => c.name===selectedClusterName)?.metricsInterval} /> }
            { initialMessage !== '' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            {/* { pickListConfig!==null && <PickList config={pickListConfig}/> } */}
            { msgBox }
        </SessionContext.Provider>
    </>)
}

export default App