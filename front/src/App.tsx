import { useState, useRef, ChangeEvent, useEffect } from 'react'

// material & icons
import { AppBar, Box, Button, Drawer, IconButton, Stack, Tab, Tabs, TextField, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Clear, Menu, Person } from '@mui/icons-material'

// model
import { User } from './model/User'
import { Alarm, AlarmType } from './model/Alarm'
import { LogObject } from './model/LogObject'
import { Cluster } from './model/Cluster'

// tools
import { OptionsObject, SnackbarKey, closeSnackbar, enqueueSnackbar } from 'notistack'
import { Beep } from './tools/Beep'
import { PickListConfig } from './model/PickListConfig'

// components
import BlockingAlarm from './components/BlockingAlarm'
import AlarmConfig from './components/AlarmConfig'
import RenameTab from './components/RenameTab'
import SaveBoard from './components/SaveBoard'
import ManageApiSecurity from './components/ManageApiSecurity'
import PickList from './components/PickList'
import Login from './components/Login'
import ManageClusters from './components/ManageClusters'
import ManageUserSecurity from './components/ManageUserSecurity'
import ResourceSelector from './components/ResourceSelector'
import TabContent from './components/TabContent'
import SettingsConfig from './components/SettingsConfig'
import { MenuTab, MenuTabOption } from './menus/MenuTab'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { VERSION } from './version'
import { MsgBoxButtons, MsgBoxOk, MsgBoxOkError, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { KwirthData, LogConfig, LogMessage, MetricsConfig, MetricsConfigModeEnum, MetricsMessage, ServiceConfigActionEnum, ServiceConfigFlowEnum, ServiceConfigChannelEnum, ServiceMessage, versionGreatThan, ServiceConfigScopeEnum, ServiceConfigViewEnum } from '@jfvilas/kwirth-common'
import { MetricsObject } from './model/MetricsObject'
import { TabObject } from './model/TabObject'
import MetricsSelector from './components/MetricsSelector'
import { MetricDescription } from './model/MetricDescription'

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
    const clustersRef = useRef(clusters)
    clustersRef.current=clusters

    const [tabs, setTabs] = useState<TabObject[]>([])
    const [highlightedTabs, setHighlightedTabs] = useState<TabObject[]>([])
    const [pausedTabs, setPausedTabs] = useState<TabObject[]>([])

    const [selectedTabName, setSelectedTabName] = useState<string>()
    const selectedTabRef = useRef(selectedTabName)
    selectedTabRef.current=selectedTabName
    var selectedTab = tabs.find(t => t.name===selectedTabName)
    var selectedTabIndex = tabs.findIndex(t => t.name===selectedTabName)

    // const [selectedLogName, setSelectedLogName] = useState<string>()
    // const selectedLogRef = useRef(selectedLogName)
    // selectedLogRef.current=selectedLogName
    // var selectedLog = logs.find(t => t.name===selectedLogName)
    // var selectedLogIndex = logs.findIndex(t => t.name===selectedLogName)
    //const [receivedMetrics, setReceivedMetrics] = useState<MetricsMessage[]>([])
    const [receivedMetricValues, setReceivedMetricValues] = useState<number[]>([])

    // message list management
    const [logMessages, setLogMessages] = useState<LogMessage[]>([])  //+++ i think this is being used just for forcing render
    const lastLineRef = useRef(null)

    // search & filter
    const [filter, setFilter] = useState<string>('')
    const [search, setSearch] = useState<string>('')

    // general
    const [settings, setSettings] = useState<Settings>()
    const settingsRef = useRef(settings)
    settingsRef.current=settings

    // menus/navigation
    const [anchorMenuTab, setAnchorMenuTab] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // dialogs
    const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null)
    var pickListConfigRef=useRef(pickListConfig)
    pickListConfigRef.current=pickListConfig

    // components
    const [showAlarmConfig, setShowAlarmConfig]=useState<boolean>(false)
    const [showBlockingAlarm, setShowBlockingAlarm]=useState<boolean>(false)
    const [showRenameTab, setShowRenameLog]=useState<boolean>(false)
    const [showManageClusters, setShowManageClusters]=useState<boolean>(false)
    const [showSaveBoard, setShowSaveBoard]=useState<boolean>(false)
    const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false)
    const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false)
    const [showManageAlarms, setShowManageAlarms]=useState<boolean>(false)
    const [showSettingsConfig, setShowSettingsConfig]=useState<boolean>(false)
    const [initialMessage, setInitialMessage]=useState<string>('')
    const [blockingAlarm, setBlockingAlarm] = useState<Alarm>()
    const [boardLoaded, setBoardLoaded] = useState<boolean>(false)
    const [currentBoardName, setCurrentBoardName] = useState('')
    const [showMetricsSelector, setShowMetricsSelector]=useState<boolean>(false)
    const [showPickList, setShowPickList]=useState<boolean>(false)
    
    useEffect ( () => {
        //+++ add a settings section for a log object (like settings, but specific)
        //+++ work on alarms and create and alarm manager
        //+++ when a board is loaded all messages are received: alarms should not be in effect until everything is received
        //+++ with ephemeral logs, the content of 'messages' should contain some info on alarms triggered, or even a dashboard (ephemeral logs do not contains log lines)
        //+++ plan to use kubernetes metrics for alarming based on resource usage (basic kubernetes metrics on pods and nodes)
        //+++ decide wether to have collapsibility on the resource selector and the toolbar (to maximize log space)
        //+++ add options to asterisk lines containing a specific text (like 'password', 'pw', etc...)

        if (logged) {
            if (!clustersRef.current) getClusters()
            if (!settingsRef.current) readSettings()
        }
    })

    useEffect ( () => {
        if (logged) {
            setBoardLoaded(false)
            if (tabs.length>0) {
                for (var t of tabs)
                    startTab(t)
                onChangeTabs(null, tabs[0].name)
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

        for (var cluster of clusterList){
            if (!cluster.metricsList) getMetricsNames(cluster)
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

        payload=JSON.stringify({clusterMetricsInterval:newSettings.clusterMetricsInterval})
        fetch (`${backendUrl}/metrics/config`, addPostAuthorization(accessString, payload))
    }

    const onResourceSelectorAdd = (selection:any) => {
        var cluster=clusters!.find(c => c.name===selection.cluster)
        if (!cluster) {
            setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at tab configuration ${selection.cluster} does not exist.`, setMsgBox))
            return
        }

        var tabName=selection.logName
        var channel=selection.channel as ServiceConfigChannelEnum

        // create unduplicated (unique) name
        var index=-1
        while (tabs.find (t => t.name===tabName+index)) index-=1
        var newTab = new TabObject()
        newTab.name = tabName+index

        newTab.ws = new WebSocket(cluster.url)
        newTab.ws.onopen = () => console.log(`WS connected: ${newTab.ws!.url}`)
        newTab.ws.onerror = () => console.log(`Error detected on WS: ${newTab.ws!.url}`)
        newTab.ws.onmessage = (event) => wsOnTabMessage(event)
        newTab.ws.onclose = (event) => console.log(`WS tab disconnected: ${newTab.ws!.url}`)

        switch(channel) {
            case ServiceConfigChannelEnum.LOG:
                var newLog = new LogObject()
                newLog.cluster=selection.cluster
                newLog.view=selection.view
                newLog.namespace=selection.namespace
                newLog.group=selection.group
                newLog.pod=selection.pod
                newLog.container=selection.container        
                newTab.logObject=newLog
                setLogMessages([])
                break

            case ServiceConfigChannelEnum.METRICS:
                var newMetrics = new MetricsObject()
                newMetrics.cluster=selection.cluster
                newMetrics.view=selection.view
                newMetrics.namespace=selection.namespace
                newMetrics.group=selection.group
                newMetrics.pod=selection.pod
                newMetrics.container=selection.container
                newTab.metricsObject=newMetrics
                break
            default:
                console.log(`Error, invalid channel: `, channel)
        }

        tabs.push(newTab)
        setTabs(tabs)
        setFilter('')
        setSearch('')
        setSelectedTabName(newTab.name)
    }

    const onChangeTabs = (event:any,tabName?:string)=> {
        var newTab = tabs.find(tab => tab.name === tabName)
        if (newTab) {
            if (newTab.logObject) {
                newTab.logObject.pending=false
                setHighlightedTabs (highlightedTabs.filter(t => t.logObject && t.logObject.pending))
                setPausedTabs (pausedTabs.filter(t => t.logObject && t.logObject.paused))
                setFilter(newTab.logObject.filter)
                setLogMessages(newTab.logObject.messages)
            }
            setTabs(tabs)
            setSelectedTabName(tabName)
        }
    }

    const wsOnTabMessage = (wsEvent:any) => {
        var serviceMessage:ServiceMessage
        try {
            serviceMessage = JSON.parse(wsEvent.data) as ServiceMessage
        }
        catch (err) {
            console.log(err)
            console.log(wsEvent.data)
            return
        }

        switch(serviceMessage.channel) {
            // case 'info':
            // case 'warning':
            // case 'error':
            //     // these are general signal messages (not related to a channel)
            //     processGeneralSignalMessage(wsEvent)
            //     break
            case 'log':
                processLogMessage(wsEvent)
                break
            case 'metrics':
                processMetricsMessage(wsEvent)
                break
            // case 'oper':
            //     processOperMessage(wsEvent)
            //     break
            // case 'audit':
            //     processAuditMessage(wsEvent)
            //     break
            default:
                console.log('Invalid channel in message: ', serviceMessage)
                break
        }
    }

    const processLogMessage = (wsEvent:any) => {
        // find the tab which this web socket belongs to, and add the new message
        var tab=tabs.find(tab => tab.ws!==null && tab.ws===wsEvent.target)
        if (!tab || !tab.logObject) return

        var msg = JSON.parse(wsEvent.data) as LogMessage
        switch (msg.type) {
            case 'data':
                tab.logObject.messages.push(msg)
                while (tab.logObject.messages.length>tab.logObject.maxMessages) tab.logObject.messages.splice(0,1)

                // if current log is displayed (focused), add message to the screen
                if (selectedTabRef.current === tab.name) {
                    if (!tab.logObject.paused) {
                        setLogMessages([])  //+++ this forces LogContent to re-render +++ change to any other thing
                        if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })
                    }
                }
                else {
                    // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
                    if (tab.logObject.showBackgroundNotification && !tab.logObject.paused) {
                        tab.logObject.pending=true
                        setHighlightedTabs((prev)=> [...prev, tab!])
                        setTabs(tabs)
                    }
                }

                for (var alarm of tab.logObject.alarms) {
                    if (msg.text.includes(alarm.expression)) {
                        if (alarm.beep) Beep.beepError()
                        
                        if (alarm.type===AlarmType.blocking) {
                            setBlockingAlarm(alarm)
                            setShowBlockingAlarm(true)
                        }
                        else {
                            const action = (snackbarId: SnackbarKey | undefined) => (<>
                                <Button onClick={() => { 
                                    closeSnackbar(snackbarId)
                                    onChangeTabs(null,tab!.name)
                                }}>
                                    View
                                </Button>
                                <Button onClick={() => { closeSnackbar(snackbarId) }}>
                                    Dismiss
                                </Button>
                            </>)
                            var opts:OptionsObject = {
                                anchorOrigin:{ horizontal: 'center', vertical: 'bottom' },
                                variant:alarm.severity,
                                autoHideDuration:(alarm.type===AlarmType.timed? 3000:null),
                                action
                            }
                            enqueueSnackbar(alarm.message, opts)
                        }
                    }
                }
                break
            case 'signal':
                tab.logObject.serviceInstance = msg.instance
                tab.logObject.messages.push(msg)
                break
            default:
                console.log(`Invalid message type`, msg)
                break
        }
    }

    const processMetricsMessage = (wsEvent:any) => {
        var msg = JSON.parse(wsEvent.data) as MetricsMessage
        var tab=tabs.find(tab => tab.ws!==null && tab.ws===wsEvent.target)
        if (!tab || !tab.metricsObject) return

        switch (msg.type) {
            case 'data':
                tab.metricsObject.values.push(msg.value)
                tab.metricsObject.timestamps.push(msg.timestamp)
                if (tab.metricsObject.values.length>tab.metricsObject.depth) {
                    tab.metricsObject.values.shift()
                    tab.metricsObject.timestamps.shift()
                }
                if (!tab.metricsObject.paused) setReceivedMetricValues(msg.value)
                break
            case 'signal':
                tab.metricsObject.serviceInstance = msg.instance
                console.log(`Received message on channel ${msg.channel}: ${JSON.stringify(msg)}`)
                break
            default:
                console.log(`Invalid message type ${msg.type}`)
                break
        }
    }
    
    const getMetricsNames = async (cluster:Cluster) => {
        try {
            cluster.metricsList=new Map()
            var response = await fetch (`${backendUrl}/metrics`, addGetAuthorization(accessString))
            var json=await response.json() as MetricDescription[]
            json.map( jsonMetric => cluster.metricsList.set(jsonMetric.metric, jsonMetric))
            console.log(`Metrics for cluster ${cluster.name} have been received`)
            console.log(cluster.metricsList)
        }
        catch (err) {
            console.log('Error obtaining metrics list')
            console.log(err)
        }
    }

    const onClickMetricsStart = () => {
        setShowMetricsSelector(true)
    }

    const startMetrics = (tab:TabObject) => {
        if (!tab || !tab.metricsObject) return
        var cluster=clusters!.find(c => c.name===tab.metricsObject!.cluster)
        if (!cluster) {
            setMsgBox(MsgBoxOk('Kwirth',`Cluster set at metrics configuration (${tab.metricsObject.cluster}) does not exist.`, setMsgBox))
            return
        }
 
        if (tab.ws?.OPEN) {
            tab.metricsObject.values=[]
            var mc:MetricsConfig = {
                action: ServiceConfigActionEnum.START,
                flow: ServiceConfigFlowEnum.REQUEST,
                channel: ServiceConfigChannelEnum.METRICS,
                instance: '',
                interval: tab.metricsObject.interval,
                aggregate: tab.metricsObject.aggregate,
                accessKey: cluster!.accessString,
                scope: ServiceConfigScopeEnum.STREAM,
                view: tab.metricsObject.view!,
                namespace: tab.metricsObject.namespace!,
                set: tab.metricsObject.group!,
                group: tab.metricsObject.group!,
                pod: tab.metricsObject.pod!,
                container: tab.metricsObject.container!,
                mode: tab.metricsObject.mode,
                metrics: tab.metricsObject.metrics
            }
            tab.ws.send(JSON.stringify(mc))
            tab.metricsObject.started=true
        }
        else {
            console.log('Tab web socket is not started')
        }
    }

    const onClickMetricsStop = () => {
        setAnchorMenuTab(null)
        if (selectedTab && selectedTab.metricsObject) stopMetrics(selectedTab)
    }

    const stopMetrics = (tab:TabObject) => {
        if (!tab.metricsObject) return
        var cluster=clusters!.find(c => c.name===tab.metricsObject!.cluster)
        var mc:MetricsConfig = {
            action: ServiceConfigActionEnum.STOP,
            flow: ServiceConfigFlowEnum.REQUEST,
            channel: ServiceConfigChannelEnum.METRICS,
            instance: tab.metricsObject.serviceInstance,
            mode: tab.metricsObject.mode,
            metrics: [],
            accessKey: cluster!.accessString,
            view: tab.metricsObject.view!,
            scope: ServiceConfigScopeEnum.NONE,
            namespace: '',
            group: '',
            set: '',
            pod: '',
            container: ''
        }
        if (tab.ws) tab.ws.send(JSON.stringify(mc))
        tab.metricsObject.started=false
    }

    const onClickMetricsPause = () => {
        setAnchorMenuTab(null)
        if (!selectedTab || !selectedTab.metricsObject) return

        if (selectedTab.metricsObject.paused) {
            selectedTab.metricsObject.paused=false
            setPausedTabs(tabs.filter(t => t.metricsObject?.paused))
        }
        else {
            selectedTab.metricsObject.paused=true
            setPausedTabs( (prev) => [...prev, selectedTab!])
        }
    }

    const startTab = (tab:TabObject) => {
        if (tab.logObject) startLog(tab)
        if (tab.metricsObject) startMetrics(tab)
    }

    const onClickStopTab = () => {    
        setAnchorMenuTab(null)
        if (selectedTab) stopTab(selectedTab)
    }

    const stopTab = (tab:TabObject) => {
        if (tab.logObject) stopLog(tab)
        if (tab.metricsObject) stopMetrics(tab)
    }

    const onClickTabRemove = () => {
        setAnchorMenuTab(null)
        if (!selectedTab) return

        if (selectedTab.logObject) stopLog(selectedTab)
        if (selectedTab.metricsObject) stopMetrics(selectedTab)
        if (tabs.length===1)
            setLogMessages([])
        else
            onChangeTabs(null,tabs[0].name)
        setTabs(tabs.filter(t => t!==selectedTab))
    }

    const onClickStartLog = () => {
        setAnchorMenuTab(null)
        var tab=tabs.find(t => t.name===selectedTabRef.current)
        if (tab && tab.logObject) startLog(tab)
    }

    const startLog = (tab:TabObject) => {
        if (!tab || !tab.logObject) return
        tab.logObject.maxMessages=settings!.logMaxMessages
        tab.logObject.previous=settings!.logPrevious
        tab.logObject.addTimestamp=settings!.logTimestamp
        tab.logObject.messages=[]
        var cluster=clusters!.find(c => c.name===tab.logObject!.cluster)
        if (!cluster) {
            setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at log configuration ${tab.logObject.cluster} does not exist.`, setMsgBox))
            return
        }

        if (tab.ws?.OPEN) {
            var logConfig:LogConfig = {
                action: ServiceConfigActionEnum.START,
                flow: ServiceConfigFlowEnum.REQUEST,
                channel: ServiceConfigChannelEnum.LOG,
                instance: '',
                accessKey: cluster!.accessString,
                scope: ServiceConfigScopeEnum.VIEW,
                view: tab.logObject.view!,
                namespace: tab.logObject.namespace!,
                set: tab.logObject.group!, // transitional
                group: tab.logObject.group!,
                pod: tab.logObject.pod!,
                container: tab.logObject.container!,
                timestamp: tab.logObject.addTimestamp!,
                previous: tab.logObject.previous!,
                maxMessages: tab.logObject.maxMessages!
            }
            tab.ws.send(JSON.stringify(logConfig))
            tab.logObject.started=true
            setLogMessages([])
        }
        else {
            console.log('Tab websocket is not  open')
        }
    }

    const stopLog = (tab:TabObject) => {
        if (!tab || !tab.logObject) return
        var endline='=============================================================================================='
        tab.logObject.messages.push( {text:endline} as LogMessage)

        if (tab.ws) {
            var cluster=clusters!.find(c => c.name===tab.logObject!.cluster)
            var lc:LogConfig = {
                action: ServiceConfigActionEnum.STOP,
                flow: ServiceConfigFlowEnum.REQUEST,
                channel: ServiceConfigChannelEnum.LOG,
                instance: tab.logObject.serviceInstance,
                accessKey: cluster!.accessString,
                view: ServiceConfigViewEnum.NONE,
                scope: ServiceConfigScopeEnum.NONE,
                namespace: '',
                group: '',
                set: '',
                pod: '',
                container: '',
                timestamp: false,
                previous: false,
                maxMessages: 0
            }
            tab.ws.send(JSON.stringify(lc))
        }

        tab.logObject.started=false
        tab.logObject.paused=false
        setPausedTabs(tabs.filter(t => t.logObject?.paused))
        setLogMessages(tab.logObject.messages)
    }

    const onClickLogPause = () => {
        setAnchorMenuTab(null)
        if (!selectedTab || !selectedTab.logObject) return

        if (selectedTab.logObject.paused) {
            selectedTab.logObject.paused=false
            setLogMessages(selectedTab.logObject.messages)
            setPausedTabs(tabs.filter(t => t.logObject?.paused))
        }
        else {
            selectedTab.logObject.paused=true
            setPausedTabs( (prev) => [...prev, selectedTab!])
        }
    }

    const onChangeLogFilter = (event:ChangeEvent<HTMLInputElement>) => {
        if (selectedTab && selectedTab.logObject) selectedTab.logObject.filter=event.target.value
        setFilter(event.target.value)
    }

    const menuTabOptionSelected = (option: MenuTabOption) => {
        setAnchorMenuTab(null)
        switch(option) {
            case MenuTabOption.TabInfo:
                var a=`
                    <b>Name</b>: ${selectedTab?.name}<br/>
                    <b>View</b>: ${selectedTab?.logObject?.view}<br/>
                    <b>Namespace</b>: ${selectedTab?.logObject?.namespace}<br/>
                    <b>Group</b>: ${selectedTab?.logObject?.group}<br/>
                    <b>Pod</b>: ${selectedTab?.logObject?.pod}<br/>
                    <b>Container</b>: ${selectedTab?.logObject?.container}
                `
                setMsgBox(MsgBoxOk('Tab info',a,setMsgBox))
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
            case MenuTabOption.LogBackground:
                if (selectedTab && selectedTab.logObject) selectedTab.logObject.showBackgroundNotification=!selectedTab.logObject.showBackgroundNotification
                break
            case MenuTabOption.LogTimestamp:
                if (selectedTab && selectedTab.logObject) selectedTab.logObject.addTimestamp=!selectedTab.logObject.addTimestamp
                break
            case MenuTabOption.AlarmCreate:
                setShowAlarmConfig(true)
                break
            case MenuTabOption.ManageAlarms:
                setShowManageAlarms(true)
                break
            case MenuTabOption.TabSetDefault:
                if (selectedTab && selectedTab.logObject) selectedTab.defaultTab=true
                break
            case MenuTabOption.LogStart:
                onClickStartLog()
                break
            case MenuTabOption.LogPause:
                onClickLogPause()
                break
            case MenuTabOption.LogStop:
                onClickStopTab()
                break
            case MenuTabOption.TabManageRestart:
                switch(selectedTab && selectedTab.logObject?.view) {
                    case ServiceConfigViewEnum.GROUP:
                        // restart a deployment
                        fetch (`${backendUrl}/managecluster/restartdeployment/${selectedTab?.logObject?.namespace}/${selectedTab?.logObject?.group}`, addPostAuthorization(accessString))
                        break
                    case ServiceConfigViewEnum.POD:
                        // restart a pod
                        fetch (`${backendUrl}/managecluster/restartpod/${selectedTab?.logObject?.namespace}/${selectedTab?.logObject?.pod}`, addPostAuthorization(accessString))
                        break
                }
                break
            case MenuTabOption.MetricsStart:
                onClickMetricsStart()
                break
            case MenuTabOption.MetricsAdd:
                // +++ we have 2 options here:
                // Add new metrics to current metricsobject metrics'
                // create an array of metrics objects
                //onClickMetricsStart()
                break
            case MenuTabOption.MetricsPause:
                onClickMetricsPause()
                break
            case MenuTabOption.MetricsStop:
                onClickMetricsStop()
                break
        }
    }

    const saveBoard = (boardName:string) => {
        var newTabs:TabObject[]=[]
        for (var tab of tabs) {
            var newTab = new TabObject()
            newTab.name=tab.name
            newTab.defaultTab=tab.defaultTab
            if (tab.logObject) {
                newTab.logObject=new LogObject()
                newTab.logObject.addTimestamp=tab.logObject.addTimestamp
                newTab.logObject.alarms=tab.logObject.alarms
                newTab.logObject.cluster=tab.logObject.cluster
                newTab.logObject.filter=tab.logObject.filter
                newTab.logObject.view=tab.logObject.view
                newTab.logObject.namespace=tab.logObject.namespace
                newTab.logObject.group=tab.logObject.group
                newTab.logObject.pod=tab.logObject.pod
                newTab.logObject.container=tab.logObject.container
                newTab.logObject.paused=tab.logObject.paused
                newTab.logObject.showBackgroundNotification=tab.logObject.showBackgroundNotification
                newTab.logObject.started=tab.logObject.started
            }
            if (tab.metricsObject) {
                newTab.metricsObject=new MetricsObject()
                newTab.metricsObject.name=tab.metricsObject.name
                newTab.metricsObject.cluster=tab.metricsObject.cluster
                newTab.metricsObject.view=tab.metricsObject.view
                newTab.metricsObject.namespace=tab.metricsObject.namespace
                newTab.metricsObject.group=tab.metricsObject.group
                newTab.metricsObject.pod=tab.metricsObject.pod
                newTab.metricsObject.container=tab.metricsObject.container
                newTab.metricsObject.cluster=tab.metricsObject.cluster
                newTab.metricsObject.alarms=tab.metricsObject.alarms
                newTab.metricsObject.started=tab.metricsObject.started
            }
            newTabs.push(newTab)
        }
        var payload=JSON.stringify(newTabs)
        fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addPostAuthorization(accessString, payload))
        if (currentBoardName!==boardName) setCurrentBoardName(boardName)
    }

    const showNoBoards = () => {
        setMsgBox(MsgBoxOk('Board management','You have no boards stored in your personal Kwirth space', setMsgBox))
    }

    const loadBoard = async () => {
        var allBoards:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
        if (allBoards.length===0)
            showNoBoards()
        else
            pickList('Load board...','Please, select the board you want to load:',allBoards,loadBoardSelected)
    }

    const clearTabs = () => {
        for (var tab of tabs) {
            stopTab(tab)
        }
        setTabs([])
        setLogMessages([])
    }

    const menuDrawerOptionSelected = async (option:MenuDrawerOption) => {
        setMenuDrawerOpen(false)
        switch(option) {
            case MenuDrawerOption.NewView:
                clearTabs()
                setCurrentBoardName('untitled')
                break
            case MenuDrawerOption.SaveView:
                if (currentBoardName!=='' && currentBoardName!=='untitled')
                    saveBoard(currentBoardName)
                else
                    setShowSaveBoard(true)
                break
            case MenuDrawerOption.SaveViewAs:
                setShowSaveBoard(true)
                break
            case MenuDrawerOption.OpenView:
                loadBoard()
                break
            case MenuDrawerOption.DeleteView:
                var allBoards:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
                if (allBoards.length===0)
                    showNoBoards()
                else
                    pickList('Board delete...','Please, select the board you want to delete:',allBoards,deleteBoardSelected)
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
            case MenuDrawerOption.Settings:
                setShowSettingsConfig(true)
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

    const deleteBoardSelected = (boardName:string) => {
        setMsgBox(MsgBoxYesNo('Delete board',`Are you ure you want to delete board ${boardName}`,setMsgBox, (button) => {
            if (button===MsgBoxButtons.Yes) {
                fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addDeleteAuthorization(accessString))
                setCurrentBoardName('')
            }
        }))
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

    const alarmConfigClosed = (alarm:Alarm) => {
        setShowAlarmConfig(false)
        if (alarm.expression) {
            var al=new Alarm()
            al.expression=alarm.expression
            al.severity=alarm.severity
            al.message=alarm.message
            al.type=alarm.type
            al.beep=alarm.beep
            selectedTab?.logObject?.alarms.push(al)
        }
    }

    const settingsClosed = (newSettings:Settings) => {
        setShowSettingsConfig(false)
        if (newSettings) writeSettings(newSettings)
    }

    const onMetricsSelected = (metrics:string[], mode:MetricsConfigModeEnum, depth:number, width:number, interval:number, aggregate:boolean) => {
        setShowMetricsSelector(false)
        setAnchorMenuTab(null)
        if (metrics.length===0) return

        var tab=tabs.find(t => t.name===selectedTabRef.current)
        if (!tab || !tab.metricsObject) return
        tab.metricsObject.metrics=metrics
        tab.metricsObject.mode=mode
        tab.metricsObject.depth=depth
        tab.metricsObject.width=width
        tab.metricsObject.interval=interval
        tab.metricsObject.aggregate=aggregate
        startMetrics(tab)
    }

    const renameTabClosed = (newname:string|null) => {
        setShowRenameLog(false)
        if (newname!=null) {
            selectedTab!.name=newname
            setTabs(tabs)
            setSelectedTabName(newname)
        }
    }

    const saveBoardClosed = (boardName:string|null) => {
        setShowSaveBoard(false)
        if (boardName) saveBoard(boardName)
    }

    const loadBoardSelected = async (boardName:string) => {
        if (boardName) {
            clearTabs()
            var n = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addGetAuthorization(accessString))).json()
            var newTabs=JSON.parse(n) as TabObject[]
            setTabs(newTabs)
            setBoardLoaded(true)
            setCurrentBoardName(boardName)
            var defaultTab=newTabs.find(l => l.defaultTab)
            if (defaultTab) setSelectedTabName(defaultTab.name)
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

    const manageClustersClosed = (cc:Cluster[]) => {
        setShowManageClusters(false)
        var payload=JSON.stringify(cc)
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addPostAuthorization(accessString, payload))
        setClusters(cc)
    }

    const onCloseLogin = (result:boolean, user:User, accessKey:string) => {
        if (result) {
            setLogged(true)
            setUser(user)
            setAccessString(accessKey)
            setCurrentBoardName('untitled')
            clearTabs()
        }
    }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessKey: accessString, logged, backendUrl }}>
                <Login onClose={onCloseLogin}></Login>
            </SessionContext.Provider>
        </div>
    </>)

    return (<>
        <SessionContext.Provider value={{ user, accessKey: accessString, logged, backendUrl }}>
            <AppBar position="sticky" elevation={0} sx={{ zIndex: 99, height:'64px' }}>
                <Toolbar>
                <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 1 }} onClick={() => setMenuDrawerOpen(true)}><Menu /></IconButton>
                <Typography sx={{ ml:1,flexGrow: 1 }}>KWirth</Typography>
                <Typography variant="h6" component="div" sx={{mr:2}}>{currentBoardName}</Typography>
                <Tooltip title={<div style={{textAlign:'center'}}>{user?.id}<br/>{user?.name}<br/>[{user?.scope}]</div>} sx={{ mr:2 }}><Person/></Tooltip>
                </Toolbar>
            </AppBar>

            <Drawer sx={{ flexShrink: 0, '& .MuiDrawer-paper': {mt: '64px'} }} anchor="left" open={menuDrawerOpen} onClose={() => setMenuDrawerOpen(false)}>
                <Stack direction={'column'}>
                <MenuDrawer optionSelected={menuDrawerOptionSelected} uploadSelected={handleUpload} user={user}/>
                <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} onAdd={onResourceSelectorAdd} sx={{ mt:1, ml:1 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedTabName} onChange={onChangeTabs} variant="scrollable" scrollButtons="auto" sx={{ml:1}}>
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

                    { (tabs.length>0) && <>
                        <Stack direction="row" alignItems="bottom" sx={{ width:'200px', mr:1}}>
                            <TextField value={filter} onChange={onChangeLogFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')} disabled={!selectedTab?.logObject}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard" disabled={!selectedTab?.logObject}/>
                        </Stack>
                    </>}
                </Stack>

                { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs} selectedTab={selectedTab} selectedTabIndex={selectedTabIndex} />}

                {/* <TabContent log={selectedTab?.logObject} filter={filter} search={search} lastLineRef={lastLineRef} metricsObject={selectedTab?.metricsObject} values={receivedMetricValues}/> */}
                <TabContent logObject={selectedTab?.logObject} filter={filter} search={search} lastLineRef={lastLineRef} metricsObject={selectedTab?.metricsObject}/>
            </Box>

            { showAlarmConfig && <AlarmConfig onClose={alarmConfigClosed} expression={filter}/> }
            { showBlockingAlarm && <BlockingAlarm onClose={() => setShowBlockingAlarm(false)} alarm={blockingAlarm} /> }
            { showRenameTab && <RenameTab onClose={renameTabClosed} tabs={tabs} oldname={selectedTab?.name}/> }
            { showSaveBoard && <SaveBoard onClose={saveBoardClosed} name={currentBoardName} /> }
            { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }
            {/* { showManageAlarms && <ManageAlarms onClose={() => setShowManageAlarms(false)} log={selectedLog}/> } */}
            { showSettingsConfig && <SettingsConfig  onClose={settingsClosed} settings={settings} /> }
            { showMetricsSelector && <MetricsSelector  onMetricsSelected={onMetricsSelected} settings={settings} metricsList={clusters!.find(c => c.name===selectedTab!.metricsObject!.cluster)?.metricsList!} /> }
            { initialMessage!=='' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            { pickListConfig!==null && <PickList config={pickListConfig}/> }
            { msgBox }
        </SessionContext.Provider>
    </>)
}

export default App