import { useEffect, useRef, useState } from 'react'
import { Box, Button, Card, CardContent, CardHeader, IconButton, ListItem, ListItemButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { IOpsData, IScopedObject } from './OpsData'
import { IInstanceConfig, InstanceConfigObjectEnum, InstanceConfigViewEnum, InstanceMessageActionEnum, InstanceMessageChannelEnum, InstanceMessageFlowEnum, InstanceMessageTypeEnum, IOpsMessage, MetricsConfigModeEnum, OpsCommandEnum } from '@jfvilas/kwirth-common'
import { IContentProps } from '../IChannel'
import { AccessKeyEnum, IOpsConfig } from './OpsConfig'
import { v4 as uuid } from 'uuid'
import { TerminalInstance } from './Terminal/TerminalInstance'
import { SelectTerminal } from './Terminal/SelectTerminal'
import { MsgBoxButtons, MsgBoxOk, MsgBoxYesNo } from '../../tools/MsgBox'
import { Delete, Home, MoreVert, RestartAlt, Terminal } from '@mui/icons-material'
import { defaultStyles, JsonView } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css';
import { MenuObject, MenuObjectOption } from './MenuObject'
import { IResourceSelected } from '../../components/ResourceSelector'
import { ILogConfig, ILogInstanceConfig, LogSortOrderEnum } from '../log/LogConfig'
import { IMetricsConfig, IMetricsInstanceConfig } from '../metrics/MetricsConfig'
import { ChartType } from '../metrics/MenuChart'

const OpsTabContent: React.FC<IContentProps> = (props:IContentProps) => {
    const [showSelector, setShowSelector] = useState(false)
    const [selectedScopedObject, setSelectedScopedObject] = useState<IScopedObject|null>(null)
    const [anchorMenuChart, setAnchorMenuChart] = useState<null | HTMLElement>(null)
    const [opsBoxTop, setOpsBoxTop] = useState(0)
    const [selectedTerminal, setSelectedTerminal] = useState<string | undefined>(undefined)
    const [msgBox, setMsgBox] =useState(<></>)
    const commandRef = useRef<HTMLInputElement>()
    const opsBoxRef = useRef<HTMLDivElement | null>(null)
    const [refresh,setRefresh] = useState(0)
    const [filter, setFilter] = useState<string>('')

    enum LaunchActionEnum {
        TERMINAL,
        INFO,
        RESTART
    }
    
    let opsData:IOpsData = props.channelObject.data
    let opsConfig:IOpsConfig = props.channelObject.config

    const closeTerminal = (_id:string) => {
        setSelectedTerminal(undefined)
        opsData.selectedTerminal = undefined
        setRefresh(Math.random())
    }

    useEffect(() => {
        if (opsBoxRef.current) setOpsBoxTop(opsBoxRef.current.getBoundingClientRect().top)
    })

    const onAsyncData = (data:any) => {
        switch(data.event) {
            case 'describe': 
                let content = (
                    <Box sx={{width: '600px', height: '400px', overflow: 'auto'}}>
                        <JsonView data={data.data} style={defaultStyles}/>
                    </Box>
                )
                setMsgBox(MsgBoxOk('Object info', content, setMsgBox))
            break
        }
    }

    useEffect(() => {
        if (!opsData.onAsyncData) opsData.onAsyncData = onAsyncData
        window.addEventListener('keydown', onKeyDown)

        if (opsData.selectedTerminal) {
            setSelectedTerminal(opsData.selectedTerminal)
        }

        if (!opsData.terminalManager.onClose) opsData.terminalManager.onClose = closeTerminal

        return () => {
            window.removeEventListener('keydown', onKeyDown)
            setSelectedTerminal(undefined)
        }
    }, [])
    
    const onKeyDown = (event:any) => {
        let key = event.key
        if (key.startsWith('F') && key.length>1) {
            switch(key) {
                case 'F12':
                    setSelectedTerminal(undefined)
                    opsData.selectedTerminal = undefined
                    setTimeout(() => commandRef.current?.focus(),100)
                    break
                case 'F11':
                    if (opsData.terminalManager.terminals.size===0)
                        setMsgBox(MsgBoxOk('Terminal','You have no terminal consoles open.', setMsgBox))
                    else {
                        setShowSelector(true)
                    }
                    break
                default:
                    let knum = +key.substring(1)
                    let manterm = Array.from(opsData.terminalManager.terminals.entries()).find(tm => tm[1].index === knum)
                    if (manterm) {
                        setSelectedTerminal(manterm[0])
                        opsData.selectedTerminal = manterm[0]
                    }
                    break
            }
            event.preventDefault()
            event.stopPropagation()
        }
    }

    const onSelectNewTerm = (id?:string) =>  {
        setShowSelector(false)
        if (id) {
            opsData.selectedTerminal = id
            setSelectedTerminal(id)
        }
    }

    const formatSelector = () => {
        return <SelectTerminal onSelect={onSelectNewTerm} current={selectedTerminal!} opsData={opsData} />
    }

    const assignIndex = (key:string) => {
        for (let i=1;i<11;i++) {
            let exist = Array.from(opsData.terminalManager.terminals.values()).some(t => t.index === i)
            if (!exist) {
                return i
            }
        }
        return 0
    }

    let newTerm =  Array.from(opsData.terminalManager.terminals.keys()).find(tm => !opsData.terminalManager.terminals.get(tm)?.started)
    if (newTerm) {
        setSelectedTerminal(newTerm)
        opsData.selectedTerminal = newTerm
        let manterm = opsData.terminalManager.terminals.get(newTerm)!
        manterm.index = assignIndex(newTerm)
        manterm.term.attachCustomKeyEventHandler((event) => {
            if (opsConfig.accessKey !== AccessKeyEnum.DISABLED && event.key.startsWith('F') && event.key.length>1) {
                if (opsConfig.accessKey === AccessKeyEnum.NONE && !event.altKey && !event.ctrlKey && !event.shiftKey) return false
                if (opsConfig.accessKey === AccessKeyEnum.ALT && event.altKey && !event.ctrlKey && !event.shiftKey) return false
                if (opsConfig.accessKey === AccessKeyEnum.CTRL && !event.altKey && event.ctrlKey && !event.shiftKey) return false
                if (opsConfig.accessKey === AccessKeyEnum.SHIFT && !event.altKey && !event.ctrlKey && event.shiftKey) return false
            }
            return true
        })
        manterm.started = true
    }

    const launch = (type:LaunchActionEnum, so:IScopedObject) => {
        switch(type) {
            case LaunchActionEnum.TERMINAL:
                let instanceConfig:IInstanceConfig = {
                    flow: InstanceMessageFlowEnum.REQUEST,
                    action: InstanceMessageActionEnum.WEBSOCKET,
                    channel: InstanceMessageChannelEnum.OPS,
                    type: InstanceMessageTypeEnum.DATA,
                    accessKey: props.channelObject.accessString!,
                    instance: props.channelObject.instanceId,
                    namespace: so.namespace,
                    group: '',
                    pod: so.pod,
                    container: so.container,
                    objects: InstanceConfigObjectEnum.PODS,
                    scope: '',
                    view: InstanceConfigViewEnum.NONE
                }
                opsData.websocketRequest = { namespace:so.namespace, pod:so.pod, container:so.container }
                if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( instanceConfig ))
                break
            case LaunchActionEnum.RESTART:
                let opsMessage:IOpsMessage = {
                    flow: InstanceMessageFlowEnum.REQUEST,
                    action: InstanceMessageActionEnum.COMMAND,
                    channel: InstanceMessageChannelEnum.OPS,
                    type: InstanceMessageTypeEnum.DATA,
                    accessKey: props.channelObject.accessString!,
                    instance: props.channelObject.instanceId,
                    id: uuid(),
                    command: OpsCommandEnum.RESTART,
                    namespace: so.namespace,
                    group: '',
                    pod: so.pod,
                    container: so.container,
                    params: [],
                    msgtype: 'opsmessage'
                }
                if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( opsMessage ))
                break
        }
    }

    const menuObjectOptionSelected = (opt:MenuObjectOption, so:IScopedObject) => {
        setAnchorMenuChart(null)
        switch (opt) {
            case MenuObjectOption.DESCRIBE:
                let opsMessageInfo:IOpsMessage = {
                    flow: InstanceMessageFlowEnum.REQUEST,
                    action: InstanceMessageActionEnum.COMMAND,
                    channel: InstanceMessageChannelEnum.OPS,
                    type: InstanceMessageTypeEnum.DATA,
                    accessKey: props.channelObject.accessString!,
                    instance: props.channelObject.instanceId,
                    id: uuid(),
                    command: OpsCommandEnum.DESCRIBE,
                    namespace: so.namespace,
                    group: '',
                    pod: so.pod,
                    container: so.container,
                    params: [],
                    msgtype: 'opsmessage'
                }
                if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( opsMessageInfo ))
                break
            case MenuObjectOption.RESTARTPOD:
                setMsgBox(MsgBoxYesNo('Restart pod',`Are you sure you want to restart pod '${so.pod}' in '${so.namespace}' namespace?`, setMsgBox, (button) => {
                    if (button===MsgBoxButtons.Yes) {
                        let opsMessage:IOpsMessage = {
                            msgtype: 'opsmessage',
                            action: InstanceMessageActionEnum.COMMAND,
                            flow: InstanceMessageFlowEnum.REQUEST,
                            type: InstanceMessageTypeEnum.DATA,
                            channel: InstanceMessageChannelEnum.OPS,
                            instance: props.channelObject.instanceId,
                            id: '1',
                            accessKey: props.channelObject.accessString!,
                            command: OpsCommandEnum.RESTARTPOD,
                            namespace: so.namespace,
                            group: '',
                            pod: so.pod,
                            container: ''
                        }
                        if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( opsMessage ))
                    }
                }))
                break
            case MenuObjectOption.RESTARTNS:
                setMsgBox(MsgBoxYesNo('Restart namespace',`Are you sure you want to restart namespace '${so.namespace}' (this will restart all pods you have access to)?`, setMsgBox, (button) => {
                    if (button===MsgBoxButtons.Yes) {
                        let opsMessage:IOpsMessage = {
                            msgtype: 'opsmessage',
                            action: InstanceMessageActionEnum.COMMAND,
                            flow: InstanceMessageFlowEnum.IMMEDIATE,
                            type: InstanceMessageTypeEnum.DATA,
                            channel: InstanceMessageChannelEnum.OPS,
                            instance: '',
                            id: '1',
                            accessKey: props.channelObject.accessString!,
                            command: OpsCommandEnum.RESTARTNS,
                            namespace: so.namespace,
                            group: '',
                            pod: '',
                            container: ''
                        }
                        if (props.channelObject.webSocket) props.channelObject.webSocket.send(JSON.stringify( opsMessage ))
                    }
                }))
                break
            case MenuObjectOption.VIEWMETRICS:
                let metricsResource:IResourceSelected = {
                    channelId: 'metrics',
                    clusterName: props.channelObject.clusterName,
                    view: props.channelObject.view,
                    namespaces: [so.namespace],
                    groups: [],
                    pods: [so.pod],
                    containers: [so.container],
                    name: `${so.namespace}-${so.pod}+${so.container}`
                }
                let metricsConfig:IMetricsConfig = {
                    depth: 50,
                    width: 3,
                    merge: false,
                    stack: false,
                    chart: ChartType.LineChart,
                    metricsDefault: {}
                }
                let metricsInstanceConfig:IMetricsInstanceConfig = {
                    mode: MetricsConfigModeEnum.STREAM,
                    aggregate: false,
                    interval: 15,
                    metrics: ['kwirth_container_cpu_percentage','kwirth_container_memory_percentage', 'kwirth_container_transmit_mbps', 'kwirth_container_receive_mbps', 'kwirth_container_write_mbps', 'kwirth_container_read_mbps']
                }
                let metricsSettings ={
                    config:metricsConfig,
                    instanceConfig:metricsInstanceConfig
                }
                if (props.channelObject.onCreateTab) props.channelObject.onCreateTab(metricsResource, true, metricsSettings)
                break
            case MenuObjectOption.VIEWLOG:
                let logResource:IResourceSelected = {
                    channelId: 'log',
                    clusterName: props.channelObject.clusterName,
                    view: props.channelObject.view,
                    namespaces: [so.namespace],
                    groups: [],
                    pods: [so.pod],
                    containers: [so.container],
                    name: `${so.namespace}-${so.pod}+${so.container}`
                }
                let logConfig:ILogConfig = {
                    startDiagnostics: false,
                    follow: true,
                    maxMessages: 5000,
                    maxPerPodMessages: 5000,
                    sortOrder: LogSortOrderEnum.TIME
                }
                let logInstanceConfig:ILogInstanceConfig = {
                    previous: false,
                    timestamp: false,
                    fromStart: false
                }
                let logSettings ={
                    config:logConfig,
                    instanceConfig:logInstanceConfig
                }
                if (props.channelObject.onCreateTab) props.channelObject.onCreateTab(logResource, true, logSettings)
                break
        }
    }

    const deleteSession = (key:string) => {
        let manterm = opsData.terminalManager.terminals.get(key)
        if (manterm) {
            manterm.term.dispose()
            if (opsData.terminalManager.onClose) opsData.terminalManager.onClose(key)
            opsData.terminalManager.terminals.delete(key)
            opsData.selectedTerminal = undefined
            setSelectedTerminal(undefined)
            setRefresh(Math.random())
        }
    }

    const onChangeFilter = (event: any) => {
        setFilter(event.target?.value)
    }

    return (<>
        <Box ref={opsBoxRef} sx={{ display:'flex', flexDirection:'column', overflowY:'auto', overflowX:'hidden', flexGrow:1, height: `calc(100vh - ${opsBoxTop}px - 25px)`, ml:1, mr:1, p:1 }}>
            { showSelector && formatSelector() }

            { opsData.started &&  !selectedTerminal &&
                <Stack direction={'row'} spacing={2} alignItems={'start'}>
                    <Card sx={{width:'60%'}}>
                        <CardHeader sx={{border:0, borderBottom:1, borderStyle:'solid', borderColor: 'divider', backgroundColor:'#e0e0e0'}} title={
                            <Stack direction={'row'} alignItems={'center'}>
                                <Typography fontSize={24}>Objects</Typography>
                                <Typography flex={1}></Typography>
                                <TextField value={filter} onChange={onChangeFilter} disabled={!opsData.started} variant='standard' placeholder='Filter...'/>
                            </Stack>
                        }/>
                        <CardContent sx={{backgroundColor:'#f0f0f0'}}>
                            {
                                opsData.scopedObjects.filter(so => so.namespace.includes(filter) || so.pod.includes(filter) || so.container.includes(filter)).map( (scopedObject,index) => {
                                return (
                                    <ListItem key={index}>
                                        <Stack direction={'row'} sx={{width:'100%'}} alignItems={'center'}>
                                            <Typography>{scopedObject.namespace+'/'+scopedObject.pod+'/'+scopedObject.container}</Typography>
                                            <Typography flex={1}></Typography>
                                            <Stack direction={'row'} alignItems={'center'}>
                                                <IconButton onClick={() => launch (LaunchActionEnum.RESTART, scopedObject)}>
                                                    <RestartAlt/>
                                                </IconButton>
                                                <IconButton onClick={() => launch (LaunchActionEnum.TERMINAL, scopedObject)} disabled={opsData.terminalManager.terminals.has(scopedObject.namespace+'/'+scopedObject.pod+'/'+scopedObject.container)}>
                                                    <Terminal/>
                                                </IconButton>
                                                <IconButton onClick={(event) => {setAnchorMenuChart(event.currentTarget); setSelectedScopedObject(scopedObject)}}>
                                                    <MoreVert/>
                                                </IconButton>
                                            </Stack>
                                        </Stack>
                                    </ListItem>
                                )                                
                            }
                            )}
                        </CardContent>
                    </Card>
                    
                    <Card sx={{width:'40%'}}>
                        <CardHeader sx={{border:0, borderBottom:1, borderStyle:'solid', borderColor: 'divider', backgroundColor:'#e0e0e0'}} title={<>XTerm</>}></CardHeader>
                        <CardContent sx={{backgroundColor:'#f0f0f0'}}>
                            { opsData.terminalManager.terminals.size===0 &&
                                <>You have no open terminals.</>
                            }

                            { opsData.terminalManager.terminals.size>0 &&
                                Array.from(opsData.terminalManager.terminals.keys()).map( (key) => {
                                // return <ListItemButton onClick={() => onSelectNewTerm(key)} key={key} selected={false} disabled={false}>

                                return    <ListItem>
                                        <Stack direction={'row'} sx={{width:'100%'}} alignItems={'center'}>
                                            <ListItemButton onClick={() => onSelectNewTerm(key)}>
                                                <Typography flex={1}>{key}</Typography>
                                                {opsData.terminalManager.terminals.get(key)!.index > 0 ?
                                                    <Typography width={'32px'}>{'F'+opsData.terminalManager.terminals.get(key)!.index}</Typography>
                                                :
                                                    <Typography width={'32px'}></Typography>
                                                }

                                            </ListItemButton>
                                            <IconButton onClick={() => deleteSession(key)}>
                                                <Delete />
                                            </IconButton>
                                        </Stack>
                                    </ListItem>
                                })
                            }

                        </CardContent>
                    </Card>

                </Stack> }

            { opsData.started &&  opsData.selectedTerminal!==undefined && selectedTerminal && (
                <div style={{ display:'flex', flexDirection:'column', height: '100%', position: "relative", overflow:'hidden' }}>
                    <Box>
                        <Button onClick={() => {setSelectedTerminal(undefined); opsData.selectedTerminal=undefined; setTimeout(() => commandRef.current?.focus(),100)}}>
                            <Home fontSize='small' sx={{mb:'2px'}}/>HOME
                        </Button>
                        {Array.from(opsData.terminalManager.terminals.keys()).map(key => {               
                            return (
                                <Tooltip key={key} title={key}>
                                    <Button onClick={() => {setSelectedTerminal(key); opsData.selectedTerminal=key}} sx={{background: selectedTerminal===key? 'lightgray':'white', borderBottomRightRadius:0, borderBottomLeftRadius:0}}>
                                        {key.split('/')[2]}{opsData.terminalManager.terminals.get(key)!.index>0 && <Typography fontSize={10} fontWeight={'900'}>&nbsp;&nbsp;F{opsData.terminalManager.terminals.get(key)?.index}</Typography>}
                                    </Button>
                                </Tooltip>
                            )
                        })}
                    </Box>

                    <TerminalInstance id={selectedTerminal} terminalManager={opsData.terminalManager} data-refresh={refresh}/>
                </div>)
            }
            { msgBox }
            { anchorMenuChart && selectedScopedObject && <MenuObject onClose={() => setAnchorMenuChart(null)} onOptionSelected={menuObjectOptionSelected} anchorMenu={anchorMenuChart} scopedObject={selectedScopedObject}/> }
        </Box>
    </>)
}

export { OpsTabContent }