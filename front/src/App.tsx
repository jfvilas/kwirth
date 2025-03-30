import { useState, useRef, useEffect } from 'react'

// material & icons
import { AppBar, Box, Drawer, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person } from '@mui/icons-material'

// model
import { User } from './model/User'
import { Cluster } from './model/Cluster'

// tools
import { PickListConfig } from './model/PickListConfig'

// components
import RenameTab from './components/RenameTab'
import { SaveBoard } from './components/board/SaveBoard'
import { SelectBoard }  from './components/board/SelectBoard'
import ManageApiSecurity from './components/ManageApiSecurity'
import PickList from './components/PickList'
import Login from './components/Login'
import ManageClusters from './components/ManageClusters'
import ManageUserSecurity from './components/ManageUserSecurity'
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
import { KwirthData, MetricsConfigModeEnum, InstanceConfigActionEnum, InstanceConfigFlowEnum, InstanceConfigChannelEnum, InstanceMessage, versionGreatThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, SignalMessage, SignalMessageLevelEnum } from '@jfvilas/kwirth-common'
import { ITabObject } from './model/ITabObject'
import { MetricDescription } from './model/MetricDescription'

import { ILogMessage, LogObject } from './model/LogObject'
import { AlertObject, AlertSeverityEnum, IAlertMessage } from './model/AlertObject'
import { IMetricsMessage, MetricsObject } from './model/MetricsObject'

import { SetupLog } from './components/channels/SetupLog'
import { SetupAlert } from './components/channels/SetupAlert'
import { SetupMetrics } from './components/channels/SetupMetrics'
import { IBoard } from './model/IBoard'


const App: React.FC = () => {

    var backendUrl='http://localhost:3883'
    const rootPath = window.__PUBLIC_PATH__ || ''
    if ( process.env.NODE_ENV==='production') backendUrl=window.location.protocol+'//'+window.location.host
    backendUrl=backendUrl+rootPath

    const [user, setUser] = useState<User>()
    const [logged,setLogged]=useState(false)
    const [accessString,setAccessString]=useState('')
    const [msgBox, setMsgBox] =useState(<></>)

    const [clusters, setClusters] = useState<Cluster[]>()
    const [selectedClusterName, setSelectedClusterName] = useState<string>()
    const clustersRef = useRef(clusters)
    clustersRef.current=clusters

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

    const [channels, setChannels] = useState<string[]>()
    const channelsRef = useRef(channels)
    channelsRef.current= channels

    // menus/navigation
    const [anchorMenuTab, setAnchorMenuTab] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // dialogs
    const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null)
    var pickListConfigRef=useRef(pickListConfig)
    pickListConfigRef.current=pickListConfig

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
    const [showPickList, setShowPickList]=useState<boolean>(false)
    
    useEffect ( () => {
        //+++ when a board is loaded all messages are received: alarms should not be in effect until everything is received
        //+++ plan to use metrics channel for alarming based on resource usage (cpu > 80, freemem<10,....)
        //+++ add options to asterisk log lines containing a specific text (like 'password', 'pw', etc...)

        if (logged) {
            if (!clustersRef.current) getClusters()
            if (!settingsRef.current) readSettings()
            //if (!channelsRef.current) readChannels()
        }
    })

    useEffect ( () => {
        if (logged) {
            setBoardLoaded(false)
            if (tabs.length>0) {               
                for(let tab of tabs) {
                    let baseClusterName=tab.channelObject?.clusterName
                    let cluster=clusters!.find(c => c.name === baseClusterName)

                    if (cluster) {
                        tab.ws = new WebSocket(cluster.url)
                        tab.ws!.onerror = () => console.log(`Error detected on WS: ${tab.ws!.url}`)
                        tab.ws!.onmessage = (event) => wsOnMessage(event)
                        tab.ws!.onclose = (event) => console.log(`WS tab disconnected: ${tab.ws!.url}`)

                        tab.ws.onopen = () => {
                            console.log(`WS connected: ${tab.name} to ${tab.ws!.url}`)
                            if (tab.channelObject) startChannel(tab)
                        }
                    }
                }
                onChangeTab(null, tabs[0].name)
            }
        }
    }, [boardLoaded])

    const getClusters = async () => {
        // get current cluster
        var response = await fetch(`${backendUrl}/config/cluster`, addGetAuthorization(accessString))
        var srcCluster = await response.json() as Cluster
        srcCluster.url=backendUrl
        srcCluster.accessString=accessString
        srcCluster.source=true
        response = await fetch(`${backendUrl}/config/version`, addGetAuthorization(accessString))
        srcCluster.kwirthData = await response.json() as KwirthData
        if (versionGreatThan(srcCluster.kwirthData.version,srcCluster.kwirthData.lastVersion)) {
            setInitialMessage(`You have Kwirth version ${srcCluster.kwirthData.version} installed. A new version is available (${srcCluster.kwirthData.version}), it is recommended to update your Kwirth deployment. If you're a Kwirth admin and you're using 'latest' tag, you can update Kwirth from the main menu.`)
        }

        // get previously configured clusters
        var clusterList:Cluster[]=[]
        response = await fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addGetAuthorization(accessString))
        if (response.status===200) {
            clusterList=JSON.parse (await response.json())
            clusterList=clusterList.filter (c => c.name!==srcCluster.name)
        }

        clusterList.push(srcCluster)
        setClusters(clusterList)

        for (let cluster of clusterList) {
            await readChannels(cluster)
            if (cluster.channels.includes('metrics')) {
                await getMetricsNames(cluster)
            }
        }
    }

    // const readChannels = async () => {
    //     var resp=await fetch (`${backendUrl}/config/channel`, addGetAuthorization(accessString))
    //     if (resp.status===200) {
    //         var json=await resp.json()
    //         if (json) setChannels(json)
    //     }
    //     else {
    //         setChannels([])
    //     }
    // }

    const readChannels = async (cluster: Cluster) => {
        var resp=await fetch (`${cluster.url}/config/channel`, addGetAuthorization(cluster.accessString))
        if (resp.status===200) {
            var json=await resp.json()
            if (json) cluster.channels = json
        }
        else {
            cluster.channels = []
        }
    }

    const readSettings = async () => {
        var resp=await fetch (`${backendUrl}/store/${user?.id}/settings/general`, addGetAuthorization(accessString))
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
        var payload=JSON.stringify(newSettings)
        fetch (`${backendUrl}/store/${user?.id}/settings/general`, addPostAuthorization(accessString, payload))
    }

    const onChangeCluster = (cname:string) => {
        let cluster = clusters!.find(c => c.name === cname)
        if (cluster) {
            setSelectedClusterName (cname)
            setChannels(cluster.channels)
        }
    }

    const onResourceSelectorAdd = (selection:IResourceSelected) => {
        var cluster = clusters!.find(c => c.name===selection.clusterName)
        if (!cluster) {
            setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at tab configuration ${selection.clusterName} does not exist.`, setMsgBox))
            return
        }

        var tabName = selection.suggestedName
        // create unduplicated (unique) name (adding a '-number' suffix)
        let index = -1
        while (tabs.find (t => t.name === tabName + index)) index -= 1

        var newTab:ITabObject = {
            name: tabName+index.toString(),
            ws: null,
            keepaliveRef: 60,
            defaultTab: false,
            channelId: selection.channel,
            channelObject: {
                clusterName: selection.clusterName,
                data: undefined,
                instance: '',
                reconnectKey: '',
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
        newTab.ws = new WebSocket(cluster.url)
        newTab.ws.onopen = () => {
            console.log(`WS connected: ${newTab.ws!.url}`)
            
            newTab.keepaliveRef = setInterval(() => {
                var instanceConfig:InstanceConfig = {
                    channel: InstanceConfigChannelEnum.NONE,
                    objects: InstanceConfigObjectEnum.PODS,                    
                    flow: InstanceConfigFlowEnum.REQUEST,
                    action: InstanceConfigActionEnum.PING,
                    instance: '',
                    scope: InstanceConfigScopeEnum.NONE,
                    accessKey: '',
                    view: InstanceConfigViewEnum.NONE,
                    namespace: '',
                    group: '',
                    pod: '',
                    container: ''
                }
                if (newTab.ws) newTab.ws.send(JSON.stringify(instanceConfig))
            }, (settings?.keepAliveInterval || 60) * 1000,'')  
        }

        switch(selection.channel) {
            case InstanceConfigChannelEnum.LOG:
                let logObject = new LogObject()
                newTab.channelObject.data = logObject
                break

            case InstanceConfigChannelEnum.METRICS:
                let metricsObject = new MetricsObject()
                newTab.channelObject.data = metricsObject
                break

            case InstanceConfigChannelEnum.ALERT:
                let alertObject = new AlertObject()
                alertObject.regexInfo = []
                alertObject.regexWarning = []
                alertObject.regexError = []
                newTab.channelObject.data = alertObject
                break

            default:
                console.log(`Error, invalid channel: `, selection.channel)
        }
        setTabs((prev) => [...prev, newTab])
        setSelectedTabName(newTab.name)
    }

    const onChangeTab = (_event:any, tabName?:string)=> {
        var newTab = tabs.find(tab => tab.name === tabName)
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

        switch(instanceMessage.channel) {
            case InstanceConfigChannelEnum.NONE:
                // we receive keepalive responses through this channel
                break
            case InstanceConfigChannelEnum.LOG:
                processLogMessage(wsEvent)
                break
            case InstanceConfigChannelEnum.ALERT:
                processAlertMessage(wsEvent)
                break
            case InstanceConfigChannelEnum.METRICS:
                processMetricsMessage(wsEvent)
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

        let msg = JSON.parse(wsEvent.data) as ILogMessage
        let dataLog = tab.channelObject.data as LogObject

        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                dataLog.messages.push(msg)
                if (dataLog.messages.length > dataLog.maxMessages) dataLog.messages.splice(0, dataLog.messages.length - dataLog.maxMessages)

                // if current log is displayed (focused), add message to the screen
                if (selectedTabRef.current === tab.name) {
                    if (!tab.channelPaused) {
                        setRefreshTabContent(Math.random())
                        if (dataLog.follow && lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })
                    }
                }
                else {
                    // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
                    if (dataLog.backgroundNotification && !tab.channelPaused) {
                        tab.channelPending = true
                        setHighlightedTabs((prev)=> [...prev, tab!])
                    }
                }
                break
            case InstanceMessageTypeEnum.SIGNAL:
                tab.channelObject.instance = msg.instance
                if (msg.reconnectKey) tab.channelObject.reconnectKey = msg.reconnectKey
                dataLog.messages.push(msg)
                setRefreshTabContent(Math.random())
                break
            default:
                console.log(`Invalid message type`, msg)
                break
        }
    }

    const processAlertMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as IAlertMessage
        var tab=tabs.find(tab => tab.ws !== null && tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return

        let dataAlert = tab.channelObject.data as AlertObject
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                dataAlert.firedAlerts.push ({
                    timestamp: new Date(msg.timestamp!).getTime(),
                    severity: msg.severity,
                    text: msg.text,
                    namespace: msg.namespace,
                    group: '',
                    pod: msg.pod,
                    container: msg.container
                })
                if (dataAlert.firedAlerts.length > dataAlert.maxAlerts) dataAlert.firedAlerts.splice(0, dataAlert.firedAlerts.length - dataAlert.maxAlerts)
                if (!tab.channelPaused) setRefreshTabContent(Math.random())
                break
            case InstanceMessageTypeEnum.SIGNAL:
                tab.channelObject.instance = msg.instance
                if (msg.reconnectKey) tab.channelObject.reconnectKey = msg.reconnectKey
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
    }
    
    const processMetricsMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as IMetricsMessage
        var tab=tabs.find(tab => tab.ws!==null && tab.ws===wsEvent.target)
        if (!tab || !tab.channelObject) return

        let dataMetrics = tab.channelObject.data as MetricsObject
        switch (msg.type) {
            case InstanceMessageTypeEnum.DATA:
                dataMetrics.assetMetricsValues.push(msg)
                if (dataMetrics.assetMetricsValues.length > dataMetrics.depth) {
                    dataMetrics.assetMetricsValues.shift()
                }
                if (!tab.channelPaused) setRefreshTabContent(Math.random())
                break
            case InstanceMessageTypeEnum.SIGNAL:
                var signalMessage = JSON.parse(wsEvent.data) as SignalMessage
                tab.channelObject.instance = signalMessage.instance
                if (signalMessage.reconnectKey) tab.channelObject.reconnectKey = signalMessage.reconnectKey
                if (signalMessage.level === SignalMessageLevelEnum.ERROR) {
                    dataMetrics.errors = signalMessage.text
                    setRefreshTabContent(Math.random())
                }
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
    }
    
    const onClickChannelStart = () => {
        switch (selectedTab?.channelId) {
            case InstanceConfigChannelEnum.LOG:
                setShowSetupLog(true)
                break
            case InstanceConfigChannelEnum.ALERT:
                setShowSetupAlert(true)
                break
            case InstanceConfigChannelEnum.METRICS:
                setShowSetupMetrics(true)
                break
        }
    }

    // const reconnectedInstance = (wsEvent:any, id:NodeJS.Timer) => {
    //     clearInterval(id)
    //     console.log('Reconnect interval cleared')
    //     let tab = tabs.find(tab => tab.ws === wsEvent.target)
    //     if (!tab || !tab.channelObject) return
    //     console.log('Reconnected, will reconfigure')
    //     let instanceConfig:InstanceConfig = {
    //         channel: InstanceConfigChannelEnum.NONE,
    //         objects: InstanceConfigObjectEnum.PODS,
    //         flow: InstanceConfigFlowEnum.REQUEST,
    //         action: InstanceConfigActionEnum.RECONNECT,
    //         instance: '',
    //         reconnectKey: tab.channelObject.reconnectKey,
    //         scope: InstanceConfigScopeEnum.NONE,
    //         accessKey: '',
    //         view: InstanceConfigViewEnum.NONE,
    //         namespace: '',
    //         group: '',
    //         pod: '',
    //         container: ''
    //     }
    //     wsEvent.target.send(JSON.stringify(instanceConfig))
    // }

    const reconnectInstance = (wsEvent:any) => {
        return
        // +++ pending review
        // let tab = tabs.find(tab => tab.ws === wsEvent.target)
        // if (!tab || !tab.channelObject || !tab.channelObject.reconnectKey) return
        // var cluster = clusters!.find(c => c.name === tab!.channelObject!.clusterName)
        // if (!cluster) return

        // console.log(`Will reconnect using ${tab.channelObject.reconnectKey}`)

        // let selfId = setInterval( (key, url, tab) => {
        //     console.log(`Trying to reconnect using ${key}, ${url}`)
        //     let ws = new WebSocket(url)
        //     ws.onopen = (event) => reconnectedInstance(event, selfId)
        //     tab.ws = ws
        // }, 5000, tab.channelObject.reconnectKey, cluster.url, tab)
    }
    
    const startChannel = (tab:ITabObject) => {
        if (!tab || !tab.channelObject) {
            console.log('No active tab found')
            return
        }
        var cluster = clusters!.find(c => c.name === tab.channelObject!.clusterName)
        if (!cluster) {
            setMsgBox(MsgBoxOk('Kwirth',`Cluster set at channel configuration (${tab.channelObject.clusterName}) does not exist.`, setMsgBox))
            return
        }

        if (tab.ws && tab.ws.readyState === tab.ws.OPEN) {
            tab.ws.onerror = (event) => reconnectInstance(event)
            tab.ws.onmessage = (event) => wsOnMessage(event)
            tab.ws.onclose = (event) => reconnectInstance(event)
    
            var instanceConfig: InstanceConfig = {
                channel: tab.channelId,
                objects: InstanceConfigObjectEnum.PODS,
                action: InstanceConfigActionEnum.START,
                flow: InstanceConfigFlowEnum.REQUEST,
                instance: '',
                accessKey: cluster!.accessString,
                scope: InstanceConfigScopeEnum.SUBSCRIBE,
                view: tab.channelObject.view!,
                namespace: tab.channelObject.namespace!,
                group: tab.channelObject.group!,
                pod: tab.channelObject.pod!,
                container: tab.channelObject.container!,
            }
            switch (tab.channelId) {
                case InstanceConfigChannelEnum.LOG: 
                    let dataLog = tab.channelObject.data as LogObject
                    if (!cluster) {
                        setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at log configuration ${tab.channelObject.clusterName} does not exist.`, setMsgBox))
                        return
                    }
                    instanceConfig.data = {
                        timestamp: dataLog.timestamp,
                        previous: dataLog.previous,
                        maxMessages: dataLog.maxMessages,
                        fromStart: dataLog.fromStart
                    }
                    break
                case InstanceConfigChannelEnum.ALERT:
                    let dataAlert = tab.channelObject.data as AlertObject
                    dataAlert.firedAlerts=[]
                    instanceConfig.data = {
                        regexInfo: dataAlert.regexInfo,
                        regexWarning: dataAlert.regexWarning,
                        regexError: dataAlert.regexError
                    }
                    break
                case InstanceConfigChannelEnum.METRICS:
                    var dataMetrics = tab.channelObject.data as MetricsObject
                    dataMetrics.assetMetricsValues=[]
                    instanceConfig.data = {
                        mode: dataMetrics.mode,
                        aggregate: dataMetrics.aggregate,
                        interval: dataMetrics.interval,
                        metrics: dataMetrics.metrics,
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
        if (!tab.channelObject) return
        var cluster = clusters!.find(c => c.name===tab.channelObject!.clusterName)

        var instanceConfig: InstanceConfig = {
            channel: tab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceConfigActionEnum.STOP,
            flow: InstanceConfigFlowEnum.REQUEST,
            instance: tab.channelObject.instance,
            accessKey: cluster!.accessString,
            view: tab.channelObject.view!,
            scope: InstanceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            pod: '',
            container: ''
        }
        switch (tab.channelId) {
            case InstanceConfigChannelEnum.LOG:
                var dataLog = tab.channelObject.data as LogObject
                dataLog.messages.push({
                    text: '=========================================================================',
                    pod: '',
                    channel: 'log',
                    type: InstanceMessageTypeEnum.DATA,
                    instance: ''
                }) 
                setRefreshTabContent(Math.random())
                break
            case InstanceConfigChannelEnum.ALERT:
                var dataAlert = tab.channelObject.data as AlertObject
                dataAlert.firedAlerts.push({
                    timestamp: Date.now(),
                    severity: AlertSeverityEnum.INFO,
                    namespace:'',
                    container: '',
                    text: '========================================================================='
                })
                setRefreshTabContent(Math.random())
                break
            case InstanceConfigChannelEnum.METRICS:
                break
        }
        if (tab.ws) tab.ws.send(JSON.stringify(instanceConfig))
        tab.channelStarted = false
        tab.channelPaused = false
    }

    const onClickChannelPause = () => {
        setAnchorMenuTab(null)
        if (!selectedTab || !selectedTab.channelObject || !selectedTab.ws) return

        var cluster = clusters!.find(c => c.name === selectedTab!.channelObject!.clusterName)

        var instanceConfig:InstanceConfig = {
            channel: selectedTab.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceConfigActionEnum.PAUSE,
            flow: InstanceConfigFlowEnum.REQUEST,
            instance: selectedTab.channelObject?.instance,
            accessKey: cluster!.accessString,
            scope: InstanceConfigScopeEnum.SUBSCRIBE,
            view: selectedTab.channelObject.view,
            namespace: selectedTab.channelObject.namespace,
            group: selectedTab.channelObject.group,
            pod: selectedTab.channelObject.pod,
            container: selectedTab.channelObject.container
        }

        if (selectedTab.channelPaused) {
            selectedTab.channelPaused = false
            setPausedTabs(tabs.filter(t => t.channelPaused))
            instanceConfig.action = InstanceConfigActionEnum.CONTINUE
        }
        else {
            selectedTab.channelPaused = true
            setPausedTabs( (prev) => [...prev, selectedTab!])
            instanceConfig.action = InstanceConfigActionEnum.PAUSE
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
        selectedTab.ws?.close()
        clearInterval(selectedTab.keepaliveRef)
        setTabs(tabs.filter(t => t!==selectedTab))
        if (tabs.length>1) setSelectedTabName(tabs.find(t => t !== selectedTab)?.name)
    }

    const menuTabOptionSelected = (option: MenuTabOption) => {
        setAnchorMenuTab(null)
        switch(option) {
            case MenuTabOption.TabInfo:
                if (selectedTab) {
                    var a=`
                        <b>Name</b>: ${selectedTab.name}<br/>
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
            case MenuTabOption.TabManageRestart:
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
                ws: null,
                keepaliveRef: 0,
                channelId: tab.channelId,
                channelObject: JSON.parse(JSON.stringify(tab.channelObject)),
                channelStarted: false,
                channelPaused: false,
                channelPending: false
            }
            switch(tab.channelId) {
                case InstanceConfigChannelEnum.LOG:
                    (newTab.channelObject.data as LogObject).messages=[]
                    break
                case InstanceConfigChannelEnum.METRICS:
                    (newTab.channelObject.data as MetricsObject).assetMetricsValues = []
                    break
                case InstanceConfigChannelEnum.ALERT:
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
            if (action==='delete') {
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
            else if (action='load') {
                if (name) {
                    clearTabs()
                    var n = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addGetAuthorization(accessString))).json()
                    var board = JSON.parse(n) as IBoard
                    setTabs(board.tabs)
                    setCurrentBoardName(name)
                    setCurrentBoardDescription(board.description)
                    setBoardLoaded(true)
                }                       
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
                if (currentBoardName!=='' && currentBoardName!=='untitled')
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

    const onSettingsUserClosed = (newSettings:Settings) => {
        setShowSettingsUser(false)
        if (newSettings) writeSettings(newSettings)
    }

    const onSettingsClusterClosed = (metricsInterval:number) => {
        setShowSettingsCluster(false)
        if (metricsInterval) {
            var cluster = clusters!.find(c => c.name === selectedClusterName)
            if (cluster)  {
                cluster.metricsInterval = metricsInterval
                let payload = JSON.stringify( { metricsInterval } )
                fetch (`${cluster.url}/metrics/config`, addPostAuthorization(cluster.accessString, payload))
            }
        }
    }

    const onSetupMetricsClosed = (metrics:string[], mode:MetricsConfigModeEnum, depth:number, width:number, interval:number, aggregate:boolean, merge:boolean, stack:boolean, type:string) => {
        setShowSetupMetrics(false)
        setAnchorMenuTab(null)
        if (metrics.length===0) return

        var tab=tabs.find(t => t.name===selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        var dataMetrics = tab.channelObject.data as MetricsObject

        dataMetrics.metrics = metrics
        dataMetrics.mode = mode
        dataMetrics.depth = depth
        dataMetrics.width = width
        dataMetrics.interval = interval
        dataMetrics.aggregate = aggregate
        dataMetrics.merge = merge
        dataMetrics.stack = stack
        dataMetrics.type = type
        startChannel(tab)
    }

    const onSetupLogClosed = (maxMessages:number, previous:boolean, timestamp:boolean, follow:boolean, fromStart:boolean) => {
        setShowSetupLog(false)       
        setAnchorMenuTab(null)
        if (maxMessages === 0) return

        var tab = tabs.find(t => t.name === selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        var dataLog = tab.channelObject.data as LogObject
        dataLog.maxMessages = maxMessages
        dataLog.fromStart = fromStart
        dataLog.previous = previous
        dataLog.timestamp = timestamp
        dataLog.follow = follow
        dataLog.messages = []
        startChannel(tab)
    }

    const onAlertSetupClosed = (regexInfo:string[], regexWarning:string[], regexError:string[], maxAlerts:number) => {
        setShowSetupAlert(false)
        setAnchorMenuTab(null)
        if (regexInfo.length===0 && regexWarning.length===0 && regexError.length===0) return

        var tab=tabs.find(t => t.name === selectedTabRef.current)
        if (!tab || !tab.channelObject) return

        var dataAlert = tab.channelObject.data as AlertObject
        dataAlert.regexInfo = regexInfo
        dataAlert.regexWarning = regexWarning
        dataAlert.regexError = regexError
        dataAlert.maxAlerts = maxAlerts
        dataAlert.firedAlerts = []
        startChannel(tab)
    }

    const onRenameTabClosed = (newname:string|null) => {
        setShowRenameLog(false)
        if (newname!=null) {
            selectedTab!.name=newname
            setSelectedTabName(newname)
        }
    }

    const pickList = (title:string, message:string, values:string[], onClose:(a:string) => void ) =>{
        var plc:PickListConfig=new PickListConfig()
        plc.title=title
        plc.message=message
        plc.values=values
        plc.originOnClose=onClose
        plc.onClose=pickListClosed
        setPickListConfig(plc)
        setShowPickList(true)
    }

    const pickListClosed = (a:string|null) => {
        setShowPickList(false)
        if (a!==null) pickListConfigRef?.current?.originOnClose(a)
        setPickListConfig(null)
    }

    const onManageClustersClosed = (cc:Cluster[]) => {
        setShowManageClusters(false)
        var payload=JSON.stringify(cc)
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addPostAuthorization(accessString, payload))
        setClusters(cc)
    }

    const onLoginClosed = (result:boolean, user:User, accessKey:string) => {
        if (result) {
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
                    <MenuDrawer optionSelected={menuDrawerOptionSelected} uploadSelected={handleUpload} selectedCluster={selectedClusterName} user={user}/>
                    <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} channels={channels} onAdd={onResourceSelectorAdd} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedTabName || (tabs.length>0? tabs[0].name:'')} onChange={onChangeTab} variant="scrollable" scrollButtons="auto" sx={{ml:1}}>
                        { tabs.length>0 && tabs.map(t => {
                            if (t===selectedTab) {
                                return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedTabs.includes(t)?'pink':pausedTabs.includes(t)?'#cccccc':'')}}/>
                            }
                            else {
                                return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton><Box sx={{minWidth:'20px'}} /></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedTabs.includes(t)?'pink':pausedTabs.includes(t)?'#cccccc':'')}}/>
                            }
                        })}
                    </Tabs>

                    <Typography sx={{ flexGrow: 1 }}></Typography>
                </Stack>

                { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs} selectedTab={selectedTab} selectedTabIndex={selectedTabIndex} />}
                <TabContent lastLineRef={lastLineRef} channel={selectedTab?.channelId} channelObject={selectedTab?.channelObject} refreshTabContent={refreshTabContent}/>
            </Box>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs} oldname={selectedTab?.name}/> }
            { showSaveBoard && <SaveBoard onClose={onSaveBoardClosed} name={currentBoardName} description={currentBoardDescription} values={boards} /> }
            { showSelectBoard && <SelectBoard onSelect={onSelectBoardClosed} values={boards} action={selectBoardAction}/> }
            { showManageClusters && <ManageClusters onClose={onManageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }

            { showSetupLog && <SetupLog onClose={onSetupLogClosed} settings={settings} channelObject={selectedTab?.channelObject} /> }
            { showSetupAlert && <SetupAlert onClose={onAlertSetupClosed} settings={settings} channelObject={selectedTab?.channelObject} /> }
            { showSetupMetrics && <SetupMetrics onClose={onSetupMetricsClosed} settings={settings} channelObject={selectedTab?.channelObject} metricsList={clusters!.find(c => c.name===selectedTab!.channelObject!.clusterName)?.metricsList!} /> }

            { showSettingsUser && <SettingsUser onClose={onSettingsUserClosed} settings={settings} /> }
            { showSettingsCluster && <SettingsCluster onClose={onSettingsClusterClosed} clusterMetricsInterval={clusters!.find(c => c.name===selectedClusterName)?.metricsInterval} /> }
            { initialMessage!=='' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            { pickListConfig!==null && <PickList config={pickListConfig}/> }
            { msgBox }
        </SessionContext.Provider>
    </>)
}

export default App