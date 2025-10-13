import { useState, useRef, useEffect } from 'react'

// material & icons
import { Alert, AppBar, Box, Drawer, IconButton, Snackbar, SnackbarCloseReason, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person, Home } from '@mui/icons-material'

// model
import { Cluster, IClusterInfo } from './model/Cluster'

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
import { SettingsTrivy } from './components/settings/SettingsTrivy'
import { MenuTab, MenuTabOption } from './menus/MenuTab'
import { MenuDrawer, MenuDrawerOption } from './menus/MenuDrawer'
import { MsgBoxButtons, MsgBoxOk, MsgBoxOkError, MsgBoxYesNo } from './tools/MsgBox'
import { Settings } from './model/Settings'
import { FirstTimeLogin } from './components/FirstTimeLogin'
import { IBoard } from './model/IBoard'

import { VERSION } from './version'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { IInstanceMessage, versionGreaterThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, InstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageActionEnum, parseResources, KwirthData, BackChannelData, IUser } from '@jfvilas/kwirth-common'
import { ITabObject, ITabSummary } from './model/ITabObject'

import { ChannelConstructor, IChannel, IChannelMessageAction, ISetupProps } from './channels/IChannel'
import { LogChannel } from './channels/log/LogChannel'
import { EchoChannel } from './channels/echo/EchoChannel'
import { AlertChannel } from './channels/alert/AlertChannel'
import { MetricsChannel } from './channels/metrics/MetricsChannel'
import { TrivyChannel } from './channels/trivy/TrivyChannel'
import { OpsChannel } from './channels/ops/OpsChannel'
import { getMetricsNames, readClusterInfo } from './tools/Global'
import { FilemanChannel } from './channels/fileman/FilemanChannel'
import { Homepage } from './components/Homepage'
import { BASECOLORS, BRIGHTCOLORS, DEFAULTLASTTABS, IColors } from './tools/Constants'
import cluster from 'cluster'

const App: React.FC = () => {
    let backendUrl='http://localhost:3883'
    const rootPath = window.__PUBLIC_PATH__ || ''
    if ( process.env.NODE_ENV==='production') backendUrl=window.location.protocol+'//'+window.location.host
    backendUrl=backendUrl+rootPath

    const [frontChannels] = useState<Map<string, ChannelConstructor>>(new Map())
    const [user, setUser] = useState<IUser>()
    const [logged,setLogged]=useState(false)
    const [firstLogin,setFirstLogin]=useState(false)
    const [accessString,setAccessString]=useState('')
    const [msgBox, setMsgBox] =useState(<></>)

    const [clusters, setClusters] = useState<Cluster[]>([])
    const clustersRef = useRef(clusters)
    clustersRef.current = clusters
    const [selectedClusterName, setSelectedClusterName] = useState<string>()

    const tabs = useRef<ITabObject[]>([])
    const selectedTab = useRef<ITabObject>()
    const [refreshTabContent, setRefreshTabContent] = useState(0)

    const settingsRef = useRef<Settings|null>(null)

    const [backChannels, setBackChannels] = useState<BackChannelData[]>([])
    const backChannelsRef = useRef(backChannels)
    backChannelsRef.current= backChannels

    // menus/navigation
    const [anchorMenuTab, setAnchorMenuTab] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // boards
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
    const [showSettingsTrivy, setShowSettingsTrivy]=useState<boolean>(false)
    const [initialMessage, setInitialMessage]=useState<string>('')

    // last & favs
    const [lastTabs, setLastTabs] = useState<ITabSummary[]>([])
    const [favTabs, setFavTabs] = useState<ITabSummary[]>([])
    const [notifyOpen, setNotifyOpen] = useState(false)
    const [notifyMessage, setNotifyMessage] = useState('')
    const [notifyLevel, setNotifyLevel] = useState<'info'|'error'|'warning'|'success'>('info')
    const [resourceSelected, setResourceSelected] = useState<IResourceSelected|undefined>(undefined)

    const createChannelInstance = (type: string): IChannel | null => {
        const channelClass = frontChannels.get(type)
        let channel = channelClass ? new channelClass() : null
        if (channel) channel.setNotifier(notify)
        return channel
    }

    useEffect( () => {
        // only first time
        frontChannels.set('log', LogChannel)
        frontChannels.set('echo', EchoChannel)
        frontChannels.set('alert', AlertChannel)
        frontChannels.set('metrics', MetricsChannel)
        frontChannels.set('trivy', TrivyChannel)
        frontChannels.set('ops', OpsChannel)
        frontChannels.set('fileman', FilemanChannel)
    },[])

    const onNotifyClose = (event?: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') return
        setNotifyOpen(false)
    }

    const notify = (msg:string, level:string) => {
        setNotifyOpen(true)
        setNotifyMessage(msg)
        setNotifyLevel(level as 'info'|'error'|'warning'|'success')
    }

    useEffect ( () => {
        // only when user logs on / off
        if (logged) {
            if (clustersRef.current.length === 0) getClusters()
            if (!settingsRef.current || settingsRef.current === null) readSettings() 
            let last = localStorage.getItem('lastTabs')
            if (last) {
                setLastTabs(JSON.parse(last))
            }
            else {
                setLastTabs(DEFAULTLASTTABS)
            }
            let fav = localStorage.getItem('favTabs')
            if (fav) setFavTabs(JSON.parse(fav))
        }
    },[logged])

    useEffect( () => {
        let c = clusters.find(c => c.source)
        if (c) onChangeCluster(c.name)
    }, [clusters])

    const fillTabSummary = async (tab:ITabSummary) => {
        let namespacesArray:string[] = []
        if (tab.channelObject.namespace.startsWith('$') || tab.channelObject.group.startsWith('$')|| tab.channelObject.pod.startsWith('$') || tab.channelObject.container.startsWith('$')) {
            namespacesArray = (await (await fetch(`${backendUrl}/config/namespace`, addGetAuthorization(accessString))).json())
            tab.channelObject.namespace = namespacesArray.join(',')
        }
        let groupsArr = []
        if (tab.channelObject.group.startsWith('$')) {
            for (let namespace of namespacesArray) {
                let data = await ((await fetch(`${backendUrl}/config/${namespace}/groups`, addGetAuthorization(accessString))).json())
                data = data.map ( (g:any) => ({ ...g, namespace }))
                groupsArr.push(...data)
            }
            if (tab.channelObject.group==='$some') groupsArr = groupsArr.slice(0,3)
            tab.channelObject.group = groupsArr.map(g => g.type+'+'+g.name).join(',')
        }

        let podsArray:any[] = []
        if (tab.channelObject.pod.startsWith('$') || tab.channelObject.container.startsWith('$')) {
            for (let group of groupsArr.filter(g => g.type!=='deployment')) {
                let data = await (await fetch(`${backendUrl}/config/${group.namespace}/${group.name}/pods?type=${group.type}`, addGetAuthorization(accessString))).json()
                data = data.map ((name:string) => ({ name, namespace:group.namespace}))
                podsArray.push (...data)
            }
            if (tab.channelObject.pod==='$some') podsArray = podsArray.slice(0,3)
            tab.channelObject.pod = podsArray.map(pod => pod.name).join(',')
        }
    
        let containersArray:string[] = []
        if (tab.channelObject.container.startsWith('$')) {
            for (let pod of podsArray) {
                let data = await ((await fetch(`${backendUrl}/config/${pod.namespace}/${pod.name}/containers`, addGetAuthorization(accessString))).json())
                data = data.map( (c:string) => pod.name+'+'+c)
                containersArray.push (...(data as string[]))
            }
            if (tab.channelObject.container==='$some') containersArray = containersArray.slice(0,3)
            tab.channelObject.container = containersArray.join(',')
        }
    }

    const getClusters = async () => {
        // get current cluster
        let response = await fetch(`${backendUrl}/config/info`, addGetAuthorization(accessString))
        let srcCluster = new Cluster()
        srcCluster.kwirthData = await response.json() as KwirthData
        if (!srcCluster.kwirthData) {
            console.log('No kwirthtdata received from source cluster')
            return
        }
        let responseCluster = await fetch(`${backendUrl}/config/cluster`, addGetAuthorization(accessString))
        srcCluster.clusterInfo = await responseCluster.json() as IClusterInfo

        srcCluster.name = srcCluster.kwirthData.clusterName
        srcCluster.url = backendUrl
        srcCluster.accessString = accessString
        srcCluster.source = true
        srcCluster.enabled = true
        let srcMetricsRequired = Array.from(srcCluster.kwirthData.channels).reduce( (prev, current) => { return prev || current.metrics}, false)
        if (srcMetricsRequired) getMetricsNames(srcCluster)
        if (versionGreaterThan(srcCluster.kwirthData.version, srcCluster.kwirthData.lastVersion)) {
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
        setRefreshTabContent(Math.random())
    }

    const readSettings = async () => {
        let resp = await fetch (`${backendUrl}/store/${user?.id}/settings/general`, addGetAuthorization(accessString))
        if (resp.status===200) {
            let json=await resp.json()
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

    const setUsablechannels = (cluster:Cluster) => {
        if (cluster && cluster.kwirthData) {
            let usableChannels = [...cluster.kwirthData.channels]
            usableChannels = usableChannels.filter(c => Array.from(frontChannels.keys()).includes(c.id))
            //+++ pending improve ux on resource selector (showing front/back channel availability according to user selections)
            setBackChannels(usableChannels)
        }
    }

    const onChangeCluster = (clusterName:string) => {
        if (!clusters) return
        let cluster = clusters.find(c => c.name === clusterName)
        if (cluster && cluster.kwirthData) {
            setUsablechannels(cluster)
            setSelectedClusterName(clusterName)
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

        if (frontChannels.has(selection.channelId)) {
            populateTabObject(selection.name, selection.channelId, cluster, selection.view, selection.namespaces.join(','), selection.groups.join(','), selection.pods.join(','), selection.containers.join(','))
        }
        else {
            console.log(`Error, invalid channel: `, selection.channelId)
            setMsgBox(MsgBoxOkError('Add resource', 'Channel is not supported', setMsgBox))
        }
    }

    const populateTabObject = (name:string, channelId:string, cluster:Cluster, view:string, namespaces:string, groups:string, pods:string, containers:string, tab?:ITabObject) => {
        let newChannel = createChannelInstance(channelId)!
        let newTab:ITabObject = {
            name: name,
            ws: undefined,
            keepaliveRef: 60,
            defaultTab: false,
            channel: newChannel,
            channelObject: {
                clusterName: cluster.name,
                instanceId: '',
                view: view as InstanceConfigViewEnum,
                namespace: namespaces,
                group: groups,
                pod: pods,
                container: containers,
                instanceConfig: undefined,
                uiConfig: undefined,
                uiData: undefined
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false,
            headerEl: undefined
        }
        if (newTab.channel.requiresMetrics()) newTab.channelObject.metricsList = cluster.metricsList
        if (newTab.channel.requiresClusterUrl()) newTab.channelObject.clusterUrl = cluster.url
        if (newTab.channel.requiresAccessString()) newTab.channelObject.accessString = cluster?.accessString
        if (newTab.channel.initChannel(newTab.channelObject)) setRefreshTabContent(Math.random())
        if (tab) {
            newTab.channelObject.instanceConfig = tab.channelObject.instanceConfig
            newTab.channelObject.uiConfig = tab.channelObject.uiConfig
        }
        startSocket(newTab, cluster, () => {
            setKeepAlive(newTab)
            if (newTab.channel.requiresWebSocket()) newTab.channelObject.webSocket = newTab.ws
            if (tab && tab.channelStarted) startTabChannel(newTab)
        })
        selectedTab.current = newTab
        tabs.current.push(newTab)
        setRefreshTabContent(Math.random())  // force re-render for showing new tab
    }

    const setKeepAlive = (tab:ITabObject) => {
        console.log(`WS connected: ${tab.ws?.url}`)
        tab.keepaliveRef = setInterval(() => {
            if (tab.channelObject.instanceId) {
                // we only send keealive (ping) if we have a valid instance id
                let instanceConfig:IInstanceMessage = {
                    action: InstanceMessageActionEnum.PING,
                    channel: tab.channel.channelId,
                    flow: InstanceMessageFlowEnum.REQUEST,
                    type: InstanceMessageTypeEnum.SIGNAL,
                    instance: tab.channelObject.instanceId
                }
                if (tab.ws && tab.ws.readyState === WebSocket.OPEN) tab.ws.send(JSON.stringify(instanceConfig))
            }
        }, (settingsRef.current?.keepAliveInterval || 60) * 1000, '')
    }

    const colorizeTab = (tab:ITabObject) => {
        let colorTable:IColors = BRIGHTCOLORS
        if (selectedTab.current === tab) colorTable = BASECOLORS
        if (tab.channelStarted) {
            if (tab.channelPaused) {
                tab.headerEl.style.backgroundColor = colorTable.pause
            }
            else {
                if (tab.channelPending)
                    tab.headerEl.style.backgroundColor = colorTable.pending
                else
                    tab.headerEl.style.backgroundColor = colorTable.start
            }
        }
        else {
            tab.headerEl.style.backgroundColor = colorTable.stop
        }
    }

    const onChangeTab = (_event:unknown, tabNumber:number)=> {
        if (tabNumber>=0) {
            let newTab = tabs.current[tabNumber]
            if (newTab.channelObject) {
                newTab.channelPending = false
                setRefreshTabContent(Math.random())
                if (selectedTab.current) colorizeTab(selectedTab.current)
                colorizeTab(newTab)
                let cluster = clusters.find(c => c.name === newTab.channelObject.clusterName)
                if (cluster) setUsablechannels(cluster)
            }
            selectedTab.current = newTab
        }
        else {
            selectedTab.current = undefined
            setRefreshTabContent(Math.random())
        }
    }

    const wsOnMessage = (wsEvent:MessageEvent) => {
        let instanceMessage:IInstanceMessage
        try {
            instanceMessage = JSON.parse(wsEvent.data) as IInstanceMessage
        }
        catch (err:any) {
            console.log(err.stack)
            console.log(wsEvent.data)
            return
        }
        if (instanceMessage.action === InstanceMessageActionEnum.PING || instanceMessage.channel === InstanceMessageChannelEnum.NONE) return

        if (frontChannels.has(instanceMessage.channel)) {
            let tab = tabs.current.find(tab => tab.ws !== null && tab.ws === wsEvent.target)
            if (!tab || !tab.channel || !tab.channelObject) return
            let action = tab.channel.processChannelMessage(tab.channelObject, wsEvent)
            if (action === IChannelMessageAction.REFRESH) {
                if (selectedTab?.current?.name === tab.name) {
                    setRefreshTabContent(Math.random())
                }
                else {
                    if (!tab.channelPending) {
                        tab.channelPending = true
                        colorizeTab(tab)
                    }
                }
            }
            else if (action === IChannelMessageAction.STOP) {
                stopTabChannel(tab)
            }
        }
        else {
            console.log('Received invalid channel in message: ', instanceMessage)
        }
    }

    const onClickChannelStart = () => {
        if (selectedTab.current && selectedTab.current.channel) {
            if (selectedTab.current.channel.requiresSetup()) {
                selectedTab.current.channel.setSetupVisibility(true)
            }
            else {
                startTabChannel(selectedTab.current)
            }
        }
        else {
            console.log(`Unsupported channel ${selectedTab.current?.channel.channelId}`)
        }
    }

    const socketReconnect = (wsEvent:any, id:NodeJS.Timer) => {
        clearInterval(id)
        console.log('Reconnected, will reconfigure socket')
        let tab = tabs.current.find(tab => tab.ws === wsEvent.target)
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
        let tab = tabs.current.find(tab => tab.ws === wsEvent.target)
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

            if (selectedTab.current && selectedTab.current.channel) {
                if (selectedTab.current.channel.socketDisconnected(selectedTab.current.channelObject)) setRefreshTabContent(Math.random())
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
    
    const startTabChannel = (tab:ITabObject) => {
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

            let instanceConfig: InstanceConfig = {
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

            if (tab.channel) {
                instanceConfig.scope = tab.channel.getScope()
                instanceConfig.data = tab.channelObject.instanceConfig
                tab.ws.send(JSON.stringify(instanceConfig))
                tab.channelStarted = true
                tab.channelPaused = false
                colorizeTab(tab)
                
                tab.channel.startChannel(tab.channelObject)

                if (!lastTabs.some(t => t.name === tab.name)) {
                    let newTab = {
                        name: tab.name,
                        description: tab.name,
                        channel: tab.channel.channelId,
                        channelObject: {
                            clusterName: tab.channelObject.clusterName,
                            view: tab.channelObject.view,
                            namespace: tab.channelObject.namespace,
                            group: tab.channelObject.group,
                            pod: tab.channelObject.pod,
                            container: tab.channelObject.container
                        }
                    }
                    setLastTabs([...lastTabs, newTab])
                    localStorage.setItem('lastTabs', JSON.stringify([...lastTabs, newTab]))
                }
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
        if (selectedTab.current && selectedTab.current.channelObject) stopTabChannel(selectedTab.current)
    }

    const stopTabChannel = (tab:ITabObject) => {
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
        if (selectedTab.current && selectedTab.current.channel) {
            if (selectedTab.current.channel.stopChannel(selectedTab.current.channelObject)) setRefreshTabContent(Math.random())
            if (tab.ws) tab.ws.send(JSON.stringify(instanceConfig))
            tab.channelStarted = false
            tab.channelPaused = false
            colorizeTab(tab)
        }
        else {
            console.log('Channel is not supported on stop:',tab.channel.channelId)
        }
    }

    const onClickChannelPause = () => {
        setAnchorMenuTab(null)
        if (!selectedTab.current || !selectedTab.current.channelObject || !selectedTab.current.ws) return
        let cluster = clusters.find(c => c.name === selectedTab.current!.channelObject.clusterName)
        if(!cluster) return
        
        let instanceConfig:InstanceConfig = {
            channel: selectedTab.current.channel.channelId,
            objects: InstanceConfigObjectEnum.PODS,
            action: InstanceMessageActionEnum.PAUSE,
            flow: InstanceMessageFlowEnum.REQUEST,
            instance: selectedTab.current.channelObject?.instanceId,
            accessKey: cluster.accessString,
            scope: InstanceConfigScopeEnum.NONE,
            view: selectedTab.current.channelObject.view,
            namespace: selectedTab.current.channelObject.namespace,
            group: selectedTab.current.channelObject.group,
            pod: selectedTab.current.channelObject.pod,
            container: selectedTab.current.channelObject.container,
            type: InstanceMessageTypeEnum.SIGNAL
        }

        if (selectedTab.current.channelPaused) {
            selectedTab.current.channelPaused = false
            colorizeTab(selectedTab.current)
            instanceConfig.action = InstanceMessageActionEnum.CONTINUE
        }
        else {
            selectedTab.current.channelPaused = true
            colorizeTab(selectedTab.current)
            instanceConfig.action = InstanceMessageActionEnum.PAUSE
        }
        selectedTab.current.ws.send(JSON.stringify(instanceConfig))
    }

    const onClickTabRemove = () => {
        setAnchorMenuTab(null)
        if (!selectedTab.current) return

        if (selectedTab.current.ws) {
            selectedTab.current.ws.onopen = null
            selectedTab.current.ws.onerror = null
            selectedTab.current.ws.onmessage = null
            selectedTab.current.ws.onclose = null
        }
        clearInterval(selectedTab.current.keepaliveRef)
        if (selectedTab.current.channelObject) stopTabChannel(selectedTab.current)

        let current = tabs.current.findIndex(t => t === selectedTab.current)
        let newTabs = tabs.current.filter(t => t !== selectedTab.current)

        if (current >= newTabs.length) current--
        if (current >= 0 && current<newTabs.length) newTabs[current].channelPending = false
        if (current>=0) {
            selectedTab.current = newTabs[current]
            colorizeTab(selectedTab.current)
        }
        tabs.current = newTabs
        selectedTab.current = undefined
    }

    const menuTabOptionSelected = (option: MenuTabOption) => {
        setAnchorMenuTab(null)
        if (!selectedTab?.current) return
        let selectedTabIndex = tabs.current.indexOf(selectedTab.current)
        switch(option) {
            case MenuTabOption.TabInfo:
                if (selectedTab.current) {
                    let a=`
                        <b>Tab type</b>: ${selectedTab.current.channel.channelId}</br>
                        <b>Cluster</b>: ${selectedTab.current.channelObject.clusterName}</br>
                        <b>View</b>: ${selectedTab.current.channelObject.view}<br/>
                        <b>Namespace</b>: ${selectedTab.current.channelObject.namespace}<br/>
                        <b>Group</b>: ${selectedTab.current.channelObject.group}<br/>
                        <b>Pod</b>: ${selectedTab.current.channelObject.pod}<br/>
                        <b>Container</b>: ${selectedTab.current.channelObject.container}
                    `
                    setMsgBox(MsgBoxOk('Tab info',a,setMsgBox))
                }
                break
            case MenuTabOption.TabRename:
                setShowRenameLog(true)
                break
            case MenuTabOption.TabMoveLeft:
                if (selectedTab.current) {
                    tabs.current[selectedTabIndex] = tabs.current[selectedTabIndex-1]
                    tabs.current[selectedTabIndex-1] = selectedTab.current
                    selectedTab.current = tabs.current[selectedTabIndex]
                    colorizeTab(tabs.current[selectedTabIndex])
                    colorizeTab(tabs.current[selectedTabIndex-1])
                }
                break
            case MenuTabOption.TabMoveRight:
                if (selectedTab.current) {
                    tabs.current[selectedTabIndex] = tabs.current[selectedTabIndex+1]
                    tabs.current[selectedTabIndex+1] = selectedTab.current
                    onChangeTab(null, selectedTabIndex+1)
                }
                break
            case MenuTabOption.TabMoveFirst:
                if (selectedTab.current) {
                    tabs.current.splice(selectedTabIndex, 1)
                    tabs.current.splice(0, 0, selectedTab.current)
                }
                break
            case MenuTabOption.TabMoveLast:
                if (selectedTab.current) {
                    tabs.current.splice(selectedTabIndex, 1)
                    tabs.current.push(selectedTab.current)
                }
                break
            case MenuTabOption.TabRemove:
                onClickTabRemove()
                break
            case MenuTabOption.TabSetDefault:
                if (selectedTab.current && selectedTab.current.channelObject) selectedTab.current.defaultTab=true
                break
            case MenuTabOption.TabRestoreParameters:
                if (selectedTab.current) {
                    setResourceSelected( {
                        view:selectedTab.current.channelObject.view,
                        name: selectedTab.current.name,
                        groups: selectedTab.current.channelObject.group.split(','),
                        clusterName: selectedTab.current.channelObject.clusterName,
                        containers: selectedTab.current.channelObject.container.split(','),
                        pods:selectedTab.current.channelObject.pod.split(','),
                        namespaces:selectedTab.current.channelObject.namespace.split(','),
                        channelId: selectedTab.current.channel.channelId
                    })
                }
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
        let newTabs:ITabObject[] = []
        for (let tab of tabs.current) {
            let newTab:ITabObject = {
                name: tab.name,
                defaultTab: tab.defaultTab,
                ws: undefined,
                keepaliveRef: 0,
                channel: tab.channel,
                channelObject: JSON.parse(JSON.stringify(tab.channelObject)),
                channelStarted: tab.channelStarted,
                channelPaused: false,
                channelPending: false,
                headerEl: undefined
            }
            if (selectedTab.current && selectedTab.current.channel) {
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
        let payload=JSON.stringify( board )
        console.log('payload', payload)
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
                let errors = ''
                clearTabs()
                let boardDef = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addGetAuthorization(accessString))).json()
                let board:IBoard = JSON.parse(boardDef)
                if (board && board.tabs && board.tabs.length>0) {
                    for (let t of board.tabs) {
                        let clusterName = t.channelObject.clusterName
                        if (!clusters.find(c => c.name === clusterName)) {
                            errors += `Cluster '${clusterName}' used in tab ${t.name} does not exsist<br/><br/>`
                        }
                    }
                    if (errors!=='') setMsgBox(MsgBoxOkError('Kwirth',`Some errors have been detected when loading board:<br/><br/>${errors}`, setMsgBox))
                    setCurrentBoardName(name)
                    setCurrentBoardDescription(board.description)
                    for (let t of board.tabs) {
                        let res:IResourceSelected = {
                            channelId: t.channel.channelId,
                            clusterName: t.channelObject.clusterName,
                            view: t.channelObject.view,
                            namespaces: t.channelObject.namespace.split(','),
                            groups: t.channelObject.group.split(','),
                            pods: t.channelObject.pod.split(','),
                            containers: t.channelObject.container.split(','),
                            name: t.name
                        }
                        onResourceSelectorAdd(res)
                    }
                }
            }
        }
    }

    const showNoBoards = () => {
        setMsgBox(MsgBoxOk('Board management','You have no boards stored in your personal Kwirth space', setMsgBox))
    }

    const getBoards = async () => {
        let allBoards:IBoard[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards?full=true`, addGetAuthorization(accessString))).json()
        if (allBoards.length===0) {
            showNoBoards()
            return undefined
        }
        else {
            let values = allBoards.map( b => {
                let name=Object.keys(b)[0]
                let board = JSON.parse((b as any)[name]) as IBoard
                return { name: board.name,  description: board.description }
            })
            return values
        }
    }

    const clearTabs = () => {
        for (let tab of tabs.current) {
            if (tab.channelObject) stopTabChannel(tab)
        }
        tabs.current = []
    }

    const menuDrawerOptionSelected = async (option:MenuDrawerOption) => {
        setMenuDrawerOpen(false)
        switch(option) {
            case MenuDrawerOption.NewBoard:
                clearTabs()
                setCurrentBoardName('untitled')
                setCurrentBoardDescription('No description yet')
                selectedTab.current = undefined
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
                let boardsToExport:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
                if (boardsToExport.length===0) {
                    showNoBoards()
                }
                else {
                    let content:any={}
                    for (let boardName of boardsToExport) {
                        let readBoard = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${boardName}`, addGetAuthorization(accessString))).json()
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
            case MenuDrawerOption.SettingsTrivy:
                setShowSettingsTrivy(true)
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
            reader.onload = (event:any) => {
                let allBoards=JSON.parse(event.target.result)
                for (let boardName of Object.keys(allBoards)) {
                    let payload=JSON.stringify(allBoards[boardName])
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
            let cluster = clusters.find(c => c.name === selectedClusterName)
            if (cluster && cluster.kwirthData)  {
                cluster.kwirthData.metricsInterval = readMetricsInterval
                let payload = JSON.stringify( { metricsInterval: readMetricsInterval } )
                fetch (`${cluster.url}/metrics/config`, addPostAuthorization(cluster.accessString, payload))
            }
        }
    }

    const onSettingsTrivyClosed = async (action:string) => {
        setShowSettingsTrivy(false)
        if (action!=='') {
            let result = await (await fetch (`${backendUrl}/config/trivy?action=${action}`, addGetAuthorization(accessString)))
            if (result.status === 200) {
                setMsgBox(MsgBoxOk('Trivy',`Action ${action} succesfully launched.`, setMsgBox))
            }
            else {
                setMsgBox(MsgBoxOkError('Trivy',`Trivy action has shown some errors: ${result.text()}.`, setMsgBox))
            }
        }
    }

    const onChannelSetupClosed = (channel:IChannel, start:boolean, setDefaultValues:boolean) => {
        channel.setSetupVisibility(false)
        if (!selectedTab.current) return

        if (setDefaultValues && settingsRef.current && selectedTab.current.channelObject) {
            settingsRef.current.channels = settingsRef.current.channels.filter(c => c.id !== channel.channelId)
            settingsRef.current.channels.push({
                id: channel.channelId,
                uiSettings: selectedTab.current.channelObject.uiConfig,
                instanceSettings: selectedTab.current.channelObject.instanceConfig
            })
            writeSettings()
        }
        setRefreshTabContent(Math.random())  // we force rendering
        if (start) startTabChannel(selectedTab.current)
    }

    const onRenameTabClosed = (newname:string|undefined) => {
        setShowRenameLog(false)
        if (!selectedTab.current || !newname) return
        selectedTab.current.name = newname
    }
 
    const onManageClustersClosed = (cc:Cluster[]) => {
        setShowManageClusters(false)
        let otherClusters = cc.filter (c => !c.source)
        let payload=JSON.stringify(otherClusters)
        fetch (`${backendUrl}/store/${user?.id}/clusters/list`, addPostAuthorization(accessString, payload))
        setClusters([...cc])
    }

    const onLoginClosed = (user:IUser|undefined, firstTime:boolean) => {
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
        if (!selectedTab.current || !selectedTab.current.channel || !selectedTab.current.channel.getSetupVisibility()) return
        const SetupDialog = selectedTab.current.channel.SetupDialog
        let props:ISetupProps = {
            channel: selectedTab.current.channel,
            onChannelSetupClosed,
            channelObject: selectedTab.current.channelObject,
            uiSettings: {},
            instanceSettings: {}
        }
        if (settingsRef.current?.channels && selectedTab.current.channel) {
            props.uiSettings = settingsRef.current.channels.find(c => c.id === selectedTab.current?.channel.channelId)?.uiSettings
            props.instanceSettings = settingsRef.current.channels.find(c => c.id === selectedTab.current?.channel.channelId)?.instanceSettings
        }
    
        return <SetupDialog {...props} />
    }

    const formatTabName = (tab : ITabObject) => {
        if (!tab.name) return <>noname</>
        let icon = <Box sx={{minWidth:'24px'}}/>
        if (tab.channel) icon = tab.channel.getChannelIcon()
        let name = tab.name
        if (name.length>20) name = tab.name.slice(0, 8) + '...' + tab.name.slice(-8)
        return <>{icon}&nbsp;{name}</>
    }

    const hasClusterScope = () => {
        if (!user) return false
        let resources = parseResources(user.accessKey.resources)
        return resources.some(r => r.scopes.split(',').includes('cluster'))
    }

    const onHomepageTab = async (tab: ITabSummary): Promise<void> => {
        let cluster = clusters.find(c => c.name === tab.channelObject.clusterName)
        if (cluster) {
            let clonedTab:ITabSummary = await JSON.parse(JSON.stringify(tab))
            await fillTabSummary(clonedTab)
            populateTabObject(clonedTab.name, clonedTab.channel, cluster, clonedTab.channelObject.view, clonedTab.channelObject.namespace, clonedTab.channelObject.group, clonedTab.channelObject.pod, clonedTab.channelObject.container)
        }
    }

    const onHomepageBoard = (board: IBoard): void => {
    }
    
    const onHomepageUpdateTabs = (last: ITabSummary[], fav: ITabSummary[]): void => {
        localStorage.setItem('lastTabs', JSON.stringify(last))
        localStorage.setItem('favTabs', JSON.stringify(fav))
        setLastTabs(last)
        setFavTabs(fav)
    }
    
    if (!logged) return (<>
        <div style={{ backgroundImage:`url('./turbo-pascal.png')`, backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat', width: '100vw', height: '100vh' }} >
            <SessionContext.Provider value={{ user, accessString: accessString, logged, backendUrl }}>
                <Login onClose={onLoginClosed}></Login>
            </SessionContext.Provider>
        </div>
    </>)

    const onSelectHome = () => {
        selectedTab.current = undefined
        setRefreshTabContent(Math.random())
    }

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
                    <MenuDrawer optionSelected={menuDrawerOptionSelected} uploadSelected={handleUpload} selectedClusterName={selectedClusterName} hasClusterScope={hasClusterScope()}/>
                    <Typography fontSize={'small'} color={'#cccccc'} sx={{ml:1}}>Version: {VERSION}</Typography>
                </Stack>
            </Drawer>

            <ResourceSelector clusters={clusters} backChannels={backChannels} onAdd={onResourceSelectorAdd} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }} tabs={tabs.current} data-refresh={refreshTabContent} resourceSelected={resourceSelected}/>
            
            <Stack direction={'column'}>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1, borderBottom: 1, borderColor: 'divider'}}>                    
                    <Tabs value={selectedTab.current? false : 0} sx={{minWidth:'100px'}}>
                        <Tab key={'0'} label={<Home/>} value={0} onClick={onSelectHome} sx={{height:'60px'}}/>
                    </Tabs>
                    { tabs.current.length>0 &&
                        <Tabs value={selectedTab.current? tabs.current.indexOf(selectedTab.current) : false} onChange={onChangeTab} variant='scrollable' scrollButtons='auto'>
                            {  tabs.current.map((tab:ITabObject, index) => {
                                    return <Tab ref={(el) => tab.headerEl = el} key={index} label={formatTabName(tab)} value={index} icon={tab === selectedTab.current ? <IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton> : <Box sx={{minWidth:'36px'}}/>} iconPosition='end' sx={{ mb:-1, mt:-1}}/>
                            })}
                        </Tabs>
                    }
                    <Typography sx={{ flexGrow: 1 }}></Typography>
                </Stack>
                { !selectedTab.current && 
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Homepage lastTabs={lastTabs} favTabs={favTabs} lastBoards={undefined} favBoards={undefined} onSelectTab={onHomepageTab} onSelectBoard={onHomepageBoard} frontChannels={frontChannels} onUpdateTabs={onHomepageUpdateTabs} cluster={clusters.find(c => c.name===selectedClusterName)} clusters={clusters}/>
                    </Box>
                }
                { selectedTab.current &&
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs.current} selectedTab={selectedTab.current} selectedTabIndex={selectedTab.current? tabs.current.indexOf(selectedTab.current) : -1} backChannels={backChannels}/>}
                        <TabContent channel={selectedTab.current?.channel} webSocket={selectedTab.current?.ws} channelObject={selectedTab.current?.channelObject} refreshTabContent={refreshTabContent} />
                    </Box>
                }   

            </Stack>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs.current} oldname={selectedTab.current?.name}/> }
            { showSaveBoard && <SaveBoard onClose={onSaveBoardClosed} name={currentBoardName} description={currentBoardDescription} values={boards} /> }
            { showSelectBoard && <SelectBoard onSelect={onSelectBoardClosed} values={boards} action={selectBoardAction}/> }
            { showManageClusters && <ManageClusters onClose={onManageClustersClosed} clusters={clusters}/> }
            { showApiSecurity && <ManageApiSecurity onClose={() => setShowApiSecurity(false)} /> }
            { showUserSecurity && <ManageUserSecurity onClose={() => setShowUserSecurity(false)} /> }
            { showChannelSetup() }
            { showSettingsUser && <SettingsUser onClose={onSettingsUserClosed} settings={settingsRef.current} /> }
            { showSettingsCluster && clusters && <SettingsCluster onClose={onSettingsClusterClosed} clusterName={selectedClusterName} clusterMetricsInterval={clusters.find(c => c.name===selectedClusterName)?.kwirthData?.metricsInterval} /> }
            { showSettingsTrivy && selectedClusterName && <SettingsTrivy onClose={onSettingsTrivyClosed} cluster={clusters.find(c => c.name===selectedClusterName)!}/> }
            { initialMessage !== '' && MsgBoxOk('Kwirth',initialMessage, () => setInitialMessage(''))}
            { firstLogin && <FirstTimeLogin onClose={onFirstTimeLoginClose}/> }
            <Snackbar open={notifyOpen} autoHideDuration={2000} onClose={onNotifyClose} anchorOrigin={{vertical: 'bottom', horizontal:'center'}}>
                <Alert severity={notifyLevel} variant="filled" sx={{ width: '100%' }}>{notifyMessage}</Alert>
            </Snackbar>
            { msgBox }
        </SessionContext.Provider>
    )
}

export default App