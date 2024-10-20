import { useState, useRef, ChangeEvent, useEffect } from 'react';

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
import RenameLog from './components/RenameLog'
import SaveBoard from './components/SaveBoard'
import ManageApiSecurity from './components/ManageApiSecurity'
import PickList from './components/PickList'
import Login from './components/Login'
import ManageClusters from './components/ManageClusters'
import ManageUserSecurity from './components/ManageUserSecurity'
import ManageAlarms from './components/ManageAlarms'
import ResourceSelector from './components/ResourceSelector'
import LogContent from './components/LogContent'
import SettingsConfig from './components/SettingsConfig'
import { MenuLog, MenuLogOption } from './menus/MenuLog'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { VERSION } from './version'
import { MsgBoxButtons, MsgBoxOk, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { LogConfig, LogMessage, MetricsConfig, MetricsConfigModeEnum, MetricsMessage, ServiceConfigTypeEnum } from '@jfvilas/kwirth-common'
import { MetricsObject } from './model/MetricsObject';

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

    const [logs, setLogs] = useState<LogObject[]>([])
    const [highlightedLogs, setHighlightedLogs] = useState<LogObject[]>([])
    const [pausedLogs, setPausedLogs] = useState<LogObject[]>([])

    const [selectedLogName, setSelectedLogName] = useState<string>()
    const selectedLogRef = useRef(selectedLogName)
    selectedLogRef.current=selectedLogName
    var selectedLog = logs.find(t => t.name===selectedLogName)
    var selectedLogIndex = logs.findIndex(t => t.name===selectedLogName)
    const [receivedMetrics, setReceivedMetrics] = useState<MetricsMessage[]>([])

    // message list management
    const [logMessages, setLogMessages] = useState<LogMessage[]>([])  //+++ i think this is not being used right now
    //const searchLineRef = useRef(null)
    const lastLineRef = useRef(null)

    // search & filter
    const [filter, setFilter] = useState<string>('')
    const [search, setSearch] = useState<string>('')
    // const [searchPos, setSearchPos] = useState<number>(0);
    // const [searchFirstPos, setSearchFirstPos] = useState<number>(-1);
    // const [searchLastPos, setSearchLastPos] = useState<number>(-1);

    // general
    const [settings, setSettings] = useState<Settings>()
    const settingsRef = useRef(settings)
    settingsRef.current=settings

    // menus/navigation
    const [anchorMenuLog, setAnchorMenuLog] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // dialogs
    const [pickListConfig, setPickListConfig] = useState<PickListConfig|null>(null)
    var pickListConfigRef=useRef(pickListConfig)
    pickListConfigRef.current=pickListConfig

    // components
    const [showAlarmConfig, setShowAlarmConfig]=useState<boolean>(false)
    const [showBlockingAlarm, setShowBlockingAlarm]=useState<boolean>(false)
    const [showRenameLog, setShowRenameLog]=useState<boolean>(false)
    const [showManageClusters, setShowManageClusters]=useState<boolean>(false)
    const [showSaveBoard, setShowSaveBoard]=useState<boolean>(false)
    const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false)
    const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false)
    const [showManageAlarms, setShowManageAlarms]=useState<boolean>(false)
    const [showSettingsConfig, setShowSettingsConfig]=useState<boolean>(false)
    const [blockingAlarm, setBlockingAlarm] = useState<Alarm>()
    const [boardLoaded, setBoardLoaded] = useState<boolean>(false)
    const [currentBoardName, setCurrentBoardName] = useState('')
    const [showPickList, setShowPickList]=useState<boolean>(false)
    
    useEffect ( () => {
        //+++ add a settings section for a log object (like settings, but specific)
        //+++ work on alarms and create and alarm manager
        //+++ when a board is loaded all messages are received: alarms should not be in effect until everything is received
        //+++ implement role checking on backend
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
            if (logs.length>0) {
                for (var t of logs)
                    startLog(t)
                onChangeLogs(null, logs[0].name)
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

        // get previously configured clusters
        var clusterList:Cluster[]=[]
        var response = await fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addGetAuthorization(accessString))
        if (response.status===200) {
            clusterList=JSON.parse (await response.json())
            clusterList=clusterList.filter (c => c.name!==srcCluster.name)
        }

        clusterList.push(srcCluster)
        setClusters(clusterList)
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

    const onResourceSelectorAdd = (selection:any) => {
        var logName=selection.logName

        // create unduplicated (unique) name
        var index=-1
        while (logs.find (l => l.name===logName+index)) index-=1

        var newLog:LogObject= new LogObject()
        newLog.cluster=selection.clusterName
        newLog.view=selection.view
        newLog.namespace=selection.namespace
        newLog.group=selection.group
        newLog.pod=selection.pod
        newLog.container=selection.container
        newLog.name=logName+index

        logs.push(newLog)
        setLogMessages([])
        setLogs(logs)
        setSelectedLogName(newLog.name)
        setFilter('')
        setSearch('')
    }

    const onChangeLogs = (event:any,logName?:string)=> {
        var newlog = logs.find(log => log.name === logName);
        if (newlog) {
            newlog.pending=false
            setHighlightedLogs (highlightedLogs.filter(t => t.pending))
            setPausedLogs (pausedLogs.filter(log => log.paused))
            setFilter(newlog.filter)
            setLogMessages(newlog.messages)
            setLogs(logs)
            setSelectedLogName(logName)
        }
    }

    const processSignalMessage = (event:any) => {
        // console.log('SIGNAL MESSAGE')
        // console.log(event)
    }

    const processLogMessage = (event:any) => {
        // find the log who this web socket belongs to, and add the new message
        var log=logs.find(log => log.ws!==null && log.ws===event.target) as LogObject
        if (!log) return

        var msg = JSON.parse(event.data) as LogMessage
        log.messages.push(msg)
        while (log.messages.length>log.maxMessages) log.messages.splice(0,1)

        // if current log is displayed (focused), add message to the screen
        if (selectedLogRef.current === log.name) {
            if (!log.paused) {
                setLogMessages([]);  //+++ this forces LogContent to re-render +++ change to any other thing
                if (lastLineRef.current) (lastLineRef.current as any).scrollIntoView({ behavior: 'instant', block: 'start' })
            }
        }
        else {
            // the received message is for a log that is no selected, so we highlight the log if background notification is enabled
            if (log.showBackgroundNotification && !log.paused) {
                log.pending=true
                setHighlightedLogs((prev)=> [...prev, log!])
                setLogs(logs)
            }
        }

        for (var alarm of log.alarms) {
            if (msg.text.includes(alarm.expression)) {
                if (alarm.beep) Beep.beepError()
                
                if (alarm.type===AlarmType.blocking) {
                    setBlockingAlarm(alarm)
                    setShowBlockingAlarm(true)
                }
                else {
                    const action = (snackbarId: SnackbarKey | undefined) => (<>
                        <Button onClick={() => { closeSnackbar(snackbarId); onChangeLogs(null,log.name); }}>
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
                        action: action
                    }
                    enqueueSnackbar(alarm.message, opts)
                }
            }
        }
    }

    const wsOnLogMessage = (event:any) => {
        var e:any={}
        try {
            e=JSON.parse(event.data)
        }
        catch (err) {
            console.log(err)
            console.log(event.data)
            return
        }

        switch(e.type) {
            case 'info':
            case 'warning':
            case 'error':
                processSignalMessage(event)
                break
            case 'log':
                processLogMessage(event)
                break
            case 'metrics':
                processMetricsMessage(event)
                break
        }
    }

    const processMetricsMessage = (event:any) => {
        var msg=JSON.parse(event.data) as MetricsMessage
        var pos = receivedMetrics.findIndex( m => m.namespace===msg.namespace && m.podName===msg.podName && m.metrics.join(',')===msg.metrics.join(','))
        if (pos>=0)
            receivedMetrics[pos]=msg
        else
            receivedMetrics.push (msg)
        setReceivedMetrics(Array.from(receivedMetrics))
    }
    
    const wsOnMetricsMessage = (event:any) => {
        var e:any={}
        try {
            e=JSON.parse(event.data)
        }
        catch (err) {
            console.log(err)
            console.log(event.data)
            return
        }

        switch(e.type) {
            case 'info':
            case 'warning':
            case 'error':
                processSignalMessage(event)
                break
            case 'metrics':
                processMetricsMessage(event)
                break
        }
    }

    const getMetricsNames = async (cluster:Cluster) => {
        cluster.metricList=new Map()
        var response = await fetch (`${backendUrl}/metrics`, addGetAuthorization(accessString))
        var lines=await response.text()
        // # HELP cadvisor_version_info A metric with a constant '1' value labeled by kernel version, OS version, docker version, cadvisor version & cadvisor revision.
        // # TYPE cadvisor_version_info gauge
        for (var l of lines.split('\n')) {
            var [_,lineType,name,metricType] = l.split(' ')
            if (!cluster.metricList.has(name) && name) cluster.metricList.set(name, {type: '', help: ''})
            switch (lineType){
                case 'HELP':
                    var i=l.indexOf(name)
                    var text=l.substring(i+name.length)
                    cluster.metricList.get(name)!.help=text
                    break
                case 'TYPE':
                    cluster.metricList.get(name)!.type = metricType
                    break
            }
        }
        console.log(cluster.metricList)
    }

    const startMetrics = (log:LogObject) => {
        var cluster=clusters!.find(c => c.name===log.cluster)
        if (!cluster) {
            setMsgBox(MsgBoxOk('Kwirth',`Cluster set at metrics configuration (${log.cluster}) does not exist.`, setMsgBox))
            return
        }

        if (!cluster.metricList) getMetricsNames(cluster)
        var mo:MetricsObject={
            name:'metric1',
            cluster:log.cluster,
            view:log.view,
            namespace:log.namespace,
            group:log.group,
            pod:log.pod,
            container:log.container,
            started: false,
            ws:log.ws,
            alarms: []
        }

        if (mo.ws===null)  {
            mo.ws = new WebSocket(cluster.url)
            mo.ws.onopen = () => {
                console.log(`WS Metrics connected: ${mo.ws!.url}`)
                var mc:MetricsConfig = {
                    type: ServiceConfigTypeEnum.METRICS,
                    interval: 5,
                    accessKey: cluster!.accessString,
                    scope: 'stream',
                    view: log.view!,
                    namespace: log.namespace!,
                    set: log.group!,
                    group: log.group!,
                    pod: log.pod!,
                    container: log.container!,
                    mode: MetricsConfigModeEnum.STREAM,
                    metrics: ['container_fs_writes_total',
                        'container_fs_reads_total',
                        'container_cpu_usage_seconds_total',
                        'container_memory_usage_bytes',
                        'container_network_receive_bytes_total',
                        'container_network_transmit_bytes_total'
                    ]
                }
                mo.ws!.send(JSON.stringify(mc))
                log.started=true
            }
        }
        else {
            var mc:MetricsConfig = {
                type: ServiceConfigTypeEnum.METRICS,
                interval: 5,
                accessKey: cluster!.accessString,
                scope: 'stream',
                view: log.view!,
                namespace: log.namespace!,
                set: log.group!,
                group: log.group!,
                pod: log.pod!,
                container: log.container!,
                mode: MetricsConfigModeEnum.STREAM,
                metrics: ['container_fs_writes_total',
                    'container_fs_reads_total',
                    'container_cpu_usage_seconds_total',
                    'container_memory_usage_bytes',
                    'container_network_receive_bytes_total',
                    'container_network_transmit_bytes_total'
                ]
            }
            mo.ws!.send(JSON.stringify(mc))
        }
        mo.ws.onmessage = (event) => wsOnMetricsMessage(event)
        mo.ws.onclose = (event) => console.log(`WS metrics disconnected: ${mo.ws!.url}`)
    }

    const onClickMetricsStart = () => {
        var log=logs.find(l => l.name===selectedLogRef.current)
        if (log) {
            startMetrics(log)
        }
        else {
            setMsgBox(MsgBoxOk('Log object', 'No log selected',setMsgBox))
        }
        setAnchorMenuLog(null)
    }

    const startLog = (log:LogObject) => {
        log.maxMessages=settings!.maxMessages
        log.previous=settings!.previous
        log.addTimestamp=settings!.timestamp
        log.messages=[]
        var cluster=clusters!.find(c => c.name===log.cluster)
        if (!cluster) {
            console.log('nocluster')
            setMsgBox(MsgBoxOk('Kwirth',`Cluster established at log configuration ${log.cluster} does not exist.`, setMsgBox))
            return
        }
        if (!cluster.metricList) getMetricsNames(cluster)

        var ws = new WebSocket(cluster.url)
        log.ws=ws
        ws.onopen = () => {
            console.log(`WS connected: ${ws.url}`)
            var lc:LogConfig={
                type: ServiceConfigTypeEnum.LOG,
                accessKey: cluster!.accessString,
                scope: 'view',
                view: log.view!,
                namespace: log.namespace!, 
                set: log.group!,
                group: log.group!,
                pod: log.pod!, 
                container: log.container!,
                timestamp: log.addTimestamp!,
                previous: log.previous!,
                maxMessages: log.maxMessages!
            }                
            ws.send(JSON.stringify(lc))
            log.started=true
        }
        
        ws.onmessage = (event) => wsOnLogMessage(event)
        ws.onclose = (event) => console.log(`WS disconnected: ${ws.url}`)
        setLogMessages([])
    }

    const onClickLogStart = () => {
        var log=logs.find(l => l.name===selectedLogRef.current)
        if (log) startLog(log)
        setAnchorMenuLog(null)
    }

    const stopLog = (log:LogObject) => {
        var endline='=============================================================================================='
        log.messages.push({ text:endline} as LogMessage)
        log.started=false
        log.paused=false
        if (log.ws) log.ws.close()
        setPausedLogs(logs.filter(t => t.paused))
        setLogMessages(log.messages)
    }

    const stopMetrics = (log:LogObject) => {
        // var endline='=============================================================================================='
        // log.messages.push({ text:endline} as LogMessage)
        // log.started=false
        // log.paused=false
        // if (log.ws) log.ws.close()
        // setPausedLogs(logs.filter(t => t.paused))
        // setLogMessages(log.messages)
    }

    const onClickLogStop = () => {    
        setAnchorMenuLog(null)
        if (selectedLog) stopLog(selectedLog)
    }

    const onClickMetricsStop = () => {    
        setAnchorMenuLog(null)
        if (selectedLog) stopMetrics(selectedLog)
    }

    const onClickLogRemove = () => {
        setAnchorMenuLog(null);
        if (!selectedLog) return

        stopLog(selectedLog)
        if (logs.length===1)
            setLogMessages([])
        else
            onChangeLogs(null,logs[0].name)
        setLogs(logs.filter(t => t!==selectedLog))
    }

    const onClickLogPause = () => {
        setAnchorMenuLog(null)
        if (!selectedLog) return

        if (selectedLog.paused) {
            selectedLog.paused=false
            setLogMessages(selectedLog.messages)
            setPausedLogs(logs.filter(t => t.paused))
        }
        else {
            selectedLog.paused=true
            setPausedLogs( (prev) => [...prev, selectedLog!])
        }
    }

    const onChangeFilter = (event:ChangeEvent<HTMLInputElement>) => {
        if (selectedLog) selectedLog.filter=event.target.value
        setFilter(event.target.value)
    }

    const menuLogOptionSelected = (option: MenuLogOption) => {
        setAnchorMenuLog(null);
        switch(option) {
            case MenuLogOption.LogOrganizeInfo:
                var a=`
                    <b>Name</b>: ${selectedLog?.name}<br/>
                    <b>View</b>: ${selectedLog?.view}<br/>
                    <b>Namespace</b>: ${selectedLog?.namespace}<br/>
                    <b>Group</b>: ${selectedLog?.group}<br/>
                    <b>Pod</b>: ${selectedLog?.pod}<br/>
                    <b>Container</b>: ${selectedLog?.container}
                `
                setMsgBox(MsgBoxOk('Log info',a,setMsgBox))
                break
            case MenuLogOption.LogOrganizeRename:
                setShowRenameLog(true)
                break
            case MenuLogOption.LogOrganizeMoveLeft:
                if (selectedLog) {
                    logs[selectedLogIndex]=logs[selectedLogIndex-1]
                    logs[selectedLogIndex-1]=selectedLog
                    setLogs(logs)
                }
                break
            case MenuLogOption.LogOrganizeMoveRight:
                if (selectedLog) {
                    logs[selectedLogIndex]=logs[selectedLogIndex+1]
                    logs[selectedLogIndex+1]=selectedLog
                    setLogs(logs)
                }
                break
            case MenuLogOption.LogOrganizeMoveFirst:
                if (selectedLog) {
                    logs.splice(selectedLogIndex, 1)
                    logs.splice(0, 0, selectedLog)
                    setLogs(logs)
                }
                break
            case MenuLogOption.LogOrganizeMoveLast:
                if (selectedLog) {
                    logs.splice(selectedLogIndex, 1)
                    logs.push(selectedLog)
                    setLogs(logs)
                }
                break
            case MenuLogOption.LogOptionsBackground:
                if (selectedLog) selectedLog.showBackgroundNotification=!selectedLog.showBackgroundNotification
                break
            case MenuLogOption.LogOptionsTimestamp:
                if (selectedLog) selectedLog.addTimestamp=!selectedLog.addTimestamp
                break
            case MenuLogOption.LogAlarmCreate:
                setShowAlarmConfig(true)
                break
            case MenuLogOption.LogManageAlarms:
                setShowManageAlarms(true)
                break
            case MenuLogOption.LogOrganizeDefault:
                if (selectedLog) selectedLog.defaultLog=true
                break
            case MenuLogOption.LogActionsStart:
                onClickLogStart()
                break
            case MenuLogOption.LogActionsPause:
                onClickLogPause()
                break
            case MenuLogOption.LogActionsStop:
                onClickLogStop()
                break
            case MenuLogOption.LogActionsRemove:
                onClickLogRemove()
                break
            case MenuLogOption.LogManageRestart:
                switch(selectedLog?.view) {
                    case 'group':
                    case 'set':
                        // restart a deployment
                        fetch (`${backendUrl}/managecluster/restartdeployment/${selectedLog.namespace}/${selectedLog.group}`, addPostAuthorization(accessString))
                        break
                    case 'pod':
                        // restart a pod
                        fetch (`${backendUrl}/managecluster/restartpod/${selectedLog.namespace}/${selectedLog.pod}`, addPostAuthorization(accessString))
                        break
                }
                break
            case MenuLogOption.LogMetricsStart:
                onClickMetricsStart()
                break
            case MenuLogOption.LogMetricsStop:
                onClickMetricsStop()
                break
        }
    }

    const saveBoard = (boardName:string) => {
        var newLogs:LogObject[]=[]
        for (var log of logs) {
            var newLog = new LogObject()
            newLog.addTimestamp=log.addTimestamp
            newLog.alarms=log.alarms
            newLog.cluster=log.cluster
            newLog.filter=log.filter
            newLog.view=log.view
            newLog.namespace=log.namespace
            newLog.group=log.group
            newLog.pod=log.pod
            newLog.container=log.container
            newLog.defaultLog=log.defaultLog
            newLog.paused=log.paused
            newLog.showBackgroundNotification=log.showBackgroundNotification
            newLog.started=log.started
            newLog.name=log.name
            newLogs.push(newLog)
        }
        var payload=JSON.stringify(newLogs)
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

    const clearLogs = () => {
        for (var t of logs) {
            stopLog(t)
        }
        setLogs([])
        setLogMessages([])
    }

    const menuBoardOptionSelected = async (option:MenuDrawerOption) => {
        setMenuDrawerOpen(false)
        switch(option) {
        case MenuDrawerOption.NewView:
            clearLogs()
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
                showNoBoards();
            else
                pickList('Board delete...','Please, select the board you want to delete:',allBoards,deleteBoardSelected);
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
            var allBoards:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
            if (allBoards.length===0) {
                showNoBoards()
            }
            else {
                var content:any={}
                for (var boardName of allBoards) {
                    var readBoard = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addGetAuthorization(accessString))).json()
                    content[boardName]=JSON.parse(readBoard)
                }
                handleDownload(JSON.stringify(content),`${user?.id}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`)
            }
            break;
        case MenuDrawerOption.ImportBoards:
            // nothing to do, the menuitem launches the handleUpload
            break;
        case MenuDrawerOption.Settings:
            selectedLog=new LogObject()
            selectedLog.maxMessages=10001
            selectedLog.previous=true
            setShowSettingsConfig(true)
            break
        case MenuDrawerOption.UpdateKwirth:
            setMsgBox(MsgBoxYesNo('Update Kwirth',`This action will restart the Kwirth instance and users won't be able to work during 7 to 10 seconds. In addition, all volatile API keys will be deleted. Do you want to continue?`,setMsgBox, (button) => {
                if (button===MsgBoxButtons.Yes) {
                    fetch (`${backendUrl}/managekwirth/restart`, addGetAuthorization(accessString));
                }
            }))
            break
        case MenuDrawerOption.Exit:
            setLogged(false)
            break
        }
    };

    const deleteBoardSelected = (boardName:string) => {
        setMsgBox(MsgBoxYesNo('Delete board',`Are you ure you want to delete board ${boardName}`,setMsgBox, (button) => {
            if (button===MsgBoxButtons.Yes) {
                fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addDeleteAuthorization(accessString))
                setCurrentBoardName('')
            }
        }));
    }

    const handleDownload = (content:string,filename:string,  mimeType:string='text/plain') => {
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
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader()
            reader.onload = (e:any) => {
                var allBoards=JSON.parse(e.target.result)
                for (var boardName of Object.keys(allBoards)) {
                    var payload=JSON.stringify(allBoards[boardName])
                    fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addPostAuthorization(accessString, payload))
                }
            }
            reader.readAsText(file);
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
            selectedLog?.alarms.push(al)
        }
    }

    const settingsClosed = (newSettings:Settings) => {
        setShowSettingsConfig(false)
        if (newSettings) writeSettings(newSettings)
    }

    const renameLogClosed = (newname:string|null) => {
        setShowRenameLog(false)
        if (newname!=null) {
            selectedLog!.name=newname
            setLogs(logs)
            setSelectedLogName(newname)
        }
    }

    const saveBoardClosed = (boardName:string|null) => {
        setShowSaveBoard(false)
        if (boardName!=null) saveBoard(boardName)
    }

    const loadBoardSelected = async (boardName:string) => {
        if (boardName) {
            clearLogs()
            var n = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addGetAuthorization(accessString))).json()
            var newLogs=JSON.parse(n) as LogObject[]
            setLogs(newLogs)
            setBoardLoaded(true)
            setCurrentBoardName(boardName)
            var defaultLog=newLogs.find(l => l.defaultLog)
            if (defaultLog) setSelectedLogName(defaultLog.name)
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
            clearLogs()
        }
    }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessKey: accessString, logged, backendUrl }}>
                <Login onClose={onCloseLogin}></Login>
            </SessionContext.Provider>
        </div>
    </>);

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
                <MenuDrawer optionSelected={menuBoardOptionSelected} uploadSelected={handleUpload} user={user}/>
                <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <Box sx={{ display: 'flex', flexDirection: 'column', height: '92vh' }}>
                <ResourceSelector clusters={clusters} onAdd={onResourceSelectorAdd} sx={{ mt:1, ml:3, mr:3 }}/>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                    <Tabs value={selectedLogName} onChange={onChangeLogs} variant="scrollable" scrollButtons="auto" sx={{ml:1}}>
                    { logs.length>0 && logs.map(t => {
                        if (t===selectedLog) {
                            return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton onClick={(event) => setAnchorMenuLog(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                        }
                        else {
                            return <Tab key={t.name} label={t.name} value={t.name} icon={<IconButton><Box sx={{minWidth:'20px'}} /></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1, backgroundColor: (highlightedLogs.includes(t)?'pink':pausedLogs.includes(t)?'#cccccc':'')}}/>
                        }
                        })
                    }
                    </Tabs>

                    <Typography sx={{ flexGrow: 1 }}></Typography>

                    { (logs.length>0) && <>
                        <Stack direction="row" alignItems="bottom" sx={{ width:'200px', mr:1}}>
                        <TextField value={filter} onChange={onChangeFilter} InputProps={{ endAdornment: <IconButton onClick={()=>setFilter('')}><Clear fontSize='small'/></IconButton> }} label="Filter" variant="standard"/>

                        {/* <TextField value={search} onChange={onChangeSearch} InputProps={{ endAdornment: <IconButton onClick={()=>setSearch('')}><Clear fontSize='small'/></IconButton> }} sx={{ml:1}} label="Search" variant="standard" />
                        <Typography sx={{ ml:1 }}></Typography>
                        <IconButton onClick={onClickSearchUp} disabled={search==='' || searchFirstPos===searchPos}><ArrowUpward/> </IconButton>
                        <IconButton onClick={onClickSearchDown} disabled={search===''  || searchLastPos===searchPos}><ArrowDownward/> </IconButton> */}

                        </Stack>
                    </>}

                </Stack>
                { anchorMenuLog && <MenuLog onClose={() => setAnchorMenuLog(null)} optionSelected={menuLogOptionSelected} anchorMenuLog={anchorMenuLog} logs={logs} selectedLog={selectedLog} selectedLogIndex={selectedLogIndex} />}
                {/* <LogContent log={selectedLog} filter={filter} search={search} searchPos={searchPos} searchLineRef={searchLineRef} lastLineRef={lastLineRef}/> */}
                <LogContent log={selectedLog} filter={filter} search={search} lastLineRef={lastLineRef} metrics={receivedMetrics}/>
            </Box>

            { showAlarmConfig && <AlarmConfig onClose={alarmConfigClosed} expression={filter}/> }
            { showBlockingAlarm && <BlockingAlarm onClose={() => setShowBlockingAlarm(false)} alarm={blockingAlarm} /> }
            { showRenameLog && <RenameLog onClose={renameLogClosed} logs={logs} oldname={selectedLog?.name}/> }
            { showSaveBoard && <SaveBoard onClose={saveBoardClosed} name={currentBoardName} /> }
            { showManageClusters && <ManageClusters onClose={manageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }
            { showManageAlarms && <ManageAlarms onClose={() => setShowManageAlarms(false)} log={selectedLog}/> }
            { showSettingsConfig && <SettingsConfig  onClose={settingsClosed} settings={settings} /> }
            { pickListConfig!==null && <PickList config={pickListConfig}/> }
            { msgBox }
        </SessionContext.Provider>
    </>);
};

export default App;