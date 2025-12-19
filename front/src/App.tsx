import { useState, useRef, useEffect } from 'react'

// material & icons
import { Alert, AppBar, Box, Drawer, IconButton, Snackbar, SnackbarCloseReason, Stack, Tab, Tabs, Toolbar, Tooltip, Typography } from '@mui/material'
import { Settings as SettingsIcon, Menu, Person, Home } from '@mui/icons-material'

// model
import { Cluster, IClusterInfo } from './model/Cluster'

// components
import { RenameTab } from './components/RenameTab'
import { SaveWorkspace } from './components/board/SaveWorkspace'
import { SelectWorkspace }  from './components/board/SelectWorkspace'
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
import { IChannelSettings, Settings } from './model/Settings'
import { FirstTimeLogin } from './components/FirstTimeLogin'
import { IWorkspace, IWorkspaceSummary } from './model/IWorkspace'

import { VERSION } from './version'
import { SessionContext } from './model/SessionContext'
import { addGetAuthorization, addDeleteAuthorization, addPostAuthorization } from './tools/AuthorizationManagement'
import { IInstanceMessage, versionGreaterThan, InstanceConfigScopeEnum, InstanceConfigViewEnum, IInstanceConfig, InstanceConfigObjectEnum, InstanceMessageTypeEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageActionEnum, parseResources, KwirthData, BackChannelData, IUser } from '@jfvilas/kwirth-common'
import { ITabObject, ITabSummary } from './model/ITabObject'

import { ChannelConstructor, ChannelRefreshAction as ChannelRefresh, IChannel, IChannelMessageAction, ISetupProps } from './channels/IChannel'
import { LogChannel } from './channels/log/LogChannel'
import { EchoChannel } from './channels/echo/EchoChannel'
import { AlertChannel } from './channels/alert/AlertChannel'
import { MetricsChannel } from './channels/metrics/MetricsChannel'
import { TrivyChannel } from './channels/trivy/TrivyChannel'
import { OpsChannel } from './channels/ops/OpsChannel'
import { MagnifyChannel } from './channels/magnify/MagnifyChannel'
import { getMetricsNames, ENotifyLevel, readClusterInfo } from './tools/Global'
import { FilemanChannel } from './channels/fileman/FilemanChannel'
import { Homepage } from './components/Homepage'
import { DEFAULTLASTTABS, IColors, TABBASECOLORS, TABBRIGHTCOLORS } from './tools/Constants'

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
    const [channelMessageAction, setChannelMessageAction] = useState<IChannelMessageAction>({action: ChannelRefresh.NONE})

    const settingsRef = useRef<Settings|null>(null)

    const [backChannels, setBackChannels] = useState<BackChannelData[]>([])
    const backChannelsRef = useRef(backChannels)
    backChannelsRef.current= backChannels

    // menus/navigation
    const [anchorMenuTab, setAnchorMenuTab] = useState<null | HTMLElement>(null)
    const [menuDrawerOpen,setMenuDrawerOpen]=useState(false)

    // boards
    const [currentWorkspaceName, setCurrentWorkspaceName] = useState('')
    const [currentWorkspaceDescription, setCurrentWorkspaceDescription] = useState('')
    const [workspaces, setWorkspaces] = useState<{name:string, description:string}[]>([])
    const [selectWorkspaceAction, setSelectWorkspaceAction] = useState('')

    // components
    const [showRenameTab, setShowRenameLog]=useState<boolean>(false)
    const [showManageClusters, setShowManageClusters]=useState<boolean>(false)
    const [showSaveWorkspace, setShowSaveWorkspace]=useState<boolean>(false)
    const [showSelectWorkspace, setShowSelectWorkspace]=useState<boolean>(false)
    const [showApiSecurity, setShowApiSecurity]=useState<boolean>(false)
    const [showUserSecurity, setShowUserSecurity]=useState<boolean>(false)
    const [showSettingsUser, setShowSettingsUser]=useState<boolean>(false)
    const [showSettingsCluster, setShowSettingsCluster]=useState<boolean>(false)
    const [showSettingsTrivy, setShowSettingsTrivy]=useState<boolean>(false)
    const [initialMessage, setInitialMessage]=useState<string>('')

    // last & favs
    const [lastTabs, setLastTabs] = useState<ITabSummary[]>([])
    const [favTabs, setFavTabs] = useState<ITabSummary[]>([])
    const [lastWorkspaces, setLastWorkspaces] = useState<IWorkspaceSummary[]>([])
    const [favWorkspaces, setFavWorkspaces] = useState<IWorkspaceSummary[]>([])

    // ui notifications
    const [notifyOpen, setNotifyOpen] = useState(false)
    const [notifyMessage, setNotifyMessage] = useState('')
    const [notifyLevel, setNotifyLevel] = useState<ENotifyLevel>(ENotifyLevel.INFO)
    
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
        frontChannels.set('magnify', MagnifyChannel)
    },[])

    const onNotifyClose = (event?: React.SyntheticEvent | Event, reason?: SnackbarCloseReason) => {
        if (reason === 'clickaway') return
        setNotifyOpen(false)
    }

    const notify = (level:ENotifyLevel, msg:string) => {
        setNotifyOpen(true)
        setNotifyMessage(msg)
        setNotifyLevel(level)
    }

    useEffect ( () => {
        // only when user logs on / off
        if (!logged) return

        if (clustersRef.current.length === 0) getClusters()
            
        if (!settingsRef.current || settingsRef.current === null) readSettings() 

        // load user tabs
        let lt = localStorage.getItem('lastTabs')
        if (lt)
            setLastTabs(JSON.parse(lt))
        else
            setLastTabs(DEFAULTLASTTABS)
        let ft = localStorage.getItem('favTabs')
        if (ft) setFavTabs(JSON.parse(ft))

        // load user Workspaces
        let lb = localStorage.getItem('lastWorkspaces')
        if (lb)
            setLastWorkspaces(JSON.parse(lb))
        else
            setLastWorkspaces([])
        let fb = localStorage.getItem('favWorkspaces')
        if (fb) setFavWorkspaces(JSON.parse(fb))
    },[logged])

    useEffect( () => {
        let c = clusters.find(c => c.source)
        if (c) onChangeCluster(c.name)
    }, [clusters])

    const fillTabSummary = async (tab:ITabSummary) => {
        let namespacesArray:string[] = []
        if (tab.channelObject.namespace==='$all' || tab.channelObject.group==='$all'|| tab.channelObject.pod==='$all'|| tab.channelObject.container==='$all') {
            namespacesArray = (await (await fetch(`${backendUrl}/config/namespace`, addGetAuthorization(accessString))).json())
            tab.channelObject.namespace = namespacesArray.join(',')
        }
        let groupsArr = []
        if (tab.channelObject.group==='$all') {
            for (let namespace of namespacesArray) {
                let data = await((await fetch(`${backendUrl}/config/${namespace}/groups`, addGetAuthorization(accessString))).json())
                data = data.map ( (g:any) => ({ ...g, namespace }))
                groupsArr.push(...data)
            }
            if (tab.channelObject.group==='$all') tab.channelObject.group = groupsArr.map(g => g.type+'+'+g.name).join(',')
        }

        let podsArray:any[] = []
        if (tab.channelObject.pod==='$all' || tab.channelObject.container==='$all') {
            for (let group of groupsArr.filter(g => g.type!=='deployment')) {
                let data = await (await fetch(`${backendUrl}/config/${group.namespace}/${group.name}/pods?type=${group.type}`, addGetAuthorization(accessString))).json()
                data = data.map ((name:string) => ({ name, namespace:group.namespace}))
                podsArray.push (...data)
            }
            if (tab.channelObject.pod==='$all') tab.channelObject.pod = podsArray.map(pod => pod.name).join(',')
        }
    
        let containersArray:string[] = []
        if (tab.channelObject.container==='$all') {
            for (let pod of podsArray) {
                let data = await ((await fetch(`${backendUrl}/config/${pod.namespace}/${pod.name}/containers`, addGetAuthorization(accessString))).json())
                data = data.map( (c:string) => pod.name+'+'+c)
                containersArray.push (...(data as string[]))
            }
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
            readClusterInfo(cluster).then( () => { setChannelMessageAction({action : ChannelRefresh.REFRESH}) })
        clusterList.push(srcCluster)
        setClusters(clusterList)
        setChannelMessageAction({action : ChannelRefresh.REFRESH})
    }

    const readSettings = async () => {
        let resp = await fetch (`${backendUrl}/store/${user?.id}/settings/general`, addGetAuthorization(accessString))
        if (resp.status===200) {
            let json=await resp.json()
            if (json && settingsRef) settingsRef.current = JSON.parse(json) as Settings
        }
        else {
            settingsRef.current = { channelSettings: [], keepAliveInterval: 60 }
        }
    }

    const writeSettings = async () => {
        if (user) {
            let payload = JSON.stringify(settingsRef.current)
            fetch (`${backendUrl}/store/${user.id}/settings/general`, addPostAuthorization(accessString, payload))
        }
    }

    const setUsablechannels = (cluster:Cluster) => {
        if (cluster && cluster.kwirthData) {
            let usableChannels = [...cluster.kwirthData.channels]
            usableChannels = usableChannels.filter(c => Array.from(frontChannels.keys()).includes(c.id))
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

    const onResourceSelectorAdd = (selection:IResourceSelected, start:boolean, settings:any) => {
        let cluster = clusters.find(c => c.name===selection.clusterName)
        if (!cluster) {
            setMsgBox(MsgBoxOkError('Kwirth',`Cluster established at tab configuration ${selection.clusterName} does not exist.`, setMsgBox))
            return
        }

        if (frontChannels.has(selection.channelId)) {
           populateTabObject(selection.name, selection.channelId, cluster, selection.view, selection.namespaces.join(','), selection.groups.join(','), selection.pods.join(','), selection.containers.join(','), start, settings)
        }
        else {
            console.log(`Error, invalid channel: `, selection.channelId)
            setMsgBox(MsgBoxOkError('Add resource', 'Channel is not supported', setMsgBox))
        }
    }

    const populateTabObject = (name:string, channelId:string, cluster:Cluster, view:string, namespaces:string, groups:string, pods:string, containers:string, start:boolean, settings:any, tab?:ITabObject) : ITabObject => {
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
                config: undefined,
                data: undefined,
                instanceConfig: undefined
            },
            channelStarted: false,
            channelPaused: false,
            channelPending: false,
            headerEl: undefined
        }

        if (newTab.channel.requiresMetrics()) newTab.channelObject.metricsList = cluster.metricsList
        if (newTab.channel.requiresClusterUrl()) newTab.channelObject.clusterUrl = cluster.url
        if (newTab.channel.requiresAccessString()) newTab.channelObject.accessString = cluster?.accessString
        newTab.channelObject.config = settingsRef.current?.channelSettings.find(c => c.channelId === newTab.channel.channelId)
        if (newTab.channel.initChannel(newTab.channelObject)) setChannelMessageAction({action : ChannelRefresh.REFRESH})
        if (tab) newTab.channelObject.instanceConfig = tab.channelObject.instanceConfig
        if (newTab.channel.requiresSettings()) {
            // this 'requires' must be executed after managing config and instanceConfig
            if (settingsRef.current) {
                let thisChannnel = settingsRef.current.channelSettings.find(c => c.channelId === newTab.channel.channelId)
                if (thisChannnel) {
                    newTab.channelObject.channelSettings = {
                        channelId: newTab.channel.channelId,
                        channelConfig: thisChannnel.channelConfig,
                        channelInstanceConfig: thisChannnel.channelInstanceConfig
                    }
                }
                else {
                    newTab.channelObject.channelSettings = {
                        channelId: newTab.channel.channelId,
                        channelConfig: undefined,
                        channelInstanceConfig: undefined
                    }
                }
            }
            newTab.channelObject.onUpdateChannelSettings = (channelSettings:IChannelSettings) => {
                if (settingsRef.current) {
                    console.log('sccb', settingsRef.current.channelSettings)
                    let thisChannnel = settingsRef.current.channelSettings.find(c => c.channelId === newTab.channel.channelId)
                    if (!thisChannnel) {
                        thisChannnel = {
                            channelId: newTab.channel.channelId,
                            channelConfig: channelSettings.channelConfig,
                            channelInstanceConfig: undefined
                        }
                        settingsRef.current.channelSettings.push(thisChannnel)
                    }
                    else {
                        thisChannnel.channelConfig = channelSettings.channelConfig
                    }
                    writeSettings()
                }
            }
        }
        newTab.channelObject.onCreateTab = (xresource:IResourceSelected, sstart:boolean, ssettings:any) => {
            onResourceSelectorAdd(xresource, sstart, ssettings)
        }
        startSocket(newTab, cluster, () => {
            console.log(`WebSocket connected: ${newTab.ws?.url}`, new Date().toISOString())
            setKeepAlive(newTab)
            if (newTab.channel.requiresWebSocket()) newTab.channelObject.webSocket = newTab.ws
            if (newTab && (newTab.channelStarted || start)) {
                newTab.channelObject.config = settings.config
                newTab.channelObject.instanceConfig = settings.instanceConfig
                startTabChannel(newTab)
                setChannelMessageAction({action : ChannelRefresh.REFRESH})  // we force rendering
            }
        })
        selectedTab.current = newTab
        tabs.current.push(newTab)
        setChannelMessageAction({action : ChannelRefresh.REFRESH})  // force re-render for showing new tab
        return newTab
    }

    const showChannelSetup = () => {
        if (!selectedTab.current || !selectedTab.current.channel || !selectedTab.current.channel.getSetupVisibility()) return
        const SetupDialog = selectedTab.current.channel.SetupDialog
        let props:ISetupProps = {
            channel: selectedTab.current.channel,
            onChannelSetupClosed,
            channelObject: selectedTab.current.channelObject,
            setupConfig: {
                channelId: selectedTab.current.channel.channelId,
                channelConfig: selectedTab.current.channelObject.config,
                channelInstanceConfig: selectedTab.current.channelObject.instanceConfig
            }
        }
        if (settingsRef.current?.channelSettings && settingsRef.current.channelSettings.some(c => c.channelId === selectedTab.current?.channel.channelId)) {
            props.setupConfig = settingsRef.current.channelSettings.find(c => c.channelId === selectedTab.current?.channel.channelId)
        }
        return <SetupDialog {...props} />
    }

    const onChannelSetupClosed = (channel:IChannel, channelSettings:IChannelSettings, start:boolean, setDefaultValues:boolean) => {
        channel.setSetupVisibility(false)
        if (!selectedTab.current || !settingsRef.current) return
        if (!start) {
            setChannelMessageAction({action : ChannelRefresh.REFRESH})
            return
        }

        if (setDefaultValues) {
            settingsRef.current.channelSettings = settingsRef.current.channelSettings.filter(c => c.channelId !== channel.channelId)
            settingsRef.current.channelSettings.push ({
                channelId: selectedTab.current.channel.channelId,
                channelInstanceConfig: channelSettings.channelInstanceConfig,
                channelConfig: channelSettings.channelConfig
            })
            console.log(settingsRef.current)
            writeSettings()
        }

        selectedTab.current.channelObject.config = channelSettings.channelConfig
        selectedTab.current.channelObject.instanceConfig = channelSettings.channelInstanceConfig
        setChannelMessageAction({action : ChannelRefresh.REFRESH})  // we force rendering
        startTabChannel(selectedTab.current)
    }

    const setKeepAlive = (tab:ITabObject) => {
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
        let colorTable:IColors = TABBRIGHTCOLORS
        if (selectedTab.current === tab) colorTable = TABBASECOLORS
        if (tab.channelStarted) {
            if (tab.channelPaused) {
                tab.headerEl.style.backgroundColor = colorTable.pause
            }
            else {
                if (tab.channelPending)
                    tab.headerEl.style.backgroundColor = colorTable.pending
                else {
                    tab.headerEl.style.backgroundColor = colorTable.start
                }
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
                setChannelMessageAction({action : ChannelRefresh.REFRESH})
                if (selectedTab.current) colorizeTab(selectedTab.current)
                colorizeTab(newTab)
                let cluster = clusters.find(c => c.name === newTab.channelObject.clusterName)
                if (cluster) setUsablechannels(cluster)
            }
            selectedTab.current = newTab
        }
        else {
            selectedTab.current = undefined
            setChannelMessageAction({action : ChannelRefresh.REFRESH})
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
            let refresh = tab.channel.processChannelMessage(tab.channelObject, wsEvent)
            if (refresh.action === ChannelRefresh.REFRESH) {
                if (selectedTab?.current?.name === tab.name) {
                    setChannelMessageAction({action : ChannelRefresh.REFRESH})
                }
                else {
                    if (!tab.channelPending) {
                        tab.channelPending = true
                        colorizeTab(tab)
                    }
                }
            }
            else if (refresh.action === ChannelRefresh.STOP) {
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

        let instanceConfig:IInstanceConfig = {
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
        console.log('WebSocket disconnected', new Date().toISOString())
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
                if (selectedTab.current.channel.socketDisconnected(selectedTab.current.channelObject)) setChannelMessageAction({action : ChannelRefresh.REFRESH})
            }
            else {
                console.log('Unsuppported channel on disconnect:', tab.channel.channelId)
            }
            setChannelMessageAction({action : ChannelRefresh.REFRESH})

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

            let instanceConfig: IInstanceConfig = {
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
                
                tab.channel.startChannel(tab.channelObject)
                colorizeTab(tab)

                if (!lastTabs.some(t => t.name === tab.name && t.channel === tab.channel.channelId)) {
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
                    let newLastTabs = lastTabs
                    if (newLastTabs.length>5) newLastTabs= newLastTabs.slice(0,4)
                    setLastTabs([newTab, ...newLastTabs])
                    localStorage.setItem('lastTabs', JSON.stringify([newTab, ...newLastTabs]))
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
        let instanceConfig: IInstanceConfig = {
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
            if (selectedTab.current.channel.stopChannel(selectedTab.current.channelObject)) setChannelMessageAction({action : ChannelRefresh.REFRESH})
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
        
        let instanceConfig:IInstanceConfig = {
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
            if (selectedTab.current.channel.continueChannel(selectedTab.current.channelObject)) setChannelMessageAction({action : ChannelRefresh.REFRESH})
        }
        else {
            selectedTab.current.channelPaused = true
            colorizeTab(selectedTab.current)
            instanceConfig.action = InstanceMessageActionEnum.PAUSE
            if (selectedTab.current.channel.pauseChannel(selectedTab.current.channelObject)) setChannelMessageAction({action : ChannelRefresh.REFRESH})
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

    const saveWorkspace = (name:string, description:string) => {
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
                delete newTab.channelObject.data  // we only need uiConfig and instanceConfig
                newTabs.push(newTab)
            }
            else {
                console.log('Channel not supported on saveWorkspace:',tab.channel.channelId)
            }
        }
        let workspace:IWorkspace = {
            name,
            description,
            tabs: newTabs
        }
        let payload=JSON.stringify( workspace )
        fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addPostAuthorization(accessString, payload))

        if (currentWorkspaceName !== name) {
            setCurrentWorkspaceName(name)
            setCurrentWorkspaceDescription(description)
            
            let newLastWorkspaces=[{name: workspace.name, description:workspace.description}, ...lastWorkspaces]
            setLastWorkspaces(newLastWorkspaces)
            localStorage.setItem('lastWorkspaces', JSON.stringify(newLastWorkspaces))
        }
    }

    const onSaveWorkspaceClosed = (name?:string, description?:string) => {
        setShowSaveWorkspace(false)
        if (name) saveWorkspace(name, description||'No description')
    }

    const onSelectWorkspaceClosed = async (action:string, name?:string) => {
        setShowSelectWorkspace(false)
        if (name) {
            if (action === 'delete') {
                setMsgBox(MsgBoxYesNo('Delete workspace',`Are you sure you want to delete workspace ${name} (you cannot undo this action)?`, setMsgBox, (button) => {
                    if (button===MsgBoxButtons.Yes) {
                        fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addDeleteAuthorization(accessString))
                        if (name === currentWorkspaceName) {
                            setCurrentWorkspaceName('untitled')
                            setCurrentWorkspaceDescription('No description yet')                            
                        }
                        let newLastWorkspaces=[...lastWorkspaces.filter(b => b.name!==name)]
                        setLastWorkspaces(newLastWorkspaces)
                        localStorage.setItem('lastWorkspaces', JSON.stringify(newLastWorkspaces))
                    }
                }))
            }
            else if (action === 'load') {
                loadWorkspace(name)
            }
        }
    }

    const loadWorkspace = async (name: string) => {
        let errors = ''
        clearTabs()

        let workspaceDef = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${name}`, addGetAuthorization(accessString))).json()
        let newWorkspace:IWorkspace = JSON.parse(workspaceDef)
        if (newWorkspace && newWorkspace.tabs && newWorkspace.tabs.length>0) {
            for (let t of newWorkspace.tabs) {
                let clusterName = t.channelObject.clusterName
                if (!clusters.find(c => c.name === clusterName)) {
                    errors += `Cluster '${clusterName}' used in tab ${t.name} does not exsist<br/><br/>`
                }
            }
            if (errors!=='') setMsgBox(MsgBoxOkError('Kwirth',`Some errors have been detected when loading workspace:<br/><br/>${errors}`, setMsgBox))
            setCurrentWorkspaceName(name)
            setCurrentWorkspaceDescription(newWorkspace.description)
            for (let t of newWorkspace.tabs) {
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
                onResourceSelectorAdd(res, false, undefined)
            }

            if (!lastWorkspaces.some(workspace => workspace.name === newWorkspace.name)) {
                let newLastWorkspaces = lastWorkspaces
                if (newLastWorkspaces.length>5) newLastWorkspaces= newLastWorkspaces.slice(0,4)
                setLastWorkspaces([newWorkspace, ...newLastWorkspaces])
                localStorage.setItem('lastWorkspaces', JSON.stringify([newWorkspace, ...newLastWorkspaces]))
            }
        }
    }

    const showNoWorkspaces = () => {
        setMsgBox(MsgBoxOk('Workspace management','You have no workspaces stored in your personal Kwirth space', setMsgBox))
    }

    const getWorkspaces = async () => {
        let allWorkspaces:IWorkspace[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards?full=true`, addGetAuthorization(accessString))).json()
        if (allWorkspaces.length===0) {
            showNoWorkspaces()
            return undefined
        }
        else {
            let values = allWorkspaces.map( b => {
                let name=Object.keys(b)[0]
                let workspace = JSON.parse((b as any)[name]) as IWorkspace
                return { name: workspace.name,  description: workspace.description }
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
            case MenuDrawerOption.NewWorkspace:
                clearTabs()
                setCurrentWorkspaceName('untitled')
                setCurrentWorkspaceDescription('No description yet')
                selectedTab.current = undefined
                break
            case MenuDrawerOption.SaveWorkspace:
                if (currentWorkspaceName !== '' && currentWorkspaceName !== 'untitled')
                    saveWorkspace(currentWorkspaceName, currentWorkspaceDescription)
                else {
                    setShowSaveWorkspace(true)
                }
                break
            case MenuDrawerOption.SaveWorkspaceAs: {
                    let values = await getWorkspaces()
                    if (values) {
                        setWorkspaces(values)
                        setShowSaveWorkspace(true)
                }}
                break
            case MenuDrawerOption.LoadWorkspace: {
                let values = await getWorkspaces()
                if (values) {
                    setWorkspaces(values)
                    setSelectWorkspaceAction ('load')
                    setShowSelectWorkspace(true)
                }}
                break
            case MenuDrawerOption.DeleteWorkspace: {
                let values = await getWorkspaces()
                if (values) {
                    setWorkspaces( values )
                    setSelectWorkspaceAction ('delete')
                    setShowSelectWorkspace(true)
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
            case MenuDrawerOption.ExportWorkspaces:
                let workspacesToExport:string[] = await (await fetch (`${backendUrl}/store/${user?.id}/boards`, addGetAuthorization(accessString))).json()
                if (workspacesToExport.length===0) {
                    showNoWorkspaces()
                }
                else {
                    let content:any={}
                    for (let workspaceName of workspacesToExport) {
                        let readWorkspace = await (await fetch (`${backendUrl}/store/${user?.id}/boards/${workspaceName}`, addGetAuthorization(accessString))).json()
                        content[workspaceName]=JSON.parse(readWorkspace)
                    }
                    handleDownload(JSON.stringify(content),`${user?.id}-export-${new Date().toLocaleDateString()+'-'+new Date().toLocaleTimeString()}.kwirth.json`)
                }
                break
            case MenuDrawerOption.ImportWorkspaces:
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
                let allWorkspaces=JSON.parse(event.target.result)
                for (let workspaceName of Object.keys(allWorkspaces)) {
                    let payload=JSON.stringify(allWorkspaces[workspaceName])
                    fetch (`${backendUrl}/store/${user?.id}/boards/${workspaceName}`, addPostAuthorization(accessString, payload))
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
            setCurrentWorkspaceName('untitled')
            setCurrentWorkspaceDescription('No description yet')
            clearTabs()
        }
    }

    const onFirstTimeLoginClose = (exit:boolean) => {
        setFirstLogin(false)
        if (exit) setLogged(false)
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
            populateTabObject(clonedTab.name, clonedTab.channel, cluster, clonedTab.channelObject.view, clonedTab.channelObject.namespace, clonedTab.channelObject.group, clonedTab.channelObject.pod, clonedTab.channelObject.container, false, undefined)
            onClickChannelStart()
        }
    }

    const onHomepageWorkspace = (workspace: IWorkspaceSummary): void => {
        loadWorkspace(workspace.name)
    }
    
    const onHomepageUpdateTabs = (last: ITabSummary[], fav: ITabSummary[]): void => {
        localStorage.setItem('lastTabs', JSON.stringify(last))
        localStorage.setItem('favTabs', JSON.stringify(fav))
        setLastTabs(last)
        setFavTabs(fav)
    }
    
    const onHomepageUpdateWorkspaces = (last: IWorkspaceSummary[], fav: IWorkspaceSummary[]): void => {
        localStorage.setItem('lastWorkspaces', JSON.stringify(last))
        localStorage.setItem('favWorkspaces', JSON.stringify(fav))
        setLastWorkspaces(last)
        setFavWorkspaces(fav)
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
        setChannelMessageAction({action : ChannelRefresh.REFRESH})
    }

    return (
        <SessionContext.Provider value={{ user, accessString: accessString, logged, backendUrl }}>
            <AppBar position='sticky' elevation={0} sx={{ zIndex: 99, height:'64px' }}>
                <Toolbar>
                    <IconButton size='large' edge='start' color='inherit' sx={{ mr: 1 }} onClick={() => setMenuDrawerOpen(true)}><Menu /></IconButton>
                    <Typography sx={{ ml:1,flexGrow: 1 }}>KWirth</Typography>
                    <Tooltip title={<div style={{textAlign:'center'}}>{currentWorkspaceName}<br/><br/>{currentWorkspaceDescription}</div>} sx={{ mr:2}} slotProps={{popper: {modifiers: [{name: 'offset', options: {offset: [0, -12]}}]}}}>
                        <Typography variant='h6' component='div' sx={{mr:2, cursor:'default'}}>{currentWorkspaceName}</Typography>
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

            <ResourceSelector clusters={clusters} backChannels={backChannels} onAdd={(res) => onResourceSelectorAdd(res, false, undefined)} onChangeCluster={onChangeCluster} sx={{ mt:1, ml:1 }} tabs={tabs.current} data-refresh={channelMessageAction} resourceSelected={resourceSelected}/>
            
            <Stack direction={'column'}>
                <Stack direction={'row'} alignItems={'end'} sx={{mb:1, borderBottom: 1, borderColor: 'divider'}}>                    
                    <Tabs value={selectedTab.current? false : 0} sx={{minWidth:'100px'}}>
                        <Tab key={'0'} label={<Home/>} value={0} onClick={onSelectHome} sx={{height:'60px'}}/>
                    </Tabs>
                    { tabs.current.length>0 &&
                        <Tabs value={selectedTab.current? tabs.current.indexOf(selectedTab.current) : false} onChange={onChangeTab} variant='scrollable' scrollButtons='auto' TabIndicatorProps={{ style: { display: 'none' } }} sx={{ml:"-16px"}}>
                            {   tabs.current.map((tab:ITabObject, index) => {
                                    return <Tab component='span' ref={(el) => tab.headerEl = el} key={index} label={formatTabName(tab)} value={index} icon={
                                                tab === selectedTab.current ? 
                                                    <IconButton onClick={(event) => setAnchorMenuTab(event.currentTarget)}><SettingsIcon fontSize='small' color='primary'/></IconButton>
                                                    :
                                                    <Box sx={{minWidth:'36px'}}/>} iconPosition='end' sx={{
                                                        borderRadius: '10px 10px 0 0',
                                                        backgroundColor:'#ebebeb',
                                                        '& .MuiTouchRipple-root': {
                                                            borderTopLeftRadius: '8px',
                                                            borderTopRightRadius: '8px',
                                                        }}}/>
                                })
                            }
                        </Tabs>
                    }
                    <Typography sx={{ flexGrow: 1 }}></Typography>
                </Stack>
                { selectedTab.current &&
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        { anchorMenuTab && <MenuTab onClose={() => setAnchorMenuTab(null)} optionSelected={menuTabOptionSelected} anchorMenuTab={anchorMenuTab} tabs={tabs.current} selectedTab={selectedTab.current} selectedTabIndex={selectedTab.current? tabs.current.indexOf(selectedTab.current) : -1} backChannels={backChannels}/>}
                        <TabContent key={selectedTab.current?.name} channel={selectedTab.current?.channel} webSocket={selectedTab.current?.ws} channelObject={selectedTab.current?.channelObject} channelMessageAction={channelMessageAction} />
                    </Box>
                }
                { !selectedTab.current && 
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <Homepage lastTabs={lastTabs} favTabs={favTabs} lastWorkspaces={lastWorkspaces} favWorkspaces={favWorkspaces} onSelectTab={onHomepageTab} onSelectWorkspace={onHomepageWorkspace} frontChannels={frontChannels} onUpdateTabs={onHomepageUpdateTabs} cluster={clusters.find(c => c.name === selectedClusterName)} clusters={clusters} onUpdateWorkspaces={onHomepageUpdateWorkspaces}/>
                    </Box>
                }

            </Stack>

            { showRenameTab && <RenameTab onClose={onRenameTabClosed} tabs={tabs.current} oldname={selectedTab.current?.name}/> }
            { showSaveWorkspace && <SaveWorkspace onClose={onSaveWorkspaceClosed} name={currentWorkspaceName} description={currentWorkspaceDescription} values={workspaces} /> }
            { showSelectWorkspace && <SelectWorkspace onSelect={onSelectWorkspaceClosed} values={workspaces} action={selectWorkspaceAction}/> }
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