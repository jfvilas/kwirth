import { useState, useRef, useEffect } from 'react'

// material & icons
import { AppBar, Box, Drawer, IconButton, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person } from '@mui/icons-material'

// model
import { User } from './model/User'
import { Cluster, KwirthData } from './model/Cluster'

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
import { SettingsCluster } from './components/settings/SettingsCluster'
import { SettingsUser } from './components/settings/SettingsUser'
import { MenuTab, MenuTabOption } from './menus/MenuTab'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { MsgBoxButtons, MsgBoxOk, MsgBoxOkError, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { FirstTimeLogin } from './components/FirstTimeLogin'
import { IBoard } from './model/IBoard'

import { VERSION } from './version'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { InstanceMessage, versionGreatThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageActionEnum, parseResources } from '@jfvilas/kwirth-common'
import { ITabObject } from './model/ITabObject'

import { ChannelConstructor, IChannel, IChannelMessageAction, ISetupProps } from './channels/IChannel'
import { LogChannel } from './channels/log/LogChannel'
import { EchoChannel } from './channels/echo/EchoChannel'
import { AlertChannel } from './channels/alert/AlertChannel'
import { MetricsChannel } from './channels/metrics/MetricsChannel'
import { TrivyChannel } from './channels/trivy/TrivyChannel'
import { OpsChannel } from './channels/ops/OpsChannel'
import { getMetricsNames, readClusterInfo } from './tools/Global'

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

    const selTab = useRef<ITabObject>()
    //const [selectedTab, setSelectedTab] = useState<ITabObject>()
    const [refreshTabContent, setRefreshTabContent] = useState(0)

    const settingsRef = useRef<Settings|null>(null)

    const [backChannels, setBackChannels] = useState<any[]>([])
    const backChannelsRef = useRef(backChannels)
    backChannelsRef.current= backChannels

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

    const createChannelInstance = (type: string): IChannel | null => {
        const channelClass = frontChannels.get(type)
        return channelClass ? new channelClass() : null
    }

    useEffect( () => {
        // only first time
        frontChannels.set('log', LogChannel)
        frontChannels.set('echo', EchoChannel)
        frontChannels.set('alert', AlertChannel)
        frontChannels.set('metrics', MetricsChannel)
        frontChannels.set('trivy', TrivyChannel)
        frontChannels.set('ops', OpsChannel)
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
        let response = await fetch(`${backendUrl}/config/info`, addGetAuthorization(accessString))
        let srcCluster = new Cluster()
        srcCluster.kwirthData = await response.json() as KwirthData
        srcCluster.name = srcCluster.kwirthData.clusterName
        srcCluster.url = backendUrl
        srcCluster.accessString = accessString
        srcCluster.source = true
        srcCluster.enabled = true
        let srcMetricsRequired = Array.from(srcCluster.kwirthData.channels).reduce( (prev, current) => { return prev || current.metrics}, false)
        if (srcMetricsRequired) getMetricsNames(srcCluster)
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
        for (let cluster of clusterList)
            readClusterInfo(cluster).then( () => { setRefreshTabContent(Math.random()) })
        clusterList.push(srcCluster)
        setClusters(clusterList)
    }

    const readSettings = async () => {
        let resp = await fetch (`${backendUrl}/store/${user?.id}/settings/general`, addGetAuthorization(accessString))
        if (resp.status===200) {
            var json=await resp.json()
            if (json && settingsRef) settingsRef.current = JSON.parse(json) as Settings
        }
        else {
            settingsRef.current = { channels: [], keepAliveInterval: 60 }
        }
    }

    const writeSettings = async () => {
        let payload = JSON.stringify(settingsRef.current)
        fetch (`${backendUrl}/store/${user?.id}/settings/general`, addPostAuthorization(accessString, payload))
    }

    const onChangeCluster = (clusterName:string) => {
        if (!clusters) return
        let cluster = clusters.find(c => c.name === clusterName)
        if (cluster && cluster.kwirthData) {
            setSelectedClusterName(clusterName)
            let usableChannels = [...cluster.kwirthData.channels]
            usableChannels = usableChannels.filter(c => Array.from(frontChannels.keys()).includes(c.id))
            //+++ pending improve ux on resource selector (showing front/back channel availability)
            setBackChannels(usableChannels)
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

        if (frontChannels.has(selection.channel)) {
            let newChannel = createChannelInstance(selection.channel)!
            let newTab:ITabObject = {
                name: tabName+index.toString(),
                ws: undefined,
                keepaliveRef: 60,
                defaultTab: false,
                channel: newChannel,
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
                channelPending: false,
                headerEl: undefined
            }
            if (newTab.channel.initChannel(newTab.channelObject)) setRefreshTabContent(Math.random())
            startSocket(newTab, cluster, () => {
                setKeepAlive(newTab)
                if (newTab.channel.requiresWebSocket()) newTab.channelObject.webSocket = newTab.ws
            })
            selTab.current = newTab
            //setSelectedTab(newTab)
            setTabs((prev) => [...prev, newTab])
        }
        else {
            console.log(`Error, invalid channel: `, selection.channel)
            setMsgBox(MsgBoxOkError('Add resource', 'Channel is not supported', setMsgBox))
        }

    }

    const setKeepAlive = (tab:ITabObject) => {
        console.log(`WS connected: ${tab.ws?.url}`)
        tab.keepaliveRef = setInterval(() => {
            let instanceConfig:InstanceMessage = {
                action: InstanceMessageActionEnum.PING,
                channel: tab.channel.channelId,
                flow: InstanceMessageFlowEnum.REQUEST,
                type: InstanceMessageTypeEnum.SIGNAL,
                instance: ''
            }
            if (tab.ws && tab.ws.readyState === WebSocket.OPEN) tab.ws.send(JSON.stringify(instanceConfig))
        }, (settingsRef.current?.keepAliveInterval || 60) * 1000,'')
    }

    const onChangeTab = (_event:any, tabName?:string)=> {
        let newTab = tabs.find(tab => tab.name === tabName)
        if (newTab) {
            if (newTab.channelObject) {
                newTab.channelPending = false
                if (newTab.channelStarted) {
                    if (newTab.channelPaused) 
                        newTab.headerEl.style.backgroundColor = '#dddddd'
                    else
                        newTab.headerEl.style.backgroundColor = '#99dd99'
                }
                else {
                    newTab.headerEl.style.backgroundColor = '#ffffff'
                }
               setRefreshTabContent(Math.random())
            }
            //setSelectedTab(newTab)
            selTab.current = newTab
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
        if (instanceMessage.action === InstanceMessageActionEnum.PING || instanceMessage.channel === InstanceMessageChannelEnum.NONE) return

        if (frontChannels.has(instanceMessage.channel)) {
            let tab = tabs.find(tab => tab.ws !== null && tab.ws === wsEvent.target)
            if (!tab || !tab.channel || !tab.channelObject) return
            let action = tab.channel.processChannelMessage(tab.channelObject, wsEvent)
            if (action === IChannelMessageAction.REFRESH) {
                if (selTab?.current?.name === tab.name)
                    setRefreshTabContent(Math.random())
                else
                    tab.headerEl.style.backgroundColor = '#ffe082'
            }
            else if (action === IChannelMessageAction.STOP) {
                stopChannel(tab)
            }
        }
        else {
            console.log('Received invalid channel in message: ', instanceMessage)
        }
    }

    const onClickChannelStart = () => {
        if (selTab.current && selTab.current.channel)
            selTab.current.channel.setSetupVisibility(true)
        else
            console.log(`Unsupported channel ${selTab.current?.channel.channelId}`)
    }

    const socketReconnect = (wsEvent:any, id:NodeJS.Timer) => {
        clearInterval(id)
        console.log('Reconnected, will reconfigure socket')
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return

        let instanceConfig:InstanceConfig = {
            channel: tab.channel.channelId,
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
        console.log('Socket disconnected')
        let tab = tabs.find(tab => tab.ws === wsEvent.target)
        if (!tab || !tab.channelObject) return
        const reconnectable = backChannels.find(c => c.id === tab!.channel.channelId && c.reconnectable)
        if (reconnectable) {
            console.log(`Trying to reconnect...`)
            if (tab.ws) {
                tab.ws.onerror = null
                tab.ws.onmessage = null
                tab.ws.onclose = null
                tab.ws = undefined
            }
            let cluster = clusters.find(c => c.name === tab!.channelObject!.clusterName)
            if (!cluster) return

            if (selTab.current && selTab.current.channel) {
                if (selTab.current.channel.socketDisconnected(selTab.current.channelObject)) setRefreshTabContent(Math.random())
            }
            else {
                console.log('Unsuppported channel on disconnect:', tab.channel.channelId)
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
        else {
            console.log(`Channel ${tab.channel.channelId} does not support reconnect.`)
        }
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
                channel: tab.channel.channelId,
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
            
            if (selTab.current && selTab.current.channel) {
                instanceConfig.scope = selTab.current.channel.getScope()
                instanceConfig.data = tab.channelObject.instanceConfig
                tab.ws.send(JSON.stringify(instanceConfig))
                tab.channelStarted = true
                tab.channelPaused = false
                selTab.current.headerEl.style.backgroundColor = '#99dd99'
                selTab.current.channel.startChannel(selTab.current.channelObject)
            }
            else {
                console.log('Channel is not supported')
            }
        }
        else {
            console.log('Tab web socket is not started')
        }
    }

    const onClickChannelStop = () => {
        setAnchorMenuTab(null)
        if (selTab.current && selTab.current.channelObject) stopChannel(selTab.current)
    }

    const stopChannel = (tab:ITabObject) => {
        if (!tab || !tab.channelObject) return
        let cluster = clusters.find(c => c.name === tab.channelObject.clusterName)

        if (!cluster) return
        let instanceConfig: InstanceConfig = {
            channel: tab.channel.channelId,
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
        if (selTab.current && selTab.current.channel) {
            if (selTab.current.channel.stopChannel(selTab.current.channelObject)) setRefreshTabContent(Math.random())
            if (tab.ws) tab.ws.send(JSON.stringify(instanceConfig))
            tab.channelStarted = false
            tab.channelPaused = false
            tab.headerEl.style.backgroundColor = '#ffffff'
        }
        else {
            console.log('Channel is not supported on stop:',tab.channel.channelId)
        }
    }

    const onClickChannelPause = () => {
        setAnchorMenuTab(null)
        if (!selTab.current || !selTab.current.channelObject || !selTab.current.ws) return
        var cluster = clusters.find(c => c.name === selTab.current!.channelObject.clusterName)
        if(!cluster) return
        
        var instanceConfig:InstanceConfig = {
            channel: selTab.current.channel.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.PAUSE,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: selTab.current.channelObject?.instanceId,
            accessKey: cluster.accessString,
            scope: InstanceConfigScopeEnum.NONE,
            view: selTab.current.channelObject.view,
            namespace: selTab.current.channelObject.namespace,
            group: selTab.current.channelObject.group,
            pod: selTab.current.channelObject.pod,
            container: selTab.current.channelObject.container,
            type: InstanceMessageTypeEnum.SIGNAL
        }

        if (selTab.current.channelPaused) {
            selTab.current.channelPaused = false
            selTab.current.headerEl.style.backgroundColor = '#99dd99'
            instanceConfig.action = InstanceMessageActionEnum.CONTINUE
        }
        else {
            selTab.current.channelPaused = true
            selTab.current.headerEl.style.backgroundColor = '#dddddd'
            instanceConfig.action = InstanceMessageActionEnum.PAUSE
        }
        selTab.current.ws.send(JSON.stringify(instanceConfig))
    }

    const onClickTabRemove = () => {
        setAnchorMenuTab(null)
        if (!selTab.current) return

        if (selTab.current.channelObject) stopChannel(selTab.current)

        if (selTab.current.ws) {
            selTab.current.ws.onopen = null
            selTab.current.ws.onerror = null
            selTab.current.ws.onmessage = null
            selTab.current.ws.onclose = null
        }

        selTab.current.ws?.close()
        clearInterval(selTab.current.keepaliveRef)
        let current = tabs.findIndex(t => t === selTab.current)
        let newTabs= tabs.filter(t => t !== selTab.current)

        if (current >= newTabs.length) current--
        if (current>=0 && current<newTabs.length) newTabs[current].channelPending = false
        setTabs(newTabs)
    }

    const menuTabOptionSelected = (option: MenuTabOption) => {
        setAnchorMenuTab(null)
        let selectedTabIndex = tabs.findIndex(t => t.name === selTab?.current?.name)
        switch(option) {
            case MenuTabOption.TabInfo:
                if (selTab.current) {
                    var a=`
                        <b>Tab type</b>: ${selTab.current.channel.channelId}</br>
                        <b>Cluster</b>: ${selTab.current.channelObject.clusterName}</br>
                        <b>View</b>: ${selTab.current.channelObject.view}<br/>
                        <b>Namespace</b>: ${selTab.current.channelObject.namespace}<br/>
                        <b>Group</b>: ${selTab.current.channelObject.group}<br/>
                        <b>Pod</b>: ${selTab.current.channelObject.pod}<br/>
                        <b>Container</b>: ${selTab.current.channelObject.container}
                    `
                    setMsgBox(MsgBoxOk('Tab info',a,setMsgBox))
                }
                break
            case MenuTabOption.TabRename:
                setShowRenameLog(true)
                break
            case MenuTabOption.TabMoveLeft:
                if (selTab.current) {
                    tabs[selectedTabIndex] = tabs[selectedTabIndex-1]
                    tabs[selectedTabIndex-1] = selTab.current
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveRight:
                if (selTab.current) {
                    tabs[selectedTabIndex] = tabs[selectedTabIndex+1]
                    tabs[selectedTabIndex+1] = selTab.current
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveFirst:
                if (selTab.current) {
                    tabs.splice(selectedTabIndex, 1)
                    tabs.splice(0, 0, selTab.current)
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabMoveLast:
                if (selTab.current) {
                    tabs.splice(selectedTabIndex, 1)
                    tabs.push(selTab.current)
                    setTabs(tabs)
                }
                break
            case MenuTabOption.TabRemove:
                onClickTabRemove()
                break
            case MenuTabOption.TabSetDefault:
                if (selTab.current && selTab.current.channelObject) selTab.current.defaultTab=true
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
                channel: tab.channel,
                channelObject: JSON.parse(JSON.stringify(tab.channelObject)),
                channelStarted: false,
                channelPaused: false,
                channelPending: false,
                headerEl: undefined
            }
            if (selTab.current && selTab.current.channel) {
                delete newTab.channelObject.uiData  // we only need uiConfig and instanceConfig
                newTabs.push(newTab)
            }
            else {
                console.log('Channel not supported on saveBoard:',tab.channel.channelId)
            }
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
            if (tab.channelObject) stopChannel(tab)
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

    const onSettingsUserClosed = (ok:boolean) => {
        setShowSettingsUser(false)
        if (ok) writeSettings()
    }

    const onSettingsClusterClosed = (readMetricsInterval:number|undefined) => {
        setShowSettingsCluster(false)
        
        if (!readMetricsInterval) return
        if (readMetricsInterval) {
            var cluster = clusters.find(c => c.name === selectedClusterName)
            if (cluster && cluster.kwirthData)  {
                cluster.kwirthData.metricsInterval = readMetricsInterval
                let payload = JSON.stringify( { metricsInterval: readMetricsInterval } )
                fetch (`${cluster.url}/metrics/config`, addPostAuthorization(cluster.accessString, payload))
            }
        }
    }

    const onChannelSetupClosed = (channel:IChannel, start:boolean, defaultValues:boolean) => {
        channel.setSetupVisibility(false)
        if (!selTab.current) return

        if (defaultValues && settingsRef.current && selTab.current.channelObject) {
            settingsRef.current.channels = settingsRef.current.channels.filter(c => c.id !== channel.channelId)
            settingsRef.current.channels.push({
                id: channel.channelId,
                uiSettings: selTab.current.channelObject.uiConfig,
                instanceSettings: selTab.current.channelObject.instanceConfig
            })
            writeSettings()
        }
        setRefreshTabContent(Math.random())  // we force rendering
        if (start) startChannel(selTab.current)
    }

    const onRenameTabClosed = (newname:string|undefined) => {
        setShowRenameLog(false)
        if (!selTab.current || !newname) return
        selTab.current.name = newname
    }
 
    const onCloseManageClusters = (cc:Cluster[]) => {
        setShowManageClusters(false)
        let otherClusters = cc.filter (c => !c.source)
        var payload=JSON.stringify(otherClusters)
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addPostAuthorization(accessString, payload))
        setClusters([...cc])
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

    const showChannelSetup = () => {
        if (!selTab.current || !selTab.current.channel || !selTab.current.channel.getSetupVisibility()) return 
        const SetupDialog = selTab.current.channel.SetupDialog
        let props:ISetupProps = {
            channel: selTab.current.channel,
            onChannelSetupClosed,
            channelObject: selTab.current.channelObject,
            uiSettings:settingsRef.current?.channels.find(c => c.id === selTab.current?.channel.channelId)?.uiSettings,
            instanceSettings:settingsRef.current?.channels.find(c => c.id === selTab.current?.channel.channelId)?.instanceSettings,
        }
        if (props.channelObject) {
            let cluster = clusters.find(c => c.name===selTab.current?.channelObject.clusterName)
            if (cluster && selTab.current.channel.requiresMetrics()) {
                props.channelObject.metricsList = cluster.metricsList
            }
            if (cluster &&  selTab.current.channel.requiresAccessString()) {
                props.channelObject.accessString = cluster?.accessString
            }
        }
        return <SetupDialog {...props} />
    }

    const formatTabName = (tab : ITabObject) => {
        if (!tab.name) return <>undefined</>

        let icon = <Box sx={{minWidth:'24px'}}/>
        if (tab.channel) icon = tab.channel.getChannelIcon()
        let name = tab.name
        if (name.length>20) name = tab.name.slice(0, 8) + '...' + tab.name.slice(-8)
        return <>{icon}&nbsp;{name}</>
    }

    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessString: accessString, logged, backendUrl }}>
                <Login onClose={onLoginClose}></Login>
            </SessionContext.Provider>
        </div>
    </>)

    return (
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

            <ResourceSelector clusters={clusters} backChannels={backChannels} onAdd={onResourceSelectorAdd} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }} data-refresh={refreshTabContent}/>
            <Stack direction={'row'} alignItems={'end'} sx={{mb:1}}>          
                <Tabs value={selTab.current?.name} onChange={onChangeTab} variant='scrollable' scrollButtons='auto' sx={{ml:1}}>
                    { tabs.length>0 && tabs.map((tab) => {
                        return <Tab ref={(el) => tab.headerEl = el} key={tab.name} label={formatTabName(tab)} value={tab.name} icon={<IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>} iconPosition='end' sx={{ mb:-1, mt:-1}}/>
                    })}
                </Tabs>
                <Typography sx={{ flexGrow: 1 }}></Typography>
            </Stack>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '80vh' }}>
                { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs} selectedTab={selTab.current} selectedTabIndex={tabs.findIndex(t => t.name === selTab?.current?.name)} backChannels={backChannels}/>}
                <TabContent channel={selTab.current?.channel} webSocket={selTab.current?.ws} channelObject={selTab.current?.channelObject} refreshTabContent={refreshTabContent} />
            </Box>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs} oldname={selTab.current?.name}/> }
            { showSaveBoard && <SaveBoard onClose={onSaveBoardClosed} name={currentBoardName} description={currentBoardDescription} values={boards} /> }
            { showSelectBoard && <SelectBoard onSelect={onSelectBoardClosed} values={boards} action={selectBoardAction}/> }
            { showManageClusters && <ManageClusters onClose={onCloseManageClusters} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }
            { showChannelSetup() }
            { showSettingsUser && <SettingsUser onClose={onSettingsUserClosed} settings={settingsRef.current} /> }
            { showSettingsCluster && clusters && <SettingsCluster onClose={onSettingsClusterClosed} clusterName={selectedClusterName} clusterMetricsInterval={clusters.find(c => c.name===selectedClusterName)?.kwirthData?.metricsInterval} /> }
            { initialMessage !== '' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            { firstLogin && <FirstTimeLogin onClose={onFirstTimeLoginClose}/> }

            { msgBox }
        </SessionContext.Provider>
    )
}

export default App